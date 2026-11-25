"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ThemeSegment } from "@/components/ThemeToggle";
import { MockBadge } from "@/components/MockBadge";
import { UsageMeters } from "@/components/UsageMeter";
import type { ProviderInfo, UsageSummary } from "@/lib/types";

const PLAN_NAMES: Record<UsageSummary["plan"], string> = { trial: "Free", pro: "Pro", max: "Max" };

function initials(label: string): string {
  const parts = label.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "")).toUpperCase();
}

async function errMsg(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    if (typeof j.error === "string") return j.error;
    return j.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function StatusBadge({ status }: { status: UsageSummary["status"] }) {
  const map: Record<UsageSummary["status"], [string, string]> = {
    active: ["badge-ok", "Active"],
    trialing: ["badge-ok", "Free"],
    past_due: ["badge-danger", "Past due"],
    canceled: ["badge-warn", "Canceled"],
    none: ["badge-warn", "No plan"],
  };
  const [cls, text] = map[status];
  return <span className={`badge ${cls}`}>{text}</span>;
}

export function ProfileView({ userLabel, email, provider }: { userLabel: string; email: string; provider: ProviderInfo }) {
  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportData = async () => {
    setBusy("export"); setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error(await errMsg(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `citad3l-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed."); }
    setBusy(null);
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setBusy("delete"); setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error(await errMsg(res));
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
      setBusy(null);
    }
  };

  return (
    <>
      {error && <div className="notice notice-danger" role="alert"><strong>Something went wrong.</strong> {error}</div>}
      <section className="account-section account-card">
        <div className="account-card-head">
          <div className="account-identity">
            <span className="avatar-lg" aria-hidden="true">{initials(userLabel || email)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="account-card-title">{userLabel}</div>
              <div className="account-card-sub">{email}</div>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
        </div>
        <MockBadge provider={provider} />
      </section>
      <section className="account-section account-card">
        <div className="account-card-title">Appearance</div>
        <p className="account-card-sub">Light, dark, or follow your device.</p>
        <div style={{ marginTop: 14 }}><ThemeSegment label="Appearance" /></div>
      </section>
      <section className="account-section account-card">
        <div className="account-card-head">
          <div>
            <div className="account-card-title">Your data</div>
            <p className="account-card-sub">Export a copy, or delete your account and everything with it.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportData()} disabled={busy !== null}>
            {busy === "export" && <span className="spinner" />} Export
          </button>
        </div>
        {!confirmOpen ? (
          <button type="button" className="btn btn-danger-quiet btn-sm" onClick={() => setConfirmOpen(true)}>Delete account</button>
        ) : (
          <form className="form" onSubmit={(e) => { e.preventDefault(); void deleteAccount(); }}>
            <div className="field">
              <label className="label" htmlFor="confirm-del">Type DELETE to confirm</label>
              <input id="confirm-del" className="input confirm-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" autoFocus />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>Cancel</button>
              <button type="submit" className="btn btn-danger btn-sm" disabled={confirmText !== "DELETE" || busy !== null}>
                {busy === "delete" && <span className="spinner" />} Permanently delete
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}

export function UsageView({ usage }: { usage: UsageSummary }) {
  return (
    <section className="account-section account-card">
      <div className="account-card-head">
        <div>
          <div className="account-card-sub">Current plan</div>
          <div className="account-plan" style={{ marginTop: 6 }}>
            <span className="account-plan-name">{usage.owner ? "Operator" : usage.admin ? "Admin" : PLAN_NAMES[usage.plan]}</span>
            {usage.plan !== "trial" && !usage.owner && !usage.admin && <StatusBadge status={usage.status} />}
          </div>
        </div>
        <Link href="/pricing" className="btn btn-secondary btn-sm">See plans</Link>
      </div>
      <p className="account-card-sub" style={{ marginBottom: 16 }}>Two limits keep things fair: a short rolling window and a weekly ceiling.</p>
      <UsageMeters usage={usage} />
    </section>
  );
}

export function BillingView({ usage, billingConfigured, billingOpen = false }: { usage: UsageSummary; billingConfigured: boolean; billingOpen?: boolean }) {
  const [busy, setBusy] = useState<null | "portal" | "pro" | "max">(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOk, setCheckoutOk] = useState(false);
  const isPaid = usage.plan !== "trial" && usage.status !== "none";

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "success") setCheckoutOk(true);
  }, []);

  const goPortal = async () => {
    setBusy("portal"); setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } | string };
      if (res.ok && j.url) { window.location.href = j.url; return; }
      const code = typeof j.error === "string" ? j.error : j.error?.code;
      setError(code === "billing_not_configured" ? "Billing isn't configured yet." : code === "billing_coming_soon" ? "Paid plans are coming soon." : (typeof j.error === "object" && j.error?.message) || "Could not open billing portal.");
    } catch { setError("Network error — try again."); }
    setBusy(null);
  };

  const checkout = async (plan: "pro" | "max") => {
    setBusy(plan); setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } | string };
      if (res.ok && j.url) { window.location.href = j.url; return; }
      const code = typeof j.error === "string" ? j.error : j.error?.code;
      setError(code === "billing_not_configured" ? "Billing isn't configured yet." : code === "billing_coming_soon" ? "Paid plans are coming soon." : (typeof j.error === "object" && j.error?.message) || "Could not start checkout.");
    } catch { setError("Network error — try again."); }
    setBusy(null);
  };

  return (
    <>
      {checkoutOk && <div className="notice notice-ok" role="status"><strong>Payment confirmed.</strong> Your plan is updating — it can take a few seconds to appear here.</div>}
      {error && <div className="notice notice-danger" role="alert"><strong>Something went wrong.</strong> {error}</div>}
      <section className="account-section account-card">
        <div className="account-card-title">Billing</div>
        <p className="account-card-sub">
          {isPaid ? "Manage your subscription, invoices, and payment method." : "Upgrade to Pro or Max when you're ready. Change or cancel any time."}
        </p>
        <div className="form-actions" style={{ marginTop: 16 }}>
          {isPaid ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void goPortal()} disabled={!billingConfigured || busy !== null}>
              {busy === "portal" && <span className="spinner" />} {billingConfigured ? "Manage billing" : "Billing portal (not configured yet)"}
            </button>
          ) : !billingOpen ? (
            <p className="tiny"><strong>Paid plans coming soon.</strong> Free works today. <a href="/pricing#plans">See plans</a> or join early access on the <a href="/pricing">pricing page</a>.</p>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void checkout("pro")} disabled={busy !== null}>{busy === "pro" && <span className="spinner" />} Get Pro</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void checkout("max")} disabled={busy !== null}>{busy === "max" && <span className="spinner" />} Get Max</button>
            </>
          )}
        </div>
        {billingOpen && !billingConfigured && <p className="tiny" style={{ marginTop: 12 }}>Billing isn&apos;t configured yet, so checkout won&apos;t open.</p>}
        {usage.cancelAtPeriodEnd && <p className="tiny" style={{ marginTop: 12 }}>Your plan stays active until the end of the current period.</p>}
      </section>
    </>
  );
}

export function SessionsView() {
  const [rows, setRows] = useState<{ id: string; createdAt: string; lastSeenAt: string; userAgent: string | null; current?: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    void fetch("/api/account/sessions").then(async (r) => {
      if (!r.ok) throw new Error(await errMsg(r));
      const j = await r.json();
      setRows(j.sessions ?? []);
    }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load sessions."));
  };
  useEffect(() => { load(); }, []);
  const revoke = async (id: string) => {
    if (!window.confirm("Sign this device out? It will need to sign in again before it can use Citad3L.")) return;
    const res = await fetch(`/api/account/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) { setError(await errMsg(res)); return; }
    if (rows.find((r) => r.id === id)?.current) { await signOut({ callbackUrl: "/login" }); return; }
    load();
  };
  return (
    <section className="account-section account-card">
      <p className="account-card-sub">Devices that are signed in to your account.</p>
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      {rows.length === 0 ? (
        <p className="session-empty">Only this device is signed in.</p>
      ) : (
        <ul className="session-list">
          {rows.map((s) => (
            <li key={s.id} className="session-row">
              <div>
                <div className="session-row-title">
                  {s.userAgent || "Signed-in device"}
                  {s.current ? <span className="session-current">This device</span> : null}
                </div>
                <div className="session-row-meta">Active {new Date(s.lastSeenAt).toLocaleString()} · signed in {new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <button type="button" className="session-revoke btn btn-secondary btn-sm" onClick={() => void revoke(s.id)}>Sign out</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ReferralData = {
  code: string;
  url: string;
  enabled: boolean;
  cap: number;
  invited: number;
  pending: number;
  credited: number;
  capRemaining: number;
  endsLabel: string;
  ended: boolean;
};

export function ReferralsView() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void fetch("/api/account/referral").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);
  const copy = async () => {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const live = !!data?.enabled && !data.ended;
  return (
    <section className="account-section account-card">
      <p className="account-card-sub">{data?.enabled && data.ended ? `This promo ended ${data.endsLabel}.` : "Copy your link and send it to a friend."}</p>
      {data && (
        <div className="referral-box">
          <code className="referral-code">{data.code}</code>
          <button type="button" className="referral-copy btn btn-secondary btn-sm" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
        </div>
      )}
      {data?.enabled ? (
        <>
          <dl className="referral-stats">
            <div><dt>Invited</dt><dd>{data.invited}</dd></div>
            <div><dt>Waiting</dt><dd>{data.pending}</dd></div>
            <div><dt>Free months</dt><dd>{data.credited}</dd></div>
            <div><dt>Left</dt><dd>{data.capRemaining} of {data.cap}</dd></div>
          </dl>
          {live ? (
            <ol className="referral-steps">
              <li>Your friend signs up with your link by {data.endsLabel}.</li>
              <li>When they pay for Pro or Max, you get a free month.</li>
              <li>On a paid plan, it comes off your next bill. On Free, you get 30 days of Pro.</li>
            </ol>
          ) : null}
          <p className="referral-note">
            {live
              ? "Waiting means they signed up but haven't paid yet. One per new account, and you can't refer yourself."
              : "Friends who signed up in time still count when they pay."}
          </p>
        </>
      ) : (
        <p className="referral-note">Rewards aren&apos;t switched on yet.</p>
      )}
    </section>
  );
}
