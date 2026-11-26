"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Rook } from "@/components/Rook";
import { EmailCodeForm } from "@/components/auth/EmailCodeForm";

interface Props {
  demoEnabled: boolean;
  providers: { id: string; name: string }[];
  next?: string;
  /** "save" = arriving from the home page try box ("save your chat"). */
  mode?: "save";
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

function safeNext(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/chat";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginView({ demoEnabled, providers, next, mode }: Props) {
  const callbackUrl = safeNext(next);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [demoEmail, setDemoEmail] = useState("demo@citad3l.dev");
  const save = mode === "save";

  const oauth = providers.filter((p) => p.id !== "resend" && p.id !== "demo" && p.id !== "email-code");

  const goOauth = async (id: string) => {
    setError(null);
    setPending(id);
    try {
      const res = (await signIn(id, { callbackUrl })) as unknown as { error?: string } | undefined;
      if (res?.error) {
        setError("Sign-in failed. Try again.");
        setPending(null);
      }
    } catch {
      setError("Sign-in failed. Check your connection and try again.");
      setPending(null);
    }
  };

  const submitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(demoEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setPending("demo");
    void signIn("demo", { email: demoEmail.trim(), callbackUrl }).catch(() => {
      setError("Sign-in failed. Try again.");
      setPending(null);
    });
  };

  const icon = (id: string) => (id === "github" ? <GithubIcon /> : id === "google" ? <GoogleIcon /> : null);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-emblem"><Rook size={30} /></span>
          <h1 className="auth-title">{step === "code" ? "Enter your code" : save ? "Save your chat" : "Sign in to Citad3L"}</h1>
          <p className="auth-sub">
            {step === "code"
              ? "Enter the 6-digit code from your email."
              : save
                ? "Enter your email and we'll send a 6-digit code. Your chat is saved, and a free account gives you 3 messages every day."
                : "Try 5 messages with no account, or create a free account for 3 every day. No card needed."}
          </p>
        </div>

        <EmailCodeForm callbackUrl={callbackUrl} onStepChange={(s) => setStep(s)} disabled={pending !== null} sendLabel={save ? "Save my chat" : "Email me a code"} />

        {oauth.length > 0 && step === "email" && (
          <>
            <div className="auth-divider">or</div>
            <div className="auth-providers">
              {oauth.map((p) => (
                <button key={p.id} type="button" className="provider-btn" disabled={pending !== null} onClick={() => goOauth(p.id)}>
                  {pending === p.id ? <span className="spinner" /> : icon(p.id)}
                  Continue with {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        {demoEnabled && step === "email" && (
          <>
            <div className="auth-divider">or</div>
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

        {error && <p className="field-error" role="alert">{error}</p>}

        <p className="auth-foot">
          By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

export default LoginView;
