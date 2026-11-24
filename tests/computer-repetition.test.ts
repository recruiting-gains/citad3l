import { describe, it, expect } from "vitest";
import type { Action } from "@/lib/computer/actions";
import { isWindowAction, repetitionStop, similarAction, taskAllowsWindowActions, REPEAT_STOP_MESSAGE } from "@/lib/computer/repetition";
import { runComputerTask, type AgentEvent } from "@/lib/computer/agent";
import { SYSTEM_PROMPT, type DecideOutput } from "@/lib/computer/model";
import type { HubClient } from "@/lib/computer/hub-client";

const key = (...keys: string[]): Action => ({ type: "key", keys });
const click = (x: number, y: number): Action => ({ type: "click", x, y, button: "left", clicks: 1 });
const scroll = (dy: number, x = 509, y = 808): Action => ({ type: "scroll", dy, x, y });

describe("@computer repetition rules", () => {
  it("same keys (any order/alias) and nearly the same spot count as the same action", () => {
    expect(similarAction(key("cmd", "l"), key("command", "l"))).toBe(true);
    expect(similarAction(key("cmd", "l"), key("cmd", "t"))).toBe(false);
    expect(similarAction(click(509, 808), click(520, 800))).toBe(true);
    expect(similarAction(click(509, 808), click(560, 808))).toBe(false);
    expect(similarAction(scroll(-10), scroll(-5, 512, 812))).toBe(true);
    expect(similarAction(scroll(-10), scroll(10))).toBe(false);
    expect(similarAction({ type: "type", text: "gmail.com" }, { type: "type", text: "gmail.com" })).toBe(true);
  });
  it("stops on the 3rd identical action, not before", () => {
    expect(repetitionStop([], click(509, 808))).toBeNull();
    expect(repetitionStop([click(509, 808)], click(509, 808))).toBeNull();
    expect(repetitionStop([click(509, 808), click(511, 806)], click(509, 808))).toBe(REPEAT_STOP_MESSAGE);
    expect(repetitionStop([click(1, 1), key("cmd", "l"), click(1, 1)], click(1, 1))).toBeNull(); // not in a row
  });
  it("scrolling gets one more step (4th in a row stops)", () => {
    expect(repetitionStop([scroll(-10), scroll(-10)], scroll(-10))).toBeNull();
    expect(repetitionStop([scroll(-10), scroll(-10), scroll(-10)], scroll(-10))).toBe(REPEAT_STOP_MESSAGE);
  });
  it("minimize/hide/quit shortcuts stop on the 2nd in a row, as one family", () => {
    for (const k of [["cmd", "m"], ["cmd", "h"], ["cmd", "q"], ["cmd", "option", "h"]]) expect(isWindowAction(key(...k)), k.join("+")).toBe(true);
    expect(isWindowAction(key("cmd", "space"))).toBe(false);
    expect(isWindowAction(key("m"))).toBe(false);
    expect(repetitionStop([key("cmd", "m")], key("cmd", "m"))).toBe(REPEAT_STOP_MESSAGE);
    expect(repetitionStop([key("cmd", "m")], key("cmd", "h"))).toBe(REPEAT_STOP_MESSAGE);
  });
  it("window shortcuts only when the task explicitly asks", () => {
    expect(taskAllowsWindowActions("find my chatgpt icon on my desktop and open it please")).toBe(false);
    expect(taskAllowsWindowActions("minimize all my windows")).toBe(true);
    expect(taskAllowsWindowActions("hide Slack")).toBe(true);
    expect(taskAllowsWindowActions("quit Safari")).toBe(true);
  });
  it("the prompt prefers Spotlight for apps and forbids cmd+m/h/q unless asked", () => {
    expect(SYSTEM_PROMPT).toMatch(/To open an app \(including one on the desktop or in the Dock\), prefer Spotlight/);
    expect(SYSTEM_PROMPT).toMatch(/Never use cmd\+m \(minimize\), cmd\+h \(hide\) or cmd\+q \(quit\) unless/);
    expect(SYSTEM_PROMPT).toMatch(/Repeating the same action ends the task/);
  });
});

/* Replays of the 1:44 PM CT loop ("find my chatgpt icon on my desktop"): cmd+m ×9, cmd+h ×6, scroll ×5. */
function harness(replies: object[], task = "find my chatgpt icon on my desktop and open it please") {
  const acts: any[] = [];
  const hub: HubClient = {
    async call(path: string, body?: any) {
      if (path === "/command" && body.op === "screenshot") return { status: 200, body: { ok: true, result: { image: "AAAA", width: 1440, height: 900 } } as any };
      if (path === "/command" && body.op === "act") acts.push(body.action);
      if (path === "/run/check") return { status: 200, body: { stopRequested: false } as any };
      return { status: 200, body: { ok: true, result: {} } as any };
    },
  };
  let i = 0;
  const seen: any[] = [];
  const decide = async (x: any): Promise<DecideOutput> => { seen.push(x); return { raw: JSON.stringify({ thought: "t", action: replies[Math.min(i++, replies.length - 1)] }), promptTokens: 1, completionTokens: 1 }; };
  const events: AgentEvent[] = [];
  return runComputerTask({ runId: "r", task, hub, decide, model: "test-vision-model", maxSteps: 25, signal: new AbortController().signal, emit: (e) => events.push(e) }).then((summary) => ({ summary, events, acts, seen }));
}

describe("@computer agent loop guard", () => {
  it("cmd+m is refused (never sent to the Mac) and a 2nd one stops the run", async () => {
    const { summary, events, acts, seen } = await harness([{ type: "key", keys: ["cmd", "m"] }]);
    expect(acts).toEqual([]);
    expect(summary.outcome).toBe("stopped");
    expect((events.at(-1) as any).reason).toBe(REPEAT_STOP_MESSAGE);
    expect(seen[1].history.at(-1)).toMatch(/refused .*Spotlight/);
    expect(summary.actions[0]).toBe("refused window shortcut: press cmd+m");
  });
  it("cmd+m is allowed once when the task asks, but repeating it still stops", async () => {
    const { summary, acts } = await harness([{ type: "key", keys: ["cmd", "m"] }], "minimize this window");
    expect(acts).toEqual([{ type: "key", keys: ["cmd", "m"] }]);
    expect(summary.outcome).toBe("stopped");
  });
  it("the same click 3 times in a row runs twice, then stops before the 3rd", async () => {
    const { summary, events, acts } = await harness([{ type: "click", x: 509, y: 808 }, { type: "click", x: 512, y: 805 }, { type: "click", x: 509, y: 808 }]);
    expect(acts.length).toBe(2);
    expect(summary.outcome).toBe("stopped");
    expect((events.at(-1) as any).reason).toBe("Stopped: the same action kept repeating without progress.");
  });
  it("the scroll loop stops after 3 scrolls", async () => {
    const { summary, acts } = await harness([{ type: "scroll", dy: -10, x: 509, y: 808 }]);
    expect(acts.length).toBe(3);
    expect(summary.outcome).toBe("stopped");
  });
  it("normal progress (Spotlight → type → enter → done) is untouched", async () => {
    const { summary, acts } = await harness([{ type: "key", keys: ["cmd", "space"] }, { type: "type", text: "ChatGPT" }, { type: "key", keys: ["enter"] }, { type: "done", summary: "Opened ChatGPT" }]);
    expect(summary.outcome).toBe("done");
    expect(acts.length).toBe(3);
  });
});

/* 2:20 PM CT on 911d773b: "@computer take over and open up notes on desktop". The model wanted
   {"type":"doubleClick"} on the icon at (625,399), was told the type wasn't allowed, then single-clicked 12x. */
import { parseDecision } from "@/lib/computer/actions";
describe("@computer double-click", () => {
  const dbl = { type: "click", x: 625, y: 399, button: "left", clicks: 2 };
  it("accepts doubleClick / double_click / dblclick / double-click / clicks:2", () => {
    for (const t of ["doubleClick", "double_click", "dblclick", "double-click", "DoubleClick", "double click"]) {
      expect(parseDecision(JSON.stringify({ thought: "open it", action: { type: t, x: 625, y: 399 } })).action, t).toEqual(dbl);
    }
    expect(parseDecision('{"action":{"type":"click","x":625,"y":399,"clicks":2}}').action).toEqual(dbl);
    expect(parseDecision('{"action":{"type":"click","x":625,"y":399,"clicks":"2"}}').action).toEqual(dbl);
    expect(parseDecision('{"action":"doubleClick","coordinate":[625,399]}').action).toEqual(dbl);
  });
  it("typed text can't carry newlines/tabs (they'd submit or move focus without the confirm gate)", () => {
    expect(() => parseDecision('{"action":{"type":"type","text":"hello\\nworld"}}')).toThrow(/no newlines, tabs/);
    expect(parseDecision('{"action":{"type":"type","text":"gmail.com"}}').action).toEqual({ type: "type", text: "gmail.com" });
  });
  it("the prompt says the Citad3L window and its step log are not targets or guidance", () => {
    expect(SYSTEM_PROMPT).toMatch(/Citad3L chat window .* is the control panel. It is not a target/);
  });
  it("right double-click is refused (a context menu would catch the 2nd click)", () => {
    expect(() => parseDecision('{"action":{"type":"click","x":1,"y":1,"button":"right","clicks":2}}')).toThrow(/Right double-click/);
  });
  it("the prompt lists double_click and says desktop icons need it", () => {
    expect(SYSTEM_PROMPT).toContain('{"type":"double_click","x":N,"y":N}');
    expect(SYSTEM_PROMPT).toMatch(/Desktop and Finder icons open with a DOUBLE-click/);
    expect(SYSTEM_PROMPT).toMatch(/prefer Spotlight/);
  });
  it("the double-click reaches the helper as clicks: 2", async () => {
    const { summary, acts } = await harness([{ type: "doubleClick", x: 625, y: 399 }, { type: "done", summary: "Opened Notes" }], "take over and open up notes on desktop");
    expect(summary.outcome).toBe("done");
    expect(acts).toEqual([dbl]);
  });
  it("replay: the same single click at (625,399) runs twice and the run stops before the 3rd", async () => {
    const { summary, events, acts } = await harness([{ type: "click", x: 625, y: 399 }], "take over and open up notes on desktop");
    expect(acts).toEqual([{ ...dbl, clicks: 1 }, { ...dbl, clicks: 1 }]);
    expect(summary.outcome).toBe("stopped");
    expect((events.at(-1) as any).reason).toBe("Stopped: the same action kept repeating without progress.");
  });
  it("a single click then a double-click on the same icon is progress, not a repeat", async () => {
    const { summary, acts } = await harness([{ type: "click", x: 625, y: 399 }, { type: "click", x: 625, y: 399 }, { type: "double_click", x: 625, y: 399 }, { type: "done", summary: "ok" }], "open notes on desktop");
    expect(summary.outcome).toBe("done");
    expect(acts.at(-1)).toEqual(dbl);
  });
});

/* Follow-ups from a second-opinion review. */
import { taskAllowsWindowAction } from "@/lib/computer/repetition";
describe("@computer guard hardening (second-opinion review)", () => {
  it("permission is per shortcut, and negated wording never unlocks it", () => {
    expect(taskAllowsWindowAction("minimize this window", key("cmd", "m"))).toBe(true);
    expect(taskAllowsWindowAction("minimize this window", key("cmd", "q"))).toBe(false); // minimize ≠ quit
    expect(taskAllowsWindowAction("quit Safari", key("cmd", "q"))).toBe(true);
    expect(taskAllowsWindowAction("do not quit Safari, just open a tab", key("cmd", "q"))).toBe(false);
    expect(taskAllowsWindowAction("don't hide anything", key("cmd", "h"))).toBe(false);
  });
  it("logout / lock chords are never unlocked, even if the task says quit", () => {
    expect(isWindowAction(key("cmd", "shift", "q"))).toBe(true);
    expect(taskAllowsWindowAction("quit everything", key("cmd", "shift", "q"))).toBe(false);
    expect(taskAllowsWindowAction("quit everything", key("cmd", "option", "shift", "q"))).toBe(false);
    expect(taskAllowsWindowAction("quit everything", key("ctrl", "cmd", "q"))).toBe(false);
  });
  it("waits and moves between identical clicks don't reset the count", () => {
    const w: Action = { type: "wait", ms: 500 };
    const mv: Action = { type: "move", x: 10, y: 10 };
    expect(repetitionStop([click(625, 399), w, click(625, 399), mv], click(625, 399))).toBe(REPEAT_STOP_MESSAGE);
    expect(repetitionStop([click(625, 399), key("cmd", "l"), click(625, 399)], click(625, 399))).toBeNull();
  });
  it("a 2nd minimize/hide/quit stops the run even with other actions in between", () => {
    expect(repetitionStop([key("cmd", "m"), scroll(-3)], key("cmd", "h"))).toBe(REPEAT_STOP_MESSAGE);
  });
  it("refused cmd+shift+q never reaches the Mac", async () => {
    const { acts, summary } = await harness([{ type: "key", keys: ["cmd", "shift", "q"] }], "quit everything");
    expect(acts).toEqual([]);
    expect(summary.outcome).toBe("stopped");
  });
});
