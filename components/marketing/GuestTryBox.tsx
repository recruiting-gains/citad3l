"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import { EmailCodeForm } from "@/components/auth/EmailCodeForm";
import { loadGuestChat, saveGuestChat, type GuestTurn } from "@/lib/guest-chat-client";

/**
 * Home page "try it free" chat. Signed-out visitors get a few free messages on Citad3L Fast (the server enforces the
 * cap with a signed cookie + per-IP and site-wide daily limits). When they run out, the box asks for an email to save
 * the chat: the 6-digit email code signs them in and /chat/saved moves this transcript into their account.
 */

type Turn = GuestTurn & { id: string; status?: "streaming" | "done" | "error" };

const SUGGESTIONS = [
  "Explain how lock picking actually works",
  "Give me the blunt case for and against quitting my job",
  "What do most AI chatbots refuse to talk about, and why?",
];

let seq = 0;
const nid = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface GuestTryBoxProps { freeLimit: number; initialUsed: number }

export function GuestTryBox({ freeLimit, initialUsed }: GuestTryBoxProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(initialUsed);
  const [notice, setNotice] = useState<string | null>(null);
  const [capped, setCapped] = useState(initialUsed >= freeLimit);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = loadGuestChat();
    if (saved.length) setTurns(saved.map((m) => ({ ...m, id: nid(), status: "done" })));
  }, []);

  useEffect(() => {
    if (!busy) saveGuestChat(turns.filter((t) => t.status !== "error"));
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const remaining = Math.max(0, freeLimit - used);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy || capped) return;
    setNotice(null);
    const history = turns.filter((t) => t.status === "done").map(({ role, content }) => ({ role, content })).slice(-10);
    const uid = nid();
    const aid = nid();
    setTurns((ts) => [...ts, { id: uid, role: "user", content: message, status: "done" }, { id: aid, role: "assistant", content: "", status: "streaming" }]);
    setText("");
    setBusy(true);
    const patch = (f: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === aid ? f(t) : t)));
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, model: "citad3l-fast", history }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string }; usage?: { used?: number } } | null;
        const code = d?.error?.code ?? "";
        if (typeof d?.usage?.used === "number") setUsed(d.usage.used);
        // Not sent: drop the empty reply and give the text back.
        setTurns((ts) => ts.filter((t) => t.id !== aid && t.id !== uid));
        setText(message);
        if (code === "signup_required") { setCapped(true); setNotice(d?.error?.message ?? null); }
        else if (code === "content_policy") { setTurns((ts) => [...ts, { id: uid, role: "user", content: message, status: "done" }, { id: aid, role: "assistant", content: d?.error?.message ?? "That request isn't allowed.", status: "done" }]); setText(""); }
        else setNotice(d?.error?.message ?? "Something went wrong. Try again in a moment.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let ended = false;
      const handle = (block: string) => {
        let ev = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) ev = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (!data.length) return;
        let d: Record<string, unknown>;
        try { d = JSON.parse(data.join("\n")); } catch { return; }
        const usage = d.usage as { used?: number } | undefined;
        if (typeof usage?.used === "number") { setUsed(usage.used); if (usage.used >= freeLimit) setCapped(true); }
        if (ev === "delta" && typeof d.text === "string") patch((t) => ({ ...t, content: t.content + (d.text as string) }));
        else if (ev === "done") { ended = true; patch((t) => ({ ...t, status: "done" })); }
        else if (ev === "refused") { ended = true; patch((t) => ({ ...t, content: String(d.message ?? "That request isn't allowed."), status: "done" })); }
        else if (ev === "error") { ended = true; patch((t) => ({ ...t, status: "error", content: t.content || String(d.message ?? "The reply failed.") })); }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 2); }
      }
      if (buf.trim()) handle(buf);
      if (!ended) patch((t) => ({ ...t, status: t.content ? "done" : "error", content: t.content || "The reply was cut off. Try again." }));
    } catch {
      if (!ac.signal.aborted) patch((t) => ({ ...t, status: "error", content: t.content || "Connection lost. Try again." }));
      else patch((t) => ({ ...t, status: t.content ? "done" : "error" }));
    } finally {
      abortRef.current = null;
      setBusy(false);
      if (!capped) inputRef.current?.focus();
    }
  };

  const empty = turns.length === 0;

  return (
    <section id="try" className="try-box" aria-label="Try Citad3L free">
      <div className="try-head">
        <span className="try-title"><span className="try-dot" aria-hidden="true" /> Citad3L Fast · free, no signup</span>
        <span className="try-count tnum" aria-live="polite">{capped ? "Free messages used" : `${remaining} of ${freeLimit} free messages left`}</span>
      </div>

      <div className="try-log" ref={logRef} aria-live="polite">
        {empty ? (
          <div className="try-empty">
            <p className="try-empty-text">Ask the thing other AI shrugs at.</p>
            <div className="try-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="try-chip" disabled={busy || capped} onClick={() => void send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((t) => (
            <div key={t.id} className={`try-msg is-${t.role}${t.status === "error" ? " is-error" : ""}`}>
              {t.role === "assistant" ? (
                t.content ? <Markdown content={t.content} /> : <span className="try-typing" aria-label="Thinking"><span /><span /><span /></span>
              ) : (
                <p>{t.content}</p>
              )}
            </div>
          ))
        )}
      </div>

      {capped ? (
        <div className="try-save">
          <p className="try-save-title">Save your chat and keep going</p>
          <p className="try-save-sub">{notice && !/used your/i.test(notice) ? notice : `You've used your ${freeLimit} free messages.`} Enter your email and we&apos;ll send a 6-digit code. Your chat moves into your account so you can pick up where you left off.</p>
          <EmailCodeForm callbackUrl="/chat/saved" sendLabel="Save my chat" idPrefix="try" compact beforeRedirect={() => saveGuestChat(turns.filter((t) => t.status !== "error"))} />
        </div>
      ) : (
        <form className="try-input" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
          <label htmlFor="try-text" className="sr-only">Message Citad3L</label>
          <textarea
            id="try-text"
            ref={inputRef}
            className="try-textarea"
            rows={1}
            maxLength={2000}
            placeholder="Ask anything…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(text); }
            }}
            disabled={busy}
          />
          {busy ? (
            <button type="button" className="btn btn-secondary try-send" onClick={() => abortRef.current?.abort()}>Stop</button>
          ) : (
            <button type="submit" className="btn btn-primary try-send" disabled={!text.trim()}>Send</button>
          )}
        </form>
      )}
      {notice && !capped && <p className="field-error try-notice" role="alert">{notice}</p>}
    </section>
  );
}

export default GuestTryBox;
