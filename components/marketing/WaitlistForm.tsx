"use client";

import { useState, type FormEvent } from "react";
import { useTurnstile } from "@/components/TurnstileWidget";

export const WAITLIST_SUCCESS = "You're on the list. We'll email you when new models and features ship.";

export function WaitlistForm({ source }: { source: "home" | "faq" | "pricing" }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstile = useTurnstile("waitlist");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending || done) return;
    if (!turnstile.ready) {
      setError("Please complete the quick check first.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, website, turnstileToken: turnstile.token ?? undefined }),
      });
      turnstile.reset();
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
      if (res.ok && data.ok) {
        setDone(true);
        return;
      }
      setError(data.error?.message || "That didn't go through. Please try again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="waitlist" data-testid="waitlist">
      <h2 className="waitlist-title">Get Citad3L updates</h2>
      <p className="waitlist-sub">Leave your email and we'll tell you when new models and features ship. A few emails a month at most, and you can unsubscribe any time.</p>
      {done ? (
        <p className="waitlist-success" role="status" data-testid="waitlist-success">{WAITLIST_SUCCESS}</p>
      ) : (
        <form className="waitlist-form" onSubmit={onSubmit} noValidate>
          <label className="sr-only" htmlFor={`waitlist-email-${source}`}>Email</label>
          <input
            id={`waitlist-email-${source}`}
            type="email"
            name="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            required
            aria-invalid={error ? true : undefined}
          />
          <div className="hp" aria-hidden="true">
            <label htmlFor={`waitlist-website-${source}`}>Website</label>
            <input
              id={`waitlist-website-${source}`}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          {turnstile.box}
          <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
            {pending ? <span className="spinner" /> : null}
            Notify me
          </button>
        </form>
      )}
      {error && !done ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

export default WaitlistForm;
