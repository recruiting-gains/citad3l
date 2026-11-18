=== FILE: components/projects/ProjectsView.tsx ===
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { Rook } from "@/components/Rook";

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; project: Project }
  | { kind: "delete"; project: Project };

type Toast = { id: number; text: string; tone: "ok" | "error" };

const NAME_MAX = 80;
const INSTR_MAX = 4000;

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    if (typeof j.error === "string") return j.error;
    return j.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function relTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectsView({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    setDialog({ kind: "none" });
    setFormError(null);
  }, [busy]);

  useEffect(() => {
    if (dialog.kind === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    if (dialog.kind !== "delete") window.setTimeout(() => nameRef.current?.focus(), 30);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  const openCreate = () => {
    setName("");
    setInstructions("");
    setFormError(null);
    setDialog({ kind: "create" });
  };
  const openEdit = (p: Project) => {
    setName(p.name);
    setInstructions(p.instructions);
    setFormError(null);
    setDialog({ kind: "edit", project: p });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setFormError("Give the project a name.");
      return;
    }
    if (n.length > NAME_MAX || instructions.length > INSTR_MAX) {
      setFormError("Name or instructions are too long.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (dialog.kind === "create") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, instructions }),
        });
        if (!res.ok) throw new Error(await readError(res));
        const j = (await res.json()) as { project: Project };
        setProjects((p) => [j.project, ...p]);
        toast("Project created");
      } else if (dialog.kind === "edit") {
        const id = dialog.project.id;
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, instructions }),
        });
        if (!res.ok) throw new Error(await readError(res));
        let updated: Project = { ...dialog.project, name: n, instructions, updatedAt: new Date().toISOString() };
        try {
          const j = (await res.json()) as { project?: Project };
          if (j.project) updated = j.project;
        } catch {
          /* no body */
        }
        setProjects((p) => p.map((x) => (x.id === id ? updated : x)));
        toast("Project saved");
      }
      setDialog({ kind: "none" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog.kind !== "delete") return;
    const id = dialog.project.id;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      setProjects((p) => p.filter((x) => x.id !== id));
      setDialog({ kind: "none" });
      toast("Project deleted");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container projects-page page-main">
      <header className="page-head">
        <h1 className="page-title">Projects</h1>
        <p className="page-sub">
          Group related chats and give Citad3L standing instructions — a brief it reads before every reply in that project.
        </p>
      </header>

      <div className="page-toolbar">
        <span className="tiny">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          <IconPlus /> New project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="state empty-state">
          <div className="state-emblem">
            <Rook size={32} />
          </div>
          <h2 className="state-title">No projects yet</h2>
          <p className="state-body">
            Create a project for a research thread, a codebase or a recurring brief. Its instructions apply to every chat inside it.
          </p>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <IconPlus /> Create a project
            </button>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <article key={p.id} className="project-card">
              <div className="project-card-head">
                <span className="project-icon">
                  <IconFolder />
                </span>
                <div className="project-actions">
                  <button type="button" className="icon-btn icon-btn-sm" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      setFormError(null);
                      setDialog({ kind: "delete", project: p });
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
              <h2 className="project-name">
                <a href={`/chat?project=${encodeURIComponent(p.id)}`}>{p.name}</a>
              </h2>
              <p className={`project-instructions${p.instructions.trim() ? "" : " is-empty"}`}>
                {p.instructions.trim() || "No instructions"}
              </p>
              <div className="project-meta">
                <span className="tnum">
                  {p.conversationCount} {p.conversationCount === 1 ? "chat" : "chats"}
                </span>
                <span aria-hidden="true">·</span>
                <span>Updated {relTime(p.updatedAt)}</span>
              </div>
            </article>
          ))}
          <button type="button" className="project-new" onClick={openCreate}>
            <IconPlus /> New project
          </button>
        </div>
      )}

      {(dialog.kind === "create" || dialog.kind === "edit") && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog dialog-lg" role="dialog" aria-modal="true" aria-labelledby="proj-dialog-title">
            <h2 id="proj-dialog-title" className="dialog-title">
              {dialog.kind === "create" ? "New project" : "Edit project"}
            </h2>
            <p className="dialog-body">Instructions are sent with every message in this project.</p>
            <form className="form dialog-form" onSubmit={submit}>
              <div className="field">
                <label className="label" htmlFor="proj-name">Name</label>
                <input
                  ref={nameRef}
                  id="proj-name"
                  className="input"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Robotics reading list"
                  aria-invalid={formError !== null && !name.trim()}
                />
              </div>
              <div className="field">
                <div className="label-row">
                  <label className="label" htmlFor="proj-instr">Instructions</label>
                  <span className="char-count">
                    {instructions.length.toLocaleString()} / {INSTR_MAX.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="proj-instr"
                  className="textarea"
                  rows={6}
                  value={instructions}
                  maxLength={INSTR_MAX}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Tone, context, constraints. e.g. Answer as a security reviewer; cite assumptions; keep it under 300 words."
                />
                <span className="field-hint">Optional. You can change this any time.</span>
              </div>
              {formError && <p className="field-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy && <span className="spinner" />}
                  {dialog.kind === "create" ? "Create project" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog.kind === "delete" && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-body">
            <h2 id="del-title" className="dialog-title">Delete “{dialog.project.name}”?</h2>
            <p id="del-body" className="dialog-body">
              The project and its instructions will be removed. This can’t be undone.
            </p>
            {formError && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close} disabled={busy} autoFocus>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
                {busy && <span className="spinner" />} Delete project
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "toast-error" : "toast-ok"}`}>
            <span className="toast-dot" />
            <span>{t.text}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

export default ProjectsView;
=== END FILE ===

=== FILE: components/account/AccountView.tsx ===
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
    <main className="container account-page page-main">
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
                <StatusBadge status={usage.status} />
              </div>
            </div>
            <div className="btn-row">
              {isPaid && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={goPortal} disabled={busy !== null}>
                  {busy === "portal" && <span className="spinner" />} Manage billing
                </button>
              )}
              {usage.plan === "trial" && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => checkout("pro")} disabled={busy !== null}>
                  {busy === "pro" && <span className="spinner" />} Upgrade to Pro
                </button>
              )}
              {usage.plan !== "max" && (
                <button type="button" className={`btn btn-sm ${usage.plan === "trial" ? "btn-outline" : "btn-primary"}`} onClick={() => checkout("max")} disabled={busy !== null}>
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
=== END FILE ===

=== FILE: components/auth/LoginView.tsx ===
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
      const res = await signIn(id, { callbackUrl, ...(extra ?? {}) });
      if (res && typeof res === "object" && "error" in res && res.error) {
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

        {nothing && <div className="notice notice-warn">No sign-in providers are configured.</div>}
        {error && <p className="field-error" role="alert">{error}</p>}

        <p className="auth-foot">
          By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

export default LoginView;
=== END FILE ===