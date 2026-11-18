"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { ProviderInfo, UsageSummary } from "@/lib/types";
import { MockBadge } from "@/components/MockBadge";

interface Props {
  userLabel: string;
  email: string;
  usage: UsageSummary;
  billingConfigured: boolean;
  provider: ProviderInfo;
}

const PLAN_NAMES: Record<UsageSummary["plan"], string> = { trial: "Trial", pro: "Pro", max: "Max" };

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function initials(label: string): string {
  const parts = label.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "")).toUpperCase();
}

async function errMsg(res: Response): Promise<{ code?: string; message: string }> {
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } | string };
    if (typeof j.error === "string") return { code: j.error, message: j.error };
    return { code: j.error?.code, message: j.error?.message ?? `Request failed (${res.status})` };
  } catch {
    return { message: `Request failed (${res.status})` };
  }
}

function StatusBadge({ status }: { status: UsageSummary["status"] }) {
  const map: Record<UsageSummary["status"], [string, string]> = {
    active: ["badge-ok", "Active"],
    trialing: ["badge-ok", "Trial"],
    past_due: ["badge-danger", "Past due"],
    canceled: ["badge-warn", "Canceled"],
    none: ["badge-warn", "No plan"],
  };
  const [cls, text] = map[status];
  return <span className={`badge ${cls}`}>{text}</span>;
}

export function AccountView({ userLabel, email, usage, billingConfigured, provider }: Props) {
  const [checkoutOk, setCheckoutOk] = useState(false);
  const [busy, setBusy] = useState<null | "portal" | "pro" | "max" | "export" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") setCheckoutOk(true);
  }, []);

  const limit = Math.max(0, usage.limit);
  const used = Math.min(usage.used, limit || usage.used);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const fillCls = pct >= 100 ? " is-full" : pct >= 80 ? " is-warn" : "";
  const reset = fmtDate(usage.resetAt);
  const isPaid = usage.plan !== "trial" && usage.status !== "none";

  const goPortal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } | string };
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      const code = typeof j.error === "string" ? j.error : j.error?.code;
      setError(code === "billing_not_configured" ? "Test-mode billing not configured yet." : (typeof j.error === "object" && j.error?.message) || "Could not open billing portal.");
    } catch {
      setError("Network error — try again.");
    }
    setBusy(null);
  };

  const checkout = async (plan: "pro" | "max") => {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } | string };
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      const code = typeof j.error === "string" ? j.error : j.error?.code;
      setError(code === "billing_not_configured" ? "Test-mode billing not configured yet." : (typeof j.error === "object" && j.error?.message) || "Could not start checkout.");
    } catch {
      setError("Network error — try again.");
    }
    setBusy(null);
  };

  const exportData = async () => {
    setBusy("export");
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error((await errMsg(res)).message);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `citad3l-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
    setBusy(null);
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error((await errMsg(res)).message);
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
      setBusy(null);
    }
  };

  return (
    <main className="page-wrap account-page page-main">
      <header className="page-head">
        <h1 className="page-title">Account</h1>
        <p className="page-sub">Your plan, allowance and data.</p>
      </header>

      <div className="account-grid">
        {checkoutOk && (
          <div className="notice notice-ok" role="status">
            <strong>Payment confirmed.</strong> Your plan is updating — it can take a few seconds to appear here.
          </div>
        )}
        {error && (
          <div className="notice notice-danger" role="alert">
            <strong>Something went wrong.</strong> {error}
          </div>
        )}

        <section className="account-card">
          <div className="account-card-head">
            <div className="account-identity">
              <span className="avatar-lg" aria-hidden="true">{initials(userLabel || email)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="account-card-title">{userLabel}</div>
                <div className="account-card-sub">{email}</div>
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </button>
          </div>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <div>
              <div className="account-card-sub">Current plan</div>
              <div className="account-plan" style={{ marginTop: 6 }}>
                <span className="account-plan-name">{PLAN_NAMES[usage.plan]}</span>
                {usage.plan !== "trial" && <StatusBadge status={usage.status} />}
              </div>
            </div>
            <div className="btn-row">
              {isPaid && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={goPortal} disabled={busy !== null}>
                  {busy === "portal" && <span className="spinner" />} Manage billing
                </button>
              )}
              {usage.plan === "trial" && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => checkout("pro")} disabled={busy !== null || !billingConfigured}>
                  {busy === "pro" && <span className="spinner" />} Upgrade to Pro
                </button>
              )}
              {usage.plan !== "max" && (
                <button type="button" className={`btn btn-sm ${usage.plan === "trial" ? "btn-outline" : "btn-primary"}`} onClick={() => checkout("max")} disabled={busy !== null || !billingConfigured}>
                  {busy === "max" && <span className="spinner" />} {usage.plan === "trial" ? "Go Max" : "Upgrade to Max"}
                </button>
              )}
            </div>
          </div>

          {!billingConfigured && <div className="notice notice-warn" style={{ marginBottom: 16 }}>Test-mode billing not configured yet.</div>}
          {usage.cancelAtPeriodEnd && (
            <div className="notice notice-warn" style={{ marginBottom: 16 }}>
              <strong>Cancellation scheduled.</strong> Your plan stays active until {reset ?? "the end of the billing period"}, then won’t renew.
            </div>
          )}
          {usage.status === "past_due" && (
            <div className="notice notice-danger" style={{ marginBottom: 16 }}>
              <strong>Payment failed.</strong> Update your payment method in billing to keep your allowance.
            </div>
          )}

          <div className="meter">
            <div className="meter-top">
              <span className="meter-value">
                {used.toLocaleString()}
                <small>of {limit.toLocaleString()} {usage.unitLabel} used</small>
              </span>
              <span className="tiny tnum">{Math.max(0, usage.remaining).toLocaleString()} left</span>
            </div>
            <div className="meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label="Allowance used">
              <div className={`meter-fill${fillCls}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="meter-foot">
              <span>{usage.plan === "trial" ? "One-time trial allowance" : reset ? `Resets ${reset}` : "Resets on your billing date"}</span>
              <span>Failed replies are never charged</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 18, flexWrap: "wrap" }}>
            <span className="tiny">Engine: Citad3L V1</span>
            <MockBadge provider={provider} />
          </div>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <div>
              <div className="account-card-title">Data</div>
              <div className="account-card-sub">Your conversations and projects belong to you.</div>
            </div>
          </div>
          <div className="account-row">
            <div>
              <div className="account-row-label">Export data</div>
              <div className="account-row-desc">Download all conversations, projects and usage as JSON.</div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportData} disabled={busy !== null}>
              {busy === "export" && <span className="spinner" />} Export
            </button>
          </div>
        </section>

        <section className="account-card danger-zone">
          <div className="account-card-head">
            <div>
              <div className="account-card-title">Delete account</div>
              <div className="account-card-sub">Permanently removes your account, conversations and projects. Cancel any subscription first.</div>
            </div>
            {!confirmOpen && (
              <button type="button" className="btn btn-danger-quiet btn-sm" onClick={() => setConfirmOpen(true)}>
                Delete account
              </button>
            )}
          </div>
          {confirmOpen && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
            >
              <div className="field">
                <label className="label" htmlFor="confirm-del">Type DELETE to confirm</label>
                <input
                  id="confirm-del"
                  className="input confirm-input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setConfirmOpen(false); setConfirmText(""); }} disabled={busy === "delete"}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger btn-sm" disabled={confirmText !== "DELETE" || busy !== null}>
                  {busy === "delete" && <span className="spinner" />} Permanently delete
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default AccountView;
