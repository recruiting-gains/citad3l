import { describe, it, expect } from "vitest";
import type { Action } from "@/lib/computer/actions";
import { readFileSync } from "node:fs";
import { assessRisk, hardDeny } from "@/lib/computer/risk";
import { readAutoApprove } from "@/lib/computer/settings";
import { repetitionStop, WAIT_STOP_MESSAGE, WAIT_REPEAT_LIMIT } from "@/lib/computer/repetition";
import { runComputerTask, type AgentEvent } from "@/lib/computer/agent";
import { AUTO_SYSTEM_PROMPT, buildMessages, SYSTEM_PROMPT, systemPromptFor, type DecideOutput } from "@/lib/computer/model";
import type { HubClient } from "@/lib/computer/hub-client";

const auto = (action: object, thought = "", risky = false) => assessRisk({ thought, risky, action } as any, "t", { autoApprove: true }).risky;
const strict = (action: object, thought = "", risky = false) => assessRisk({ thought, risky, action } as any, "t").risky;
const enter = { type: "key", keys: ["enter"] };

describe("@computer auto-approve after the pre-deploy review: the model's flag and every heuristic still win", () => {
  it("ordinary steps run without a pause when ON and the model doesn't flag them", () => {
    expect(auto(enter, "Press enter to launch Safari from Spotlight")).toBe(false);
    expect(auto(enter, "Press enter to open the page in the address bar")).toBe(false);
    expect(auto({ type: "click", x: 1, y: 1, button: "left", clicks: 2 }, "Double-click the Notes icon to open it")).toBe(false);
    expect(auto({ type: "type", text: "safari" }, "Type the app name")).toBe(false);
    expect(auto({ type: "type", text: "citad3l.io" }, "Type the address")).toBe(false);
    expect(auto({ type: "key", keys: ["cmd", "space"] }, "Open Spotlight")).toBe(false);
    expect(auto({ type: "key", keys: ["cmd", "t"] }, "New tab")).toBe(false);
    expect(auto({ type: "scroll", dy: 5 }, "scroll down")).toBe(false);
    expect(auto({ type: "wait", ms: 2500 }, "Safari is launching")).toBe(false);
  });
  it("a step the model flags ALWAYS pauses, even with auto-approve ON (blocker 1)", () => {
    expect(auto(enter, "Press enter to launch Safari from Spotlight", true)).toBe(true);
    expect(auto({ type: "click", x: 1, y: 1, button: "left", clicks: 2 }, "Double-click the Notes icon to open it", true)).toBe(true);
    expect(auto({ type: "type", text: "safari" }, "Type the app name", true)).toBe(true);
    expect(strict(enter, "Press enter to launch Safari from Spotlight", true)).toBe(true);
  });
  it("pauses sends/posts, deletes/trash, forms, purchases, uploads, drags, system settings and destructive commands", () => {
    for (const [action, thought] of [
      [{ type: "click", x: 1, y: 1 }, "Click Send to email Bob"],
      [enter, "Press enter to send the message"],
      [{ type: "click", x: 1, y: 1 }, "Click the Post button"],
      [{ type: "click", x: 1, y: 1 }, "Move the file to Trash"],
      [{ type: "click", x: 1, y: 1 }, "Click Empty Bin"],
      [{ type: "click", x: 1, y: 1 }, "Click Delete"],
      [{ type: "click", x: 1, y: 1 }, "Press Place order"],
      [{ type: "click", x: 1, y: 1 }, "Click Buy now"],
      [{ type: "click", x: 1, y: 1 }, "Click the password field"],
      [{ type: "click", x: 1, y: 1 }, "Open Privacy & Security to grant access"],
      [{ type: "click", x: 1, y: 1 }, "Click Accept on the terms"],
      [{ type: "click", x: 1, y: 1 }, "Click Upload"],
      [{ type: "click", x: 1, y: 1 }, "Click the Download button"],
      [{ type: "click", x: 1, y: 1 }, "Open System Settings"],
      [enter, "Press enter"], // Enter with no launch/search/address-bar context could submit a form
      [enter, "Press enter to finish the form"],
      [{ type: "drag", x: 1, y: 1, toX: 2, toY: 2 }, "Drag the file to the folder"],
      [{ type: "key", keys: ["cmd", "enter"] }, ""],
      [{ type: "key", keys: ["cmd", "backspace"] }, ""],
      [{ type: "key", keys: ["cmd", "delete"] }, ""],
      [{ type: "key", keys: ["option", "backspace"] }, "clear the field"],
      [{ type: "type", text: "sudo rm -rf ~/Documents" }, ""],
      [{ type: "type", text: "how to delete cookies" }, "Search the web"],
    ] as const) expect(auto(action, thought), `${thought} ${JSON.stringify(action)}`).toBe(true);
  });
  it("logout/lock/shutdown and typing secrets are refused outright, even after Confirm", () => {
    const d = (action: object, thought = "") => hardDeny({ thought, risky: false, action } as any);
    expect(d({ type: "key", keys: ["shift", "cmd", "q"] })).toMatch(/never/);
    expect(d({ type: "key", keys: ["ctrl", "cmd", "q"] })).toMatch(/never/);
    expect(d({ type: "click", x: 1, y: 1 }, "Click Log Out")).toMatch(/never/);
    expect(d({ type: "click", x: 1, y: 1 }, "Click Shut Down")).toMatch(/never/);
    expect(d({ type: "type", text: "hunter2" }, "Type the password")).toMatch(/Type them yourself/);
    expect(d({ type: "type", text: "4111 1111" }, "Enter the card number")).toMatch(/Type them yourself/);
    expect(d({ type: "type", text: "safari" }, "Type the app name")).toBeNull();
  });
  it("prompt: strict (original rule) when OFF or unknown; the auto prompt still demands risky flags", () => {
    expect(SYSTEM_PROMPT).not.toMatch(/approved ordinary steps|Auto-approve is on/);
    expect(SYSTEM_PROMPT).toMatch(/Set "risky": true for ANY step that sends, posts, submits, buys/);
    expect(systemPromptFor(false)).toBe(SYSTEM_PROMPT);
    expect(systemPromptFor(undefined)).toBe(SYSTEM_PROMPT);
    expect(systemPromptFor(true)).toBe(AUTO_SYSTEM_PROMPT);
    expect(AUTO_SYSTEM_PROMPT).toMatch(/Auto-approve is on/);
    expect(AUTO_SYSTEM_PROMPT).toMatch(/Every step you flag still waits for the owner/);
    for (const p of [SYSTEM_PROMPT, AUTO_SYSTEM_PROMPT]) expect(p).toMatch(/ONE longer wait/);
    expect(buildMessages({ task: "t", history: [], step: 1, maxSteps: 5, image: "A", width: 1, height: 1 })[0].content).toBe(SYSTEM_PROMPT);
    expect(buildMessages({ autoApprove: true, task: "t", history: [], step: 1, maxSteps: 5, image: "A", width: 1, height: 1 })[0].content).toBe(AUTO_SYSTEM_PROMPT);
  });
});

describe("auto-approve setting: default OFF, fail closed (blocker 2)", () => {
  const hub = (status: number, body: any) => ({ call: async () => ({ status, body }) }) as any;
  it("only a successful read of the boolean true is ON", async () => {
    expect(await readAutoApprove(hub(200, { autoApprove: true }))).toEqual({ ok: true, autoApprove: true });
    expect(await readAutoApprove(hub(200, { autoApprove: false }))).toEqual({ ok: true, autoApprove: false });
    for (const [status, body] of [[200, {}], [200, null], [200, { autoApprove: "true" }], [200, { autoApprove: 1 }], [500, { autoApprove: true }], [404, {}]] as const) {
      expect(await readAutoApprove(hub(status, body)), JSON.stringify([status, body])).toEqual({ ok: false, autoApprove: false });
    }
    expect(await readAutoApprove({ call: async () => { throw new Error("down"); } } as any)).toEqual({ ok: false, autoApprove: false });
  });
  it("the hub stores nothing → OFF; only an explicit true is ON", () => {
    const src = readFileSync(new URL("../worker/computer-hub.js", import.meta.url), "utf8");
    expect(src).toContain("autoApprove: st.autoApprove === true");
    expect(src).not.toContain("st.autoApprove !== false");
  });
  it("run route and settings route use the fail-closed reader; panel shows 'unavailable', refreshes on focus, says new runs", () => {
    const run = readFileSync(new URL("../app/api/computer/run/route.ts", import.meta.url), "utf8");
    const set = readFileSync(new URL("../app/api/computer/settings/route.ts", import.meta.url), "utf8");
    const panel = readFileSync(new URL("../components/admin/ComputerPanel.tsx", import.meta.url), "utf8");
    expect(run).toContain("await readAutoApprove(c.hub)");
    expect(run).not.toMatch(/autoApprove !== false/);
    expect(set).toMatch(/if \(!s\.ok\) return jerr\(502, "unavailable"/);
    expect(panel).toMatch(/Auto-approve: unavailable/);
    expect(panel).toMatch(/addEventListener\("focus"/);
    expect(panel).toMatch(/Applies to new runs/);
  });
  it("agent passes the setting to the model and refuses hard-denied steps without acting", async () => {
    const acts: any[] = [];
    const seen: (boolean | undefined)[] = [];
    const hubc: HubClient = {
      async call(path: string, body?: any) {
        if (path === "/command" && body.op === "screenshot") return { status: 200, body: { ok: true, result: { image: "AAAA", width: 1440, height: 900 } } as any };
        if (path === "/command" && body.op === "act") acts.push(body.action);
        if (path === "/run/check") return { status: 200, body: { stopRequested: false } as any };
        return { status: 200, body: { ok: true, result: {} } as any };
      },
    };
    const replies = [
      { thought: "Click Log Out", action: { type: "click", x: 5, y: 5 } },
      { thought: "done", action: { type: "done", summary: "x" } },
    ];
    let i = 0;
    const decide = async (inp: any): Promise<DecideOutput> => { seen.push(inp.autoApprove); return { raw: JSON.stringify(replies[Math.min(i++, 1)]), promptTokens: 1, completionTokens: 1 }; };
    const events: AgentEvent[] = [];
    await runComputerTask({ runId: "r", task: "tidy up", hub: hubc, decide, model: "test-vision-model", maxSteps: 5, signal: new AbortController().signal, emit: (e) => events.push(e) });
    expect(seen.every((v) => v === false)).toBe(true); // default OFF
    expect(acts).toEqual([]);
    expect(events.some((e) => e.type === "result" && !e.ok && /never/.test((e as any).error))).toBe(true);
  });
});

const wait = (ms: number): Action => ({ type: "wait", ms });
describe("@computer waits don't trip the repeat stop (Safari launch replay)", () => {
  it("enter → wait 1000 → wait 1000 → wait … is fine up to 5 waits / 10 s", () => {
    const k: Action = { type: "key", keys: ["enter"] };
    expect(repetitionStop([k, wait(1000)], wait(1000))).toBeNull();
    expect(repetitionStop([k, wait(1000), wait(1000), wait(1000), wait(1000), wait(1000)], wait(1000))).toBe(WAIT_STOP_MESSAGE); // 6th
    expect(repetitionStop([k, wait(1000), wait(1000), wait(1000), wait(1000)], wait(1000))).toBeNull(); // 5th
    expect(repetitionStop([wait(5000)], wait(5000))).toBeNull(); // 10 s
    expect(repetitionStop([wait(5000), wait(5000)], wait(500))).toBe(WAIT_STOP_MESSAGE); // > 10 s
    expect(WAIT_REPEAT_LIMIT).toBe(5);
  });
  it("agent: enter, wait, wait, then done runs to the end", async () => {
    const acts: any[] = [];
    const hub: HubClient = {
      async call(path: string, body?: any) {
        if (path === "/command" && body.op === "screenshot") return { status: 200, body: { ok: true, result: { image: "AAAA", width: 1440, height: 900 } } as any };
        if (path === "/command" && body.op === "act") acts.push(body.action);
        if (path === "/run/check") return { status: 200, body: { stopRequested: false } as any };
        if (path === "/pending/put") return { status: 200, body: { expiresAt: 1 } as any };
        return { status: 200, body: { ok: true, result: {} } as any };
      },
    };
    const replies = [
      { thought: "Open Spotlight", action: { type: "key", keys: ["cmd", "space"] } },
      { thought: "Type the app name", action: { type: "type", text: "safari" } },
      { thought: "Press enter to launch Safari", action: { type: "key", keys: ["enter"] } },
      { thought: "Safari is launching", action: { type: "wait", ms: 1000 } },
      { thought: "Still launching", action: { type: "wait", ms: 1000 } },
      { thought: "Still launching", action: { type: "wait", ms: 1000 } },
      { thought: "Safari is open", action: { type: "done", summary: "Opened Safari" } },
    ];
    let i = 0;
    const decide = async (): Promise<DecideOutput> => ({ raw: JSON.stringify(replies[Math.min(i++, replies.length - 1)]), promptTokens: 1, completionTokens: 1 });
    const events: AgentEvent[] = [];
    const summary = await runComputerTask({ runId: "r", task: "open safari", hub, decide, model: "test-vision-model", maxSteps: 25, signal: new AbortController().signal, emit: (e) => events.push(e), autoApprove: true });
    expect(summary.outcome).toBe("done");
    expect(events.some((e) => e.type === "confirm")).toBe(false);
    expect(acts.filter((a) => a.type === "wait").length).toBe(3);
  });
});
