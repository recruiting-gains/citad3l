"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useTurnstile } from "@/components/TurnstileWidget";

/**
 * Email + 6-digit code sign-in (shared by /login and the home page "save your chat" step).
 * - The code field shows as soon as a valid email is submitted (while the code is still sending), autofocused.
 * - Pasting the code (with or without spaces/dashes) fills all 6 digits and submits.
 * - A visible Resend button with a 30 s countdown.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

function messageForCode(code?: string | null): string {
  if (code === "expired_code") return "That code has expired. Request a new one.";
  if (code === "locked") return "Too many attempts. Request a new code.";
  if (code === "invalid_email") return "Enter a valid email address.";
  return "That code didn't work. Try again.";
}

export interface EmailCodeFormProps {
  callbackUrl: string;
  initialEmail?: string;
  /** Label on the first button. */
  sendLabel?: string;
  /** Runs right before the browser leaves for callbackUrl (e.g. stash a guest chat). */
  beforeRedirect?: () => void;
  onStepChange?: (step: "email" | "code", email: string) => void;
  /** Disable every control (e.g. while a parent is busy). */
  disabled?: boolean;
  idPrefix?: string;
  compact?: boolean;
}

export function EmailCodeForm({
  callbackUrl,
  initialEmail = "",
  sendLabel = "Email me a code",
  beforeRedirect,
  onStepChange,
  disabled = false,
  idPrefix = "login",
  compact = false,
}: EmailCodeFormProps) {
  const [pending, setPending] = useState<null | "send" | "verify">(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const submittingCode = useRef(false);
  const turnstile = useTurnstile("login");

  useEffect(() => { onStepChange?.(step, email.trim()); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const requestCode = async (target: string) => {
    const addr = target.trim();
    if (!EMAIL_RE.test(addr)) { setError("Enter a valid email address."); return false; }
    if (!turnstile.ready) { setError("Please complete the quick check below first."); return false; }
    setError(null);
    setPending("send");
    setSent(false);
    // Show the code box right away; the email is on its way.
    setStep("code");
    setCode("");
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: addr, turnstileToken: turnstile.token ?? undefined }),
      });
      turnstile.reset();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "We couldn't send a code right now. Try again in a moment.");
        setPending(null);
        setStep("email");
        return false;
      }
      setSent(true);
      setCooldown(RESEND_SECONDS);
      setPending(null);
      codeRef.current?.focus();
      return true;
    } catch {
      setError("We couldn't send a code right now. Try again in a moment.");
      setPending(null);
      setStep("email");
      return false;
    }
  };

  const verify = async (value: string) => {
    if (submittingCode.current) return;
    if (!/^\d{6}$/.test(value)) { setError("Enter the 6-digit code."); return; }
    submittingCode.current = true;
    setError(null);
    setPending("verify");
    try {
      const res = await signIn("email-code", { email: email.trim(), code: value, callbackUrl, redirect: false });
      if (!res || res.error) {
        setError(messageForCode((res as { code?: string } | undefined)?.code ?? res?.error));
        setPending(null);
        submittingCode.current = false;
        return;
      }
      try { beforeRedirect?.(); } catch { /* ignore */ }
      window.location.assign(res.url && !/\/api\/auth/.test(res.url) ? res.url : callbackUrl);
    } catch {
      setError("Sign-in failed. Check your connection and try again.");
      setPending(null);
      submittingCode.current = false;
    }
  };

  const takeDigits = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 6);
    setCode(d);
    if (d.length === 6) void verify(d);
  };

  const busy = disabled || pending !== null;
  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <div className={`email-code${compact ? " is-compact" : ""}`}>
      {step === "email" ? (
        <form className="form" onSubmit={(e) => { e.preventDefault(); void requestCode(email); }}>
          <div className="field">
            <label className="label" htmlFor={id("email")}>Email</label>
            <input
              id={id("email")}
              type="email"
              className="input"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {pending === "send" && <span className="spinner" />} {sendLabel}
          </button>
        </form>
      ) : (
        <form className="form" onSubmit={(e) => { e.preventDefault(); void verify(code.trim()); }}>
          <p className="field-hint code-status" role="status" aria-live="polite">
            {sent ? (
              <>Your code is on its way to <strong>{email.trim()}</strong>. It can take a minute, so check your spam or junk folder if you don&apos;t see it.</>
            ) : (
              <>Sending a code to <strong>{email.trim()}</strong>…</>
            )}
          </p>
          <div className="field">
            <label className="label" htmlFor={id("code")}>6-digit code</label>
            <input
              ref={codeRef}
              id={id("code")}
              className="input auth-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              placeholder="000000"
              autoFocus
              value={code}
              onPaste={(e) => {
                const txt = e.clipboardData.getData("text");
                if (txt) { e.preventDefault(); takeDigits(txt); }
              }}
              onChange={(e) => takeDigits(e.target.value)}
              disabled={disabled || pending === "verify"}
            />
            <p className="field-hint">Paste or type the code. It expires in 10 minutes.</p>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
            {pending === "verify" && <span className="spinner" />} Continue
          </button>
          <div className="auth-alt">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || cooldown > 0}
              onClick={() => void requestCode(email)}
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            </button>
            <button
              type="button"
              className="auth-text-btn"
              disabled={pending === "verify"}
              onClick={() => { setStep("email"); setCode(""); setError(null); setPending(null); }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}
      {turnstile.box}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export default EmailCodeForm;
