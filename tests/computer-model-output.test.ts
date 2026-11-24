import { describe, it, expect, vi, afterEach } from "vitest";
import { parseDecision, BadDecision } from "@/lib/computer/actions";
import { runComputerTask, redactReply, type AgentEvent } from "@/lib/computer/agent";
import { buildMessages, visionDecider, MAX_COMPLETION_TOKENS, type DecideInput, type DecideOutput } from "@/lib/computer/model";
import type { HubClient } from "@/lib/computer/hub-client";

/* Shapes vision models actually emit, which the old parser rejected. */
describe("@computer tolerant model-output parsing", () => {
  const click = { type: "click", x: 708, y: 41, button: "left", clicks: 1 };
  it("accepts our schema with prose, fences, <think> and <tool_call> wrappers", () => {
    const body = '{"thought":"address bar","risky":false,"action":{"type":"click","x":708,"y":41}}';
    for (const raw of [
      body,
      `Here is the next step:\n\`\`\`json\n${body}\n\`\`\``,
      `<think>Safari is open. I should {maybe} click the bar.</think>\n${body}`,
      `Safari is open, so click the bar.</think>${body}`,
      `<tool_call>\n${body}\n</tool_call>`,
    ]) expect(parseDecision(raw).action, raw).toEqual(click);
  });
  it("skips a non-decision {...} in prose and uses the next object", () => {
    const r = parseDecision('The screen shows {Safari}. {"thought":"t","action":{"type":"key","keys":["cmd","l"]}}');
    expect(r.action).toEqual({ type: "key", keys: ["cmd", "l"] });
  });
  it("repairs trailing commas and smart quotes", () => {
    expect(parseDecision('{"thought":"t","action":{"type":"key","keys":["cmd","l",],},}').action).toEqual({ type: "key", keys: ["cmd", "l"] });
    expect(parseDecision('{\u201cthought\u201d:\u201ct\u201d,\u201caction\u201d:{\u201ctype\u201d:\u201cwait\u201d,\u201cms\u201d:500}}').action).toEqual({ type: "wait", ms: 500 });
  });
  it("maps the native computer-use output", () => {
    expect(parseDecision('{"action":"left_click","coordinate":[708,41]}').action).toEqual(click);
    expect(parseDecision('{"name":"computer_use","arguments":{"action":"left_click","coordinate":[708,41]}}').action).toEqual(click);
    expect(parseDecision('{"name":"computer_use","arguments":"{\\"action\\":\\"key\\",\\"keys\\":[\\"cmd\\",\\"l\\"]}"}').action).toEqual({ type: "key", keys: ["cmd", "l"] });
    expect(parseDecision('{"action":"type","text":"news"}').action).toEqual({ type: "type", text: "news" });
    expect(parseDecision('{"action":"double_click","coordinate":[10,20]}').action).toEqual({ type: "click", x: 10, y: 20, button: "left", clicks: 2 });
    expect(parseDecision('{"action":"wait","time":2}').action).toEqual({ type: "wait", ms: 2000 });
    expect(parseDecision('{"action":"terminate","status":"success"}').action).toEqual({ type: "done", summary: "success" });
  });
  it("accepts a bare action, string keys, string numbers and string booleans", () => {
    expect(parseDecision('{"type":"key","keys":"cmd+L"}').action).toEqual({ type: "key", keys: ["cmd", "l"] });
    expect(parseDecision('{"thought":"t","risky":"false","action":{"type":"hotkey","keys":["Command","ArrowDown"]}}')).toEqual({ thought: "t", risky: false, action: { type: "key", keys: ["command", "down"] } });
    expect(parseDecision('{"action":{"type":"click","x":"500","y":"12.6"}}').action).toEqual({ type: "click", x: 500, y: 13, button: "left", clicks: 1 });
    expect(parseDecision('{"risky":"true","action":{"type":"type","text":"hi"}}').risky).toBe(true);
    expect(parseDecision('{"reasoning":"r","action":{"type":"scroll","direction":"down","amount":40}}')).toEqual({ thought: "r", risky: false, action: { type: "scroll", dy: 15 } });
  });
  it("trims an over-long thought or summary instead of rejecting the whole step", () => {
    const r = parseDecision(JSON.stringify({ thought: "x".repeat(5000), action: { type: "done", summary: "y".repeat(3000) } }));
    expect(r.thought.length).toBe(1200);
    expect((r.action as any).summary.length).toBe(1000);
  });
  it("stays strict on safety limits, with a message the model can act on", () => {
    const msg = (raw: string) => { try { parseDecision(raw); return ""; } catch (e) { expect(e).toBeInstanceOf(BadDecision); return (e as Error).message; } };
    expect(msg('{"action":{"type":"click","x":1050,"y":60}}')).toMatch(/0\.\.1000 grid.*not pixels/);
    expect(msg('{"action":{"type":"shell","cmd":"ls"}}')).toMatch(/Unknown action type/);
    expect(msg('{"action":{"type":"key","keys":["cmd","power"]}}')).toMatch(/keys/);
    expect(msg(`{"action":{"type":"type","text":"${"x".repeat(501)}"}}`)).toMatch(/text/);
    expect(msg('{"thought":"I will click the address bar at')).toMatch(/cut off|unterminated/);
    expect(msg("Safari is open.")).toMatch(/no JSON/);
    expect(msg("")).toMatch(/no JSON/);
  });
});

describe("@computer retry turn and provider request", () => {
  const input: DecideInput = { task: "look up the news", history: ["1. press cmd+space -> ok"], step: 4, maxSteps: 25, image: "AAAA", width: 1440, height: 900 };
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.PROVIDER_API_KEY; });

  it("first call is system + user(text+image) and tells the model to use the grid, not pixels", () => {
    const m = buildMessages(input) as any[];
    expect(m.map((x) => x.role)).toEqual(["system", "user"]);
    expect(m[1].content[0].text).toMatch(/1440x900 pixels, but give every coordinate on the 0\.\.1000 grid/);
  });
  it("a retry is a follow-up turn: the bad reply as assistant, then the exact problem", () => {
    const m = buildMessages({ ...input, previous: { reply: '{"action":{"type":"click","x":1050', error: "cut off", truncated: true } }) as any[];
    expect(m.map((x) => x.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(m[2].content).toContain('"x":1050');
    expect(m[3].content).toMatch(/could not be used: cut off/);
    expect(m[3].content).toMatch(/under 20 words/);
    expect(m[3].content).toMatch(/exactly ONE JSON object/);
  });
  it("sends max_tokens 800 and returns finish_reason; handles array content parts", async () => {
    process.env.PROVIDER_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: [{ type: "text", text: '{"action":' }, { type: "text", text: '{"type":"wait","ms":500}}' }] }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await visionDecider(input, new AbortController().signal);
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.max_tokens).toBe(MAX_COMPLETION_TOKENS);
    expect(MAX_COMPLETION_TOKENS).toBe(800);
    expect(body.model).toBe("test-vision-model");
    expect(out).toMatchObject({ raw: '{"action":{"type":"wait","ms":500}}', finishReason: "stop", promptTokens: 10, completionTokens: 5 });
    expect(parseDecision(out.raw).action).toEqual({ type: "wait", ms: 500 });
  });
});

/* The failing run from Nov 19: three good steps, then a bad reply at step 4. Now it recovers. */
describe("@computer agent recovers from an unusable reply", () => {
  function hub() {
    const acts: any[] = [];
    const h: HubClient = {
      async call(path: string, body?: any) {
        if (path === "/command" && body.op === "screenshot") return { status: 200, body: { ok: true, result: { image: "AAAA", width: 1440, height: 900 } } as any };
        if (path === "/command" && body.op === "act") acts.push(body.action);
        if (path === "/run/check") return { status: 200, body: { stopRequested: false } as any };
        return { status: 200, body: { ok: true, result: {} } as any };
      },
    };
    return { h, acts };
  }
  it("feeds the pixel-coordinate error back and runs the corrected action", async () => {
    const replies: DecideOutput[] = [
      { raw: '{"thought":"spotlight","action":{"type":"key","keys":["cmd","space"]}}', promptTokens: 1, completionTokens: 1 },
      { raw: '{"thought":"type","action":{"type":"type","text":"Safari"}}', promptTokens: 1, completionTokens: 1 },
      { raw: '{"thought":"open","action":{"type":"key","keys":["enter"]}}', promptTokens: 1, completionTokens: 1 },
      { raw: 'Safari is open. {"thought":"click the address bar","action":{"type":"click","x":1010,"y":54}}', promptTokens: 1, completionTokens: 1, finishReason: "stop" },
      { raw: '{"thought":"click the address bar","action":{"type":"click","x":708,"y":41}}', promptTokens: 1, completionTokens: 1 },
      { raw: '{"thought":"done","action":{"type":"done","summary":"ok"}}', promptTokens: 1, completionTokens: 1 },
    ];
    const seen: DecideInput[] = [];
    let i = 0;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { h, acts } = hub();
    const events: AgentEvent[] = [];
    const summary = await runComputerTask({ runId: "r", task: "open up and look up the current news", hub: h, decide: async (x) => { seen.push(x); return replies[i++]; }, model: "test-vision-model", maxSteps: 25, signal: new AbortController().signal, emit: (e) => events.push(e) });
    expect(summary.outcome).toBe("done");
    expect(acts.at(-1)).toEqual({ type: "click", x: 708, y: 41, button: "left", clicks: 1 });
    expect(seen[4].previous?.error).toMatch(/"x" was outside 0\.\.1000/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][1])).toMatch(/"step":4/);
    warn.mockRestore();
  });
  it("flags a token-capped reply as truncated in the retry", async () => {
    const seen: DecideInput[] = [];
    const replies: DecideOutput[] = [
      { raw: '{"thought":"' + "long ".repeat(50), promptTokens: 1, completionTokens: 800, finishReason: "length" },
      { raw: '{"thought":"t","action":{"type":"done","summary":"ok"}}', promptTokens: 1, completionTokens: 1 },
    ];
    let i = 0;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { h } = hub();
    const summary = await runComputerTask({ runId: "r", task: "x", hub: h, decide: async (x) => { seen.push(x); return replies[i++]; }, model: "test-vision-model", maxSteps: 5, signal: new AbortController().signal, emit: () => {} });
    expect(summary.outcome).toBe("done");
    expect(seen[1].previous).toMatchObject({ truncated: true, error: expect.stringMatching(/output-token limit/) });
    warn.mockRestore();
  });
  it("never logs typed text", () => {
    const r = redactReply('{"thought":"t","action":{"type":"type","text":"my secret note"}}');
    expect(r).not.toContain("my secret note");
    expect(r).toContain('"text":"<14 chars>"');
  });
});

/* 2026-11-19 ~1:32 PM CT: "@computer find my codex icon on dashboard and open it" failed 3x with
   Invalid "x": expected number, received array — the model put the pair in x. */
describe("@computer coordinate pairs in the wrong field", () => {
  const c = (x: number, y: number) => ({ type: "click", x, y, button: "left", clicks: 1 });
  it("splits a pair in x (with y missing, equal, duplicated, or as a pair too)", () => {
    expect(parseDecision('{"action":{"type":"click","x":[512,880]}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","x":[512,880],"y":880}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","x":[512,880],"y":[512,880]}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","x":["512","880"]}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","y":[512,880]}}').action).toEqual(c(512, 880));
  });
  it("accepts coordinate / point / position arrays, strings, objects and boxes", () => {
    expect(parseDecision('{"action":{"type":"click","coordinate":[512,880]}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","point":[512,880]}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","position":{"x":512,"y":880}}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","x":"[512, 880]"}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","coordinate":"(512, 880)"}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"click","bbox_2d":[500,870,524,890]}}').action).toEqual(c(512, 880));
    expect(parseDecision('{"action":{"type":"move","x":[10,20]}}').action).toEqual({ type: "move", x: 10, y: 20 });
    expect(parseDecision('{"action":{"type":"drag","x":[10,20],"toX":[30,40]}}').action).toEqual({ type: "drag", x: 10, y: 20, toX: 30, toY: 40 });
    expect(parseDecision('{"action":{"type":"scroll","x":[500,500],"dy":3}}').action).toEqual({ type: "scroll", x: 500, y: 500, dy: 3 });
  });
  it("keeps the 0..1000 bounds and refuses to guess on conflicts", () => {
    const msg = (raw: string) => { try { parseDecision(raw); return ""; } catch (e) { return (e as Error).message; } };
    expect(msg('{"action":{"type":"click","x":[1200,880]}}')).toMatch(/outside 0\.\.1000/);
    expect(msg('{"action":{"type":"click","coordinate":[512,1880]}}')).toMatch(/"y" was outside 0\.\.1000/);
    expect(msg('{"action":{"type":"click","x":[512,880],"y":300}}')).toMatch(/two separate numbers/);
    expect(msg('{"action":{"type":"click","x":[1,2,3]}}')).toMatch(/two separate numbers/);
    expect(msg('{"action":{"type":"click","x":"left side"}}')).toMatch(/two separate numbers/);
  });
});
