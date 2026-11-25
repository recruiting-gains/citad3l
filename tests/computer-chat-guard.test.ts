import { describe, it, expect, vi, beforeEach } from "vitest";
import { computerChatRefusal, planRetry, rerouteFromChatError, routeOutgoing } from "@/lib/computer/chat-guard";

/* 2026-11-19 1:29 PM CT: Retry on a failed @computer reply went to /api/chat and V1 made up news. Never again. */
describe("@computer never falls through to the chat model (client routing)", () => {
  it("routes @computer to the agent for admins and blocks it with a clear error for everyone else", () => {
    expect(routeOutgoing("@computer open up and look up the current news", true)).toEqual({ kind: "computer" });
    expect(routeOutgoing("  @Computer: open Safari", true)).toEqual({ kind: "computer" });
    const blocked = routeOutgoing("@computer open Safari", false);
    expect(blocked.kind).toBe("blocked");
    expect((blocked as any).message).toMatch(/isn't available/);
  });
  it("a Retry on an @computer reply stays on @computer (the bug)", () => {
    expect(routeOutgoing("@computer open up and look up the current news", true, { retryOfComputerReply: true })).toEqual({ kind: "computer" });
    // even if the paired user text somehow lost its prefix, a tmp-c reply never goes to chat
    expect(routeOutgoing("open up and look up the current news", true, { retryOfComputerReply: true })).toEqual({ kind: "computer" });
    expect(routeOutgoing("open Safari", false, { retryOfComputerReply: true }).kind).toBe("blocked");
  });
  it("leaves ordinary messages alone", () => {
    for (const t of ["what's the news", "email me @computer", "@computers are cool", ""]) expect(routeOutgoing(t, true), t).toEqual({ kind: "chat" });
  });
  it("server refusal text: admin is told how to run it; others get 'not available'", () => {
    expect(computerChatRefusal("hello", true)).toBeNull();
    expect(computerChatRefusal("@computer open Safari", true)).toMatch(/wasn't sent to the chat model/);
    expect(computerChatRefusal("@computer open Safari", false)).toBe("@computer isn't available on this account.");
  });
});

/* 2026-11-19 1:42 PM CT: Retry on the failed codex reply still hit /api/chat (409) from a tab loaded before the deploy. */
describe("Retry plan: any reply to an @computer message re-runs @computer", () => {
  const task = "@computer find my codex icon on dashboard and open it";
  const msgs = [
    { id: "u0", role: "user", content: "hi" },
    { id: "a0", role: "assistant", content: "hello" },
    { id: "tmp-u-1", role: "user", content: task },
    { id: "tmp-c-1", role: "assistant", content: "**@computer** … ⚠️ Invalid x" },
    { id: "u2", role: "user", content: task },
    { id: "a2", role: "assistant", content: "Something went wrong" }, // loaded from history
    { id: "tmp-u-3", role: "user", content: task },
    { id: "tmp-a-3", role: "assistant", content: "" }, // an unsaved chat reply to an @computer message
  ];
  it("admins: unsaved @computer reply, saved reply, and unsaved chat reply all go to @computer with the task", () => {
    for (const id of ["tmp-c-1", "a2", "tmp-a-3"]) expect(planRetry(msgs, id, true), id).toEqual({ kind: "computer", task });
  });
  it("non-admins are blocked with a message, never chat", () => {
    for (const id of ["tmp-c-1", "a2", "tmp-a-3"]) expect(planRetry(msgs, id, false).kind, id).toBe("blocked");
  });
  it("ordinary replies keep the chat retry paths", () => {
    expect(planRetry(msgs, "a0", true)).toEqual({ kind: "chat-saved" });
    expect(planRetry([{ id: "tmp-u-9", role: "user", content: "news?" }, { id: "tmp-a-9", role: "assistant", content: "" }], "tmp-a-9", true)).toEqual({ kind: "chat-unsaved", text: "news?" });
    expect(planRetry(msgs, "missing", true)).toEqual({ kind: "chat-saved" });
  });
});

describe("a 409 computer_command from /api/chat reroutes to @computer for admins", () => {
  const body = (task?: string) => ({ error: { code: "computer_command", message: "That's an @computer task…" }, ...(task ? { task } : {}) });
  it("uses the server's task, else the local text", () => {
    expect(rerouteFromChatError(409, body("@computer open Safari"), "", true)).toBe("@computer open Safari");
    expect(rerouteFromChatError(409, body(), "@computer open Safari", true)).toBe("@computer open Safari");
  });
  it("does nothing for non-admins, other codes/statuses, or non-@computer text", () => {
    expect(rerouteFromChatError(409, body("@computer open Safari"), "", false)).toBeNull();
    expect(rerouteFromChatError(400, body("@computer open Safari"), "", true)).toBeNull();
    expect(rerouteFromChatError(409, { error: { code: "conflict" } }, "@computer x", true)).toBeNull();
    expect(rerouteFromChatError(409, body("open Safari"), "", true)).toBeNull();
    expect(rerouteFromChatError(409, null, "", true)).toBeNull();
  });
});

/* Server: /api/chat refuses "@computer …" for fresh sends AND for retries whose original user message is @computer. */
let userId: string | null = "u-owner";
const provider = vi.fn();
const priorUser = { content: "@computer open up and look up the current news" };
vi.mock("@/auth", () => ({ requireUserId: async () => userId }));
vi.mock("@/lib/banned", () => ({ bannedMessage: async () => null }));
vi.mock("@/lib/ratelimit", () => ({ LIMITS: { chatUserMin: {}, chatUserHour: {} }, rule: () => ({}), rateLimit: () => true, limitDurable: async () => ({ ok: true }) }));
vi.mock("@/lib/usage", () => ({
  userIsAdmin: async (id: string) => id === "u-owner",
  userEmail: async (id: string) => (id === "u-owner" ? "owner@example.test" : null),
  getUsage: async () => ({ plan: "max", admin: true, owner: true }),
  reserve: async () => { throw new Error("must not reserve"); },
  settle: async () => undefined,
  UsageError: class extends Error {},
}));
vi.mock("@/lib/model-settings", () => ({ canUseModelSettings: () => false, getModelSettings: async () => null }));
vi.mock("@/lib/inference", () => ({ getProvider: (...a: unknown[]) => { provider(...a); throw new Error("must not call a model"); }, ProviderUnavailable: class extends Error {} }));
vi.mock("@/lib/filter-llm", () => ({ reviewOrKeyword: async () => ({ allowed: true }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { findFirst: async () => ({ id: "c1", userId: "u-owner", project: null }) },
    message: { findFirst: async (q: any) => (q.where.role === "assistant" ? { id: "a1", createdAt: new Date() } : priorUser), create: async () => { throw new Error("must not persist"); }, update: async () => { throw new Error("must not persist"); } },
  },
}));

describe("/api/chat refuses @computer", () => {
  beforeEach(() => { userId = "u-owner"; provider.mockClear(); });
  const post = async (body: object) => {
    const { POST } = await import("@/app/api/chat/route");
    return POST(new Request("https://citad3l.test/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  };
  it("fresh send from the admin: 409 computer_command with the how-to message, no model call", async () => {
    const r = await post({ message: "@computer open up and look up the current news", model: "citad3l-v1" });
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j.error.code).toBe("computer_command");
    expect(j.error.message).toMatch(/wasn't sent to the chat model/);
    expect(j.task).toBe("@computer open up and look up the current news"); // the client reroutes with this
    expect(provider).not.toHaveBeenCalled();
  });
  it("signed-out and non-admin users get 'not available'", async () => {
    for (const u of [null, "u-customer"]) {
      userId = u;
      const r = await post({ message: "@computer open Safari", model: "citad3l-v1" });
      expect(r.status, String(u)).toBe(409);
      const j = await r.json();
      expect(j.error.message).toBe("@computer isn't available on this account.");
      expect(j.task).toBeUndefined();
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it("Retry of a saved reply whose user message was @computer is refused too", async () => {
    const r = await post({ message: "", model: "citad3l-v1", conversationId: "c1", retryAssistantMessageId: "a1" });
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j.error.code).toBe("computer_command");
    expect(j.task).toBe(priorUser.content);
    expect(provider).not.toHaveBeenCalled();
  });
});
