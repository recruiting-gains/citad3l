import { isComputerCommand } from "./actions";

/**
 * A message that starts with "@computer" must NEVER reach a chat model: the model can't control the Mac, so it
 * answers "I can't control your computer" and then invents results (seen 2026-11-19 after Retry on a failed run).
 * Returns the error to show instead, or null when the text is an ordinary chat message.
 */
export const COMPUTER_CHAT_CODE = "computer_command";
export function computerChatRefusal(text: string | null | undefined, isAdmin: boolean): string | null {
  if (!text || !isComputerCommand(text)) return null;
  return isAdmin
    ? "That's an @computer task, so it wasn't sent to the chat model. Press Retry on the @computer reply or send it again to run it on your Mac."
    : "@computer isn't available on this account.";
}

/**
 * Client-side routing for an outgoing or retried message. "computer" runs the @computer agent, "blocked" shows the
 * error locally, "chat" goes to /api/chat. A retried @computer reply (ids "tmp-c-…") always stays on @computer.
 */
export type OutgoingRoute = { kind: "chat" } | { kind: "computer" } | { kind: "blocked"; message: string };
export function routeOutgoing(text: string, computerEnabled: boolean, opts: { retryOfComputerReply?: boolean } = {}): OutgoingRoute {
  const isCmd = isComputerCommand(text);
  if (!isCmd && !opts.retryOfComputerReply) return { kind: "chat" };
  if (computerEnabled) return { kind: "computer" };
  return { kind: "blocked", message: computerChatRefusal(isCmd ? text : "@computer", false)! };
}

type Msg = { id: string; role: string; content: string };
/**
 * What Retry on reply `id` should do. Any reply (unsaved "tmp-…" or loaded from history) whose user message starts
 * with "@computer", and any "tmp-c-…" @computer reply, goes to @computer, never to chat.
 */
export type RetryPlan =
  | { kind: "computer"; task: string }
  | { kind: "blocked"; message: string }
  | { kind: "chat-unsaved"; text: string }
  | { kind: "chat-saved" }
  | { kind: "none" };
export function planRetry(messages: Msg[], id: string, computerEnabled: boolean): RetryPlan {
  const idx = messages.findIndex((m) => m.id === id);
  const user = idx > 0 ? messages[idx - 1] : undefined;
  const userText = user?.role === "user" ? user.content : "";
  const route = routeOutgoing(userText, computerEnabled, { retryOfComputerReply: id.startsWith("tmp-c-") });
  if (route.kind === "computer") return userText ? { kind: "computer", task: userText } : { kind: "none" };
  if (route.kind === "blocked") return { kind: "blocked", message: route.message };
  if (id.startsWith("tmp-")) return userText ? { kind: "chat-unsaved", text: userText } : { kind: "none" };
  return { kind: "chat-saved" };
}

/**
 * When /api/chat refuses with 409 computer_command (e.g. a page loaded before a deploy sent it there), an admin's
 * client reroutes to @computer instead of showing an error. Returns the task to run, or null.
 */
export function rerouteFromChatError(status: number, body: unknown, fallbackText: string, computerEnabled: boolean): string | null {
  if (!computerEnabled || status !== 409) return null;
  const b = body as { error?: { code?: string }; task?: unknown } | null;
  if (b?.error?.code !== COMPUTER_CHAT_CODE) return null;
  const task = typeof b.task === "string" && b.task.trim() ? b.task : fallbackText;
  return task && isComputerCommand(task) ? task : null;
}
