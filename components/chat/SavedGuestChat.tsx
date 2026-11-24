"use client";

import { useEffect, useState } from "react";
import { clearGuestChat, loadGuestChat } from "@/lib/guest-chat-client";

/** After the "save your chat" sign-in: move the guest transcript from this browser into the account, then open it. */
export function SavedGuestChat() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const messages = loadGuestChat();
      if (!messages.length) { window.location.replace("/chat"); return; }
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        const d = (await res.json().catch(() => null)) as { conversationId?: string } | null;
        if (!res.ok || !d?.conversationId) throw new Error("save failed");
        clearGuestChat();
        if (alive) window.location.replace(`/chat/${encodeURIComponent(d.conversationId)}`);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []);
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <h1 className="auth-title">{failed ? "We couldn't save that chat" : "Saving your chat…"}</h1>
          <p className="auth-sub">{failed ? "You're signed in. Open chat to keep going." : "One moment."}</p>
        </div>
        {failed && <a className="btn btn-primary btn-block" href="/chat">Open chat</a>}
      </div>
    </main>
  );
}
export default SavedGuestChat;
