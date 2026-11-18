"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Rook } from "@/components/Rook";

interface Props {
  demoEnabled: boolean;
  providers: { id: string; name: string }[];
  next?: string;
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.4 7.4 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2Z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#4285F4" d="M15.7 8.2c0-.6-.1-1.1-.2-1.6H8v3h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.4-3.4 2.4-5.8Z" />
      <path fill="#34A853" d="M8 16c2.2 0 4-.7 5.3-2l-2.6-2c-.7.5-1.6.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3H.8v2.1A8 8 0 0 0 8 16Z" />
      <path fill="#FBBC05" d="M3.5 9.5a4.8 4.8 0 0 1 0-3V4.4H.8a8 8 0 0 0 0 7.2l2.7-2.1Z" />
      <path fill="#EA4335" d="M8 3.2c1.2 0 2.3.4 3.1 1.2l2.3-2.3A8 8 0 0 0 .8 4.4l2.7 2.1C4.1 4.6 5.9 3.2 8 3.2Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 4.5 8 9l5.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function safeNext(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/chat";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginView({ demoEnabled, providers, next }: Props) {
  const callbackUrl = safeNext(next);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicEmail, setMagicEmail] = useState("");
  const [demoEmail, setDemoEmail] = useState("demo@citad3l.dev");
  const [sent, setSent] = useState(false);

  const oauth = providers.filter((p) => p.id !== "resend" && p.id !== "demo");
  const hasResend = providers.some((p) => p.id === "resend");

  const go = async (id: string, extra?: Record<string, string>) => {
    setError(null);
    setPending(id);
    try {
      const res = (await signIn(id, { callbackUrl, ...(extra ?? {}) })) as unknown as { error?: string } | undefined;
      if (res?.error) {
        setError("Sign-in failed. Try again.");
        setPending(null);
      }
    } catch {
      setError("Sign-in failed. Check your connection and try again.");
      setPending(null);
    }
  };

  const submitMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(magicEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setPending("resend");
    try {
      await signIn("resend", { email: magicEmail.trim(), callbackUrl, redirect: false });
      setSent(true);
    } catch {
      setError("Could not send the link. Try again.");
    }
    setPending(null);
  };

  const submitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(demoEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    void go("demo", { email: demoEmail.trim() });
  };

  const icon = (id: string) => (id === "github" ? <GithubIcon /> : id === "google" ? <GoogleIcon /> : <MailIcon />);
  const nothing = oauth.length === 0 && !hasResend && !demoEnabled;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-emblem"><Rook size={30} /></span>
          <h1 className="auth-title">Sign in to Citad3L</h1>
          <p className="auth-sub">Start with 5 free replies. No card required.</p>
        </div>

        {oauth.length > 0 && (
          <div className="auth-providers">
            {oauth.map((p) => (
              <button key={p.id} type="button" className="provider-btn" disabled={pending !== null} onClick={() => go(p.id)}>
                {pending === p.id ? <span className="spinner" /> : icon(p.id)}
                Continue with {p.name}
              </button>
            ))}
          </div>
        )}

        {hasResend && (
          <>
            {oauth.length > 0 && <div className="auth-divider">or</div>}
            {sent ? (
              <div className="notice notice-ok" role="status">
                Check <strong>{magicEmail}</strong> for a sign-in link.
              </div>
            ) : (
              <form className="form" onSubmit={submitMagic}>
                <div className="field">
                  <label className="label" htmlFor="magic-email">Email</label>
                  <input id="magic-email" type="email" className="input" autoComplete="email" placeholder="you@example.com" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={pending !== null}>
                  {pending === "resend" && <span className="spinner" />} Email me a link
                </button>
              </form>
            )}
          </>
        )}

        {demoEnabled && (
          <>
            {(oauth.length > 0 || hasResend) && <div className="auth-divider">or</div>}
            <form className="demo-box" onSubmit={submitDemo}>
              <span className="demo-label"><span className="amber-dot" /> Development demo login — disabled in production</span>
              <div className="field">
                <label className="label" htmlFor="demo-email">Email</label>
                <input id="demo-email" type="email" className="input" autoComplete="off" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={pending !== null}>
                {pending === "demo" && <span className="spinner" />} Continue as demo user
              </button>
            </form>
          </>
        )}

        {nothing && (
          <div className="notice notice-warn" role="status">
            Sign-in isn&apos;t open in this public preview yet, so chat, projects and account are unavailable for now.{" "}
            <a href="/models/citad3l-v1">See the engine</a> or <a href="/pricing">view plans</a>.
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}

        <p className="auth-foot">
          By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

export default LoginView;
