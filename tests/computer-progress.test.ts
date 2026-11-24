import { describe, it, expect } from "vitest";
import { noVisibleChange, parseSig, SIG_CELLS, STALL_LIMIT } from "@/lib/computer/progress";
import { runComputerTask } from "@/lib/computer/agent";
import type { HubClient } from "@/lib/computer/hub-client";
import type { DecideInput, DecideOutput } from "@/lib/computer/model";

const sig = (fill: number, changes: Record<number, number> = {}) => {
  const b = new Uint8Array(SIG_CELLS).fill(fill);
  for (const [i, v] of Object.entries(changes)) b[Number(i)] = v;
  return Buffer.from(b).toString("hex");
};

describe("@computer progress signature", () => {
  it("parses only well-formed 32x18 hex", () => {
    expect(parseSig(sig(5))?.length).toBe(576);
    for (const bad of [undefined, "", "zz", sig(5).slice(2), 42]) expect(parseSig(bad)).toBeNull();
  });
  it("identical, noise-only or cursor-only differences count as no change; real changes don't", () => {
    expect(noVisibleChange(sig(100), sig(100))).toBe(true);
    expect(noVisibleChange(sig(100), sig(104))).toBe(true); // JPEG noise under the cell threshold
    expect(noVisibleChange(sig(100), sig(100, { 10: 200, 11: 200 }))).toBe(true); // cursor-sized
    expect(noVisibleChange(sig(100), sig(100, { 10: 200, 11: 200, 40: 0, 41: 0 }))).toBe(false);
    expect(noVisibleChange(sig(100), sig(30))).toBe(false); // app opened
    expect(noVisibleChange(undefined, sig(1))).toBe(false); // old helper: skip
  });
});

function harness(replies: object[], sigs: (string | undefined)[]) {
  let shot = 0, i = 0;
  const acts: any[] = [];
  const seen: DecideInput[] = [];
  const hub: HubClient = {
    async call(path: string, body?: any) {
      if (path === "/command" && body.op === "screenshot") {
        const s = sigs[Math.min(shot++, sigs.length - 1)];
        return { status: 200, body: { ok: true, result: { image: "AAAA", width: 1440, height: 936, ...(s ? { sig: s } : {}) } } as any };
      }
      if (path === "/command" && body.op === "act") acts.push(body.action);
      if (path === "/run/check") return { status: 200, body: { stopRequested: false } as any };
      return { status: 200, body: { ok: true, result: {} } as any };
    },
  };
  const decide = async (x: DecideInput): Promise<DecideOutput> => { seen.push(x); return { raw: JSON.stringify({ thought: "t", action: replies[Math.min(i++, replies.length - 1)] }), promptTokens: 1, completionTokens: 1 }; };
  return runComputerTask({ runId: "r", task: "take control and open notes app", hub, decide, model: "test-vision-model", maxSteps: 10, signal: new AbortController().signal, emit: () => {} }).then((summary) => ({ summary, acts, seen }));
}

describe("@computer tells the model when an action had no effect (2:33 PM CT replay)", () => {
  it("a double-click that changes nothing → next decision is told, and it can switch to Spotlight", async () => {
    const { summary, seen, acts } = await harness(
      [{ type: "double_click", x: 633, y: 399 }, { type: "key", keys: ["cmd", "space"] }, { type: "done", summary: "ok" }],
      [sig(100), sig(100), sig(40), sig(40)],
    );
    expect(summary.outcome).toBe("done");
    expect(seen[0].note).toBeUndefined();
    expect(seen[1].note).toMatch(/No visible change was detected.*Spotlight/);
    expect(seen[1].history).toContain("1. (no visible change after that action)");
    expect(seen[2].note).toBeUndefined(); // Spotlight opened: screen changed
    expect(acts.length).toBe(2);
  });
  it("no note when the screen changed, or when the helper sends no signature", async () => {
    const a = await harness([{ type: "click", x: 1, y: 1 }, { type: "done", summary: "ok" }], [sig(100), sig(30)]);
    expect(a.seen[1].note).toBeUndefined();
    const b = await harness([{ type: "click", x: 1, y: 1 }, { type: "done", summary: "ok" }], [undefined]);
    expect(b.seen[1].note).toBeUndefined();
  });
  it("a wait that leaves the screen unchanged is not flagged", async () => {
    const { seen } = await harness([{ type: "wait", ms: 500 }, { type: "done", summary: "ok" }], [sig(100), sig(100)]);
    expect(seen[1].note).toBeUndefined();
  });
});

describe("@computer stops when actions keep changing nothing (2:50 PM CT replay: input silently dropped)", () => {
  const cycle = [
    { type: "double_click", x: 633, y: 399 }, { type: "key", keys: ["cmd", "space"] }, { type: "type", text: "notes" },
    { type: "double_click", x: 633, y: 399 }, { type: "click", x: 633, y: 399 }, { type: "key", keys: ["cmd", "space"] },
    { type: "done", summary: "should not get here" },
  ];
  it("an alternating cycle with a frozen screen ends after STALL_LIMIT actions, before the 5th runs", async () => {
    const { summary, acts } = await harness(cycle, [sig(100)]);
    expect(summary.outcome).toBe("stopped");
    expect(summary.summary).toMatch(/changed nothing on the screen.*Accessibility/);
    expect(acts.length).toBe(STALL_LIMIT);
  });
  it("any visible change resets the count", async () => {
    const sigs = [sig(100), sig(100), sig(100), sig(100), sig(30), sig(30), sig(30), sig(30)];
    const { summary, acts } = await harness(cycle, sigs);
    expect(summary.outcome).toBe("done");
    expect(acts.length).toBe(6);
  });
  it("old helpers without signatures never trip it", async () => {
    const { summary } = await harness(cycle, [undefined]);
    expect(summary.outcome).toBe("done");
  });
});
