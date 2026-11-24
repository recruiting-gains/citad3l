"use client";

import { useEffect, useState } from "react";

type Status = {
  paired: boolean;
  connected: boolean;
  helper: { version?: string; host?: string; connectedAt?: number } | null;
  device: { name: string; pairedAt: number; lastSeen: number } | null;
  run: { id: string; startedAt: number; stopRequested: boolean } | null;
  model: string;
  maxSteps: number;
};

const post = (url: string, body: unknown = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Admin-only @computer pairing (each admin pairs their own Mac). The token is shown once and never stored in the page after you close it. */
export function ComputerPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState<{ token: string; server: string } | null>(null);
  const [copied, setCopied] = useState<"cmd" | "token" | null>(null);
  // "unavailable" when the setting can't be read; the server then runs strict (auto-approve off).
  const [autoApprove, setAutoApprove] = useState<boolean | "unavailable" | null>(null);

  const load = () => {
    void fetch("/api/computer/status", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error?.message ?? "Couldn't load @computer status.");
        setStatus(j);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load @computer status."));
  };
  const loadSettings = () => {
    void fetch("/api/computer/settings", { cache: "no-store" })
      .then(async (r) => {
        const j = r.ok ? await r.json().catch(() => null) : null;
        setAutoApprove(j && typeof j.autoApprove === "boolean" ? j.autoApprove === true : "unavailable");
      })
      .catch(() => setAutoApprove("unavailable"));
  };
  useEffect(() => {
    loadSettings();
    // Re-read when the panel/tab comes back, so another device's change shows here.
    const onFocus = () => { if (document.visibilityState === "visible") loadSettings(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleAuto = async (next: boolean) => {
    setBusy(true);
    try {
      const r = await post("/api/computer/settings", { autoApprove: next });
      if (!r.ok) throw new Error("Couldn't save the setting.");
      setAutoApprove(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the setting.");
    }
    setBusy(false);
  };
  useEffect(() => {
    load();
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, []);

  const pair = async () => {
    if (status?.paired && !window.confirm("Pair again? This disconnects the current Mac helper and its old token stops working.")) return;
    const name = window.prompt("Name this Mac", status?.device?.name ?? "MacBook") ?? "";
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await post("/api/computer/pair", { name });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message ?? "Pairing failed.");
      setPairing({ token: j.token, server: j.server });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pairing failed.");
    }
    setBusy(false);
  };
  const revoke = async () => {
    if (!window.confirm("Revoke the Mac pairing? Any running task stops and the helper is disconnected.")) return;
    setBusy(true);
    await post("/api/computer/revoke").catch(() => null);
    setPairing(null);
    setBusy(false);
    load();
  };
  const stop = async () => {
    setBusy(true);
    await post("/api/computer/stop").catch(() => null);
    setBusy(false);
    load();
  };

  // The token is pasted at a hidden prompt, so it never lands in shell history or process arguments.
  const command = pairing ? `python3 citad3l_helper.py pair --server ${pairing.server}` : "";

  return (
    <section className="account-card" style={{ marginBottom: 16 }} data-testid="admin-computer">
      <div className="account-card-title">@computer · your Mac</div>
      <p className="account-card-sub">
        Only admin accounts can use this, and only with the Mac you pair here. Type <code>@computer</code> in chat to let Citad3L see and control your Mac.
        Every action is shown in chat and logged here. Sends, posts, purchases, deletes, password or payment fields and system settings always wait for your OK.
      </p>
      {autoApprove === "unavailable" ? (
        <p className="account-card-sub" data-testid="computer-auto-approve">
          Auto-approve: unavailable (couldn&apos;t load the setting, so runs ask first).{" "}
          <button type="button" className="btn btn-secondary" onClick={loadSettings}>Retry</button>
        </p>
      ) : autoApprove !== null ? (
        <label className="account-card-sub" style={{ display: "flex", gap: 8, alignItems: "center" }} data-testid="computer-auto-approve">
          <input type="checkbox" checked={autoApprove} disabled={busy} onChange={(e) => void toggleAuto(e.target.checked)} />
          Auto-approve ordinary steps (clicks, opening apps, scrolling, typing into search or the address bar). Anything the model flags, plus sends, deletes, purchases, forms and settings, still waits for you. Off by default. Applies to new runs; use STOP for a run in progress.
        </label>
      ) : null}
      {error && <p className="notice notice-danger" role="alert">{error}</p>}
      {status && (
        <p className="account-card-sub" data-testid="computer-status">
          {status.paired ? `Paired: ${status.device?.name ?? "Mac"}` : "Not paired"}
          {" · "}
          {status.connected ? `helper online${status.helper?.version ? ` (v${status.helper.version})` : ""}` : "helper offline"}
          {status.run ? ` · task running${status.run.stopRequested ? " (stopping)" : ""}` : ""}
          {" · model "}{status.model}{" · max "}{status.maxSteps}{" steps"}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" className="btn btn-secondary btn-xs" disabled={busy} onClick={() => void pair()}>{status?.paired ? "Re-pair Mac" : "Pair my Mac"}</button>
        <button type="button" className="btn btn-secondary btn-xs" disabled={busy || !status?.paired} onClick={() => void revoke()}>Revoke pairing</button>
        <button type="button" className="btn btn-secondary btn-xs" disabled={busy || !status?.run} onClick={() => void stop()}>Stop running task</button>
      </div>
      {pairing && (
        <div className="notice notice-warn" style={{ marginTop: 12 }}>
          <p><strong>Shown once.</strong> 1) In Terminal on your Mac, in the helper folder, run:</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", userSelect: "all" }}>{command}</pre>
          <p>2) When it asks, paste this token (it stays hidden while you paste):</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", userSelect: "all" }} data-testid="computer-token">{pairing.token}</pre>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-xs" onClick={() => void navigator.clipboard.writeText(command).then(() => setCopied("cmd"))}>{copied === "cmd" ? "Copied" : "Copy command"}</button>
            <button type="button" className="btn btn-secondary btn-xs" onClick={() => void navigator.clipboard.writeText(pairing.token).then(() => setCopied("token"))}>{copied === "token" ? "Copied" : "Copy token"}</button>
            <button type="button" className="btn btn-secondary btn-xs" onClick={() => { setPairing(null); setCopied(null); void navigator.clipboard.writeText("").catch(() => null); }}>Done, hide this</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default ComputerPanel;
