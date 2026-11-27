import { describe, expect, it } from "vitest";
import { DESIGN_CHECK_MAX_MS, DISCONNECT_GRACE_MS, HEARTBEAT_MS, keepReplyAlive, timeoutSignal } from "@/lib/reply-lifeline";

describe("reply lifeline", () => {
  it("bounds the disconnect grace and keeps the heartbeat well under the app's 35 s stall limit", () => {
    expect(DISCONNECT_GRACE_MS).toBeLessThanOrEqual(120_000);
    expect(HEARTBEAT_MS).toBeLessThanOrEqual(15_000);
    expect(DESIGN_CHECK_MAX_MS).toBeLessThan(DISCONNECT_GRACE_MS);
  });

  it("timeoutSignal fires on timeout", async () => {
    const parent = new AbortController();
    const t = timeoutSignal(parent.signal, 20);
    expect(t.signal.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(t.signal.aborted).toBe(true);
    t.clear();
  });

  it("timeoutSignal follows the parent and can be cleared", async () => {
    const parent = new AbortController();
    const t = timeoutSignal(parent.signal, 1_000);
    parent.abort();
    expect(t.signal.aborted).toBe(true);
    const p2 = new AbortController();
    const t2 = timeoutSignal(p2.signal, 20);
    t2.clear();
    await new Promise((r) => setTimeout(r, 40));
    expect(t2.signal.aborted).toBe(false);
  });

  it("keepReplyAlive is a no-op off Workers", async () => {
    expect(await keepReplyAlive(Promise.resolve())).toBe(false);
  });
});
