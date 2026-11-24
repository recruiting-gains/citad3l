"use client";

import { useEffect, useState } from "react";
import { ComputerPanel } from "./ComputerPanel";

type UserRow = {
  id: string; email: string | null; name: string | null; createdAt: string;
  plan: string; status: string; weekUsed: number; weekLimit: number;
  windowUsed: number; windowLimit: number; trialUsed: number;
  banned: boolean; bannedReason: string | null; refundMarkedAt: string | null; owner: boolean;
};

type Payload = {
  owner: { email: string };
  viewer?: { owner: boolean; computer?: boolean };
  users: UserRow[];
  spend: { usd: number; replies: number; note: string };
  refusals: { id: string; createdAt: string; category: string; direction: string; modelId: string | null; email: string | null; guest: boolean }[];
  audits: { id: string; action: string; detail: string; createdAt: string; actorEmail: string | null; targetEmail: string | null }[];
  waitlist: { count: number; signups: { id: string; email: string; source: string; createdAt: string }[] };
};

export function AdminView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setError(null);
    void fetch("/api/admin")
      .then(async (r) => {
        if (r.status === 404) throw new Error("not_found");
        if (!r.ok) throw new Error("Couldn't load the dashboard.");
        setData(await r.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the dashboard."));
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "ban" | "unban" | "refund") => {
    const reason = action === "ban" ? (window.prompt("Reason for the suspension? (shown to the user)") ?? "") : "";
    if (action === "refund" && !window.confirm("Mark a refund on this account? If Stripe is not connected, this only records the mark.")) return;
    setBusy(`${action}:${id}`);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error?.message || "Action failed.");
      if (j.message) window.alert(j.message);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
    setBusy(null);
  };

  if (error && !data) return <main className="page-wrap page-main"><p className="notice notice-danger">{error}</p></main>;
  if (!data) return <main className="page-wrap page-main"><p>Loading…</p></main>;

  return (
    <main className="page-wrap page-main account-page" data-testid="admin-dashboard">
      <header className="page-head">
        <h1 className="page-title">Admin</h1>
        <p className="page-sub">Operator dashboard for {data.owner.email}. Actions are written to the audit log.</p>
      </header>
      {error && <div className="notice notice-danger" role="alert">{error}</div>}

      {data.viewer?.computer ? <ComputerPanel /> : null}

      <section className="account-card" style={{ marginBottom: 16 }}>
        <div className="account-card-title">Model spend estimate</div>
        <p className="account-plan-name tnum">${data.spend.usd.toFixed(2)}</p>
        <p className="account-card-sub">{data.spend.replies.toLocaleString()} settled replies. {data.spend.note}</p>
      </section>

      <section className="account-card" style={{ marginBottom: 16 }}>
        <div className="account-card-title">Users</div>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="admin-table" data-testid="admin-users">
            <thead>
              <tr>
                <th>Email</th><th>Plan</th><th>Window</th><th>Week</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email ?? "—"}{u.owner ? " · operator" : ""}{u.banned ? " · suspended" : ""}</td>
                  <td>{u.plan}</td>
                  <td className="tnum">{u.owner ? "—" : `${u.windowUsed}/${u.windowLimit}`}</td>
                  <td className="tnum">{u.owner ? "—" : `${u.weekUsed}/${u.weekLimit}`}</td>
                  <td>{u.refundMarkedAt ? "refund marked" : u.status}</td>
                  <td>
                    {u.owner ? null : (
                      <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button type="button" className="btn btn-secondary btn-xs" disabled={busy !== null} onClick={() => void act(u.id, u.banned ? "unban" : "ban")}>
                          {u.banned ? "Unban" : "Ban"}
                        </button>
                        <button type="button" className="btn btn-secondary btn-xs" disabled={busy !== null || !!u.refundMarkedAt} onClick={() => void act(u.id, "refund")}>
                          Mark refund
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="account-card" style={{ marginBottom: 16 }}>
        <div className="account-card-title">Filter refusals</div>
        <p className="account-card-sub">Category only — prompts and replies are never stored here.</p>
        <ul className="session-list" data-testid="admin-refusals">
          {data.refusals.length === 0 ? <li className="session-empty">No refusals logged yet.</li> : data.refusals.map((r) => (
            <li key={r.id} className="session-row">
              <div>
                <div className="session-row-title">{r.category} · {r.direction}</div>
                <div className="session-row-meta">{new Date(r.createdAt).toLocaleString()} · {r.email ?? (r.guest ? "guest" : "unknown")}{r.modelId ? ` · ${r.modelId}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="account-card" style={{ marginBottom: 16 }}>
        <div className="account-card-title">Early access signups</div>
        <p className="account-card-sub">{data.waitlist.count.toLocaleString()} on the list. No emails have been sent.</p>
        <ul className="session-list" data-testid="admin-waitlist">
          {data.waitlist.signups.length === 0 ? <li className="session-empty">No signups yet.</li> : data.waitlist.signups.map((s) => (
            <li key={s.id} className="session-row">
              <div>
                <div className="session-row-title">{s.email}</div>
                <div className="session-row-meta">{new Date(s.createdAt).toLocaleString()} · {s.source}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="account-card">
        <div className="account-card-title">Audit log</div>
        <ul className="session-list" data-testid="admin-audit">
          {data.audits.length === 0 ? <li className="session-empty">No admin actions yet.</li> : data.audits.map((a) => (
            <li key={a.id} className="session-row">
              <div>
                <div className="session-row-title">{a.action}{a.targetEmail ? ` · ${a.targetEmail}` : ""}</div>
                <div className="session-row-meta">{new Date(a.createdAt).toLocaleString()} · {a.actorEmail}{a.detail ? ` · ${a.detail}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default AdminView;
