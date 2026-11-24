/** Browser-side store for a guest chat so it can be saved to the account after the "save your chat" sign-in. */
export const GUEST_CHAT_STORAGE_KEY = "citad3l_guest_chat";
export const GUEST_CHAT_MAX_SAVED = 12;

export interface GuestTurn { role: "user" | "assistant"; content: string }

export function loadGuestChat(): GuestTurn[] {
  try {
    const raw = window.localStorage.getItem(GUEST_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as { v?: number; messages?: GuestTurn[] };
    if (j?.v !== 1 || !Array.isArray(j.messages)) return [];
    return j.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-GUEST_CHAT_MAX_SAVED);
  } catch {
    return [];
  }
}

export function saveGuestChat(messages: GuestTurn[]) {
  try {
    const keep = messages.filter((m) => m.content.trim()).slice(-GUEST_CHAT_MAX_SAVED).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    if (!keep.length) window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
    else window.localStorage.setItem(GUEST_CHAT_STORAGE_KEY, JSON.stringify({ v: 1, messages: keep, savedAt: Date.now() }));
  } catch { /* storage blocked */ }
}

export function clearGuestChat() {
  try { window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY); } catch { /* ignore */ }
}
