// @computer relay: one Durable Object PER USER (idFromName("user:" + userId)), admins only (ADMIN_EMAILS).
// A pairing token is "c3l_<64-hex DO id>_<64-hex secret>". The DO id only routes the helper's socket; the hub that
// minted the token checks the SHA-256 of the WHOLE token, so a token can never connect to another user's hub, and
// one user's runs/commands only ever reach the device paired in THAT user's hub.
// The Mac helper dials OUT to /api/computer/ws with a bearer pairing token; nothing listens on the Mac.
// Management routes (/pair, /revoke, /status, /command, /stop, /run/*, /pending/*) are reachable ONLY through the
// COMPUTER_HUB binding from owner-gated Next routes. custom-worker.js forwards just the WebSocket path here.
// Pending command promises live in memory. An outstanding fetch keeps the object awake; if it is evicted anyway the
// caller gets "outcome_unknown" and the agent loop stops (it never replays a click or keystroke).

const COMMAND_TIMEOUT_MS = 20000;
const MAX_FRAME = 3_000_000; // screenshots are JPEG base64, typically 150-400 KB
const RUN_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 2 * 60 * 1000;

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
/** Constant-time compare of two 64-char hex digests. */
export function digestEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let n = a.length ^ b.length;
  for (let i = 0; i < 64; i++) n |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return n === 0;
}
const OPS = new Set(["begin", "screenshot", "act", "end", "ping"]);

export class ComputerHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.device = undefined;
    this.pending = new Map();
    state.blockConcurrencyWhile(async () => {
      this.device = await state.storage.get("device");
    });
  }

  live(ws) {
    try {
      return !!this.device && ws.deserializeAttachment()?.hash === this.device.tokenHash;
    } catch {
      return false;
    }
  }
  finish(id, response) {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(response);
  }
  drop(ws, code = 1000, reason = "Disconnected") {
    try { ws.serializeAttachment({}); } catch {}
    for (const [id, p] of this.pending) if (p.ws === ws) this.finish(id, json({ id, ok: false, error: "outcome_unknown" }, 503));
    try { ws.close(code, reason); } catch {}
  }
  disconnectAll(reason) {
    for (const ws of this.state.getWebSockets()) this.drop(ws, 1000, reason);
  }
  socket() {
    return this.state.getWebSockets().find((w) => this.live(w));
  }

  async fetch(request) {
    let path;
    try {
      path = new URL(request.url).pathname;
    } catch {
      return json({ error: "bad_url" }, 400);
    }
    // Management calls must name the user this hub belongs to (set by the admin-gated Next routes). The first call binds
    // the hub to that user; any later call naming a different user is refused, so a mis-routed call can't reach a device.
    if (path !== "/ws") {
      const who = String(request.headers.get("X-Hub-User") ?? "").slice(0, 128);
      if (!who) return json({ error: "user_required" }, 403);
      const bound = await this.state.blockConcurrencyWhile(async () => {
        const cur = await this.state.storage.get("hubUser");
        if (!cur) { await this.state.storage.put("hubUser", who); return who; }
        return cur;
      });
      if (bound !== who) return json({ error: "wrong_user" }, 403);
    }
    try {
      // Never await a helper reply inside blockConcurrencyWhile: the reply arrives via webSocketMessage.
      if (path === "/command" && request.method === "POST") {
        const c = await request.json();
        const fence = await this.state.blockConcurrencyWhile(() => this.fence(c));
        return fence ?? (await this.command(c));
      }
      if (path === "/stop" && request.method === "POST") return await this.stop();
      return await this.state.blockConcurrencyWhile(() => this.serial(path, request));
    } catch {
      return json({ error: "request_failed" }, 400);
    }
  }

  async serial(path, request) {
    const now = Date.now();
    if (path === "/pair" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const token = "c3l_" + this.state.id.toString() + "_" + hex(crypto.getRandomValues(new Uint8Array(32)));
      const device = { tokenHash: await sha256Hex(token), name: String(body?.name ?? "MacBook").slice(0, 80), pairedAt: now, lastSeen: 0 };
      await this.state.storage.put("device", device);
      await this.state.storage.delete(["pending", "run"]);
      this.device = device;
      this.disconnectAll("Re-paired");
      return json({ token, device: { name: device.name, pairedAt: device.pairedAt } });
    }
    if (path === "/revoke" && request.method === "POST") {
      await this.state.storage.delete(["device", "run", "pending"]);
      this.device = undefined;
      this.disconnectAll("Revoked");
      return json({ ok: true });
    }
    // Per-owner @computer settings (each admin has their own hub). autoApprove is OFF unless explicitly stored true.
    if (path === "/settings" && request.method === "GET") {
      const st = (await this.state.storage.get("settings")) ?? {};
      return json({ autoApprove: st.autoApprove === true });
    }
    if (path === "/settings" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (typeof body?.autoApprove !== "boolean") return json({ error: "bad_request" }, 400);
      const st = (await this.state.storage.get("settings")) ?? {};
      await this.state.storage.put("settings", { ...st, autoApprove: body.autoApprove });
      return json({ autoApprove: body.autoApprove });
    }
    if (path === "/status" && request.method === "GET") {
      const d = this.device;
      const ws = this.socket();
      const run = await this.state.storage.get("run");
      return json({
        paired: !!d,
        connected: !!ws,
        helper: ws ? ws.deserializeAttachment()?.info ?? null : null,
        device: d ? { name: d.name, pairedAt: d.pairedAt, lastSeen: d.lastSeen } : null,
        run: run && run.expiresAt > now ? { id: run.id, startedAt: run.startedAt, stopRequested: !!run.stopRequested } : null,
      });
    }
    if (path === "/run/start" && request.method === "POST") {
      const { id, maxRunsPerDay } = await request.json();
      if (typeof id !== "string" || !id || id.length > 64) return json({ error: "bad_request" }, 400);
      const run = await this.state.storage.get("run");
      if (run && run.expiresAt > now && run.id !== id) return json({ error: "busy" }, 409);
      if (run && run.id === id && run.expiresAt > now) return json({ ok: true }); // already leased (claimed resume)
      // Durable per-owner daily cap (UTC day), shared across isolates.
      const day = new Date(now).toISOString().slice(0, 10);
      const quota = (await this.state.storage.get("quota")) ?? { day, runs: 0 };
      const q = quota.day === day ? quota : { day, runs: 0 };
      const cap = Number.isInteger(maxRunsPerDay) && maxRunsPerDay > 0 ? maxRunsPerDay : 100;
      if (q.runs >= cap) return json({ error: "daily_cap" }, 429);
      await this.state.storage.put("quota", { day, runs: q.runs + 1 });
      await this.state.storage.put("run", { id, startedAt: now, expiresAt: now + RUN_TTL_MS, stopRequested: false, generation: this.device?.pairedAt ?? 0 });
      return json({ ok: true });
    }
    if (path === "/run/check" && request.method === "POST") {
      const { id } = await request.json();
      const run = await this.state.storage.get("run");
      const active = !!run && run.id === id && run.expiresAt > now;
      return json({ active, stopRequested: active ? !!run.stopRequested : true });
    }
    if (path === "/run/stop" && request.method === "POST") {
      // Run-scoped stop (stream cancel): only touches the run it names.
      const { id } = await request.json();
      const run = await this.state.storage.get("run");
      if (!run || run.id !== id) return json({ ok: true, matched: false });
      await this.state.storage.put("run", { ...run, stopRequested: true });
      const p = await this.state.storage.get("pending");
      if (p?.runId === id) await this.state.storage.delete("pending");
      const ws = this.socket();
      if (ws) { try { ws.send(JSON.stringify({ id: "stop-" + Date.now(), op: "stop", runId: id })); } catch {} }
      return json({ ok: true, matched: true });
    }
    if (path === "/pending/claim" && request.method === "POST") {
      // Atomic resume: validate the approval + pairing, take the run lease, THEN consume. A busy relay leaves it intact.
      const { id, runId, maxRunsPerDay } = await request.json();
      const p = await this.state.storage.get("pending");
      if (!p || typeof id !== "string" || !digestEqual(await sha256Hex(p.id), await sha256Hex(id))) return json({ error: "not_found" }, 404);
      if (p.expiresAt <= now || p.generation !== (this.device?.pairedAt ?? -1)) {
        await this.state.storage.delete("pending");
        return json({ error: p.expiresAt <= now ? "expired" : "not_found" }, p.expiresAt <= now ? 410 : 404);
      }
      if (typeof runId !== "string" || !runId || runId.length > 64) return json({ error: "bad_request" }, 400);
      const run = await this.state.storage.get("run");
      if (run && run.expiresAt > now && run.id !== p.runId) return json({ error: "busy" }, 409);
      const day = new Date(now).toISOString().slice(0, 10);
      const quota = (await this.state.storage.get("quota")) ?? { day, runs: 0 };
      const q = quota.day === day ? quota : { day, runs: 0 };
      const cap = Number.isInteger(maxRunsPerDay) && maxRunsPerDay > 0 ? maxRunsPerDay : 100;
      if (q.runs >= cap) return json({ error: "daily_cap" }, 429);
      await this.state.storage.put("quota", { day, runs: q.runs + 1 });
      await this.state.storage.put("run", { id: runId, startedAt: now, expiresAt: now + RUN_TTL_MS, stopRequested: false, generation: this.device?.pairedAt ?? 0 });
      await this.state.storage.delete("pending");
      return json({ ok: true, data: p.data });
    }
    if (path === "/run/end" && request.method === "POST") {
      const { id } = await request.json();
      const run = await this.state.storage.get("run");
      if (run && run.id === id) await this.state.storage.delete("run");
      return json({ ok: true });
    }
    if (path === "/pending/put" && request.method === "POST") {
      const { id, data, runId } = await request.json();
      if (typeof id !== "string" || id.length < 16 || id.length > 128) return json({ error: "bad_request" }, 400);
      // Only a live, un-stopped run may ask for a confirmation (a late agent can't park one after STOP).
      const run = await this.state.storage.get("run");
      if (!run || run.id !== runId || run.stopRequested || run.expiresAt <= now) return json({ error: "stopped" }, 409);
      await this.state.storage.put("pending", { id, data, runId, expiresAt: now + PENDING_TTL_MS, generation: this.device?.pairedAt ?? 0 });
      return json({ ok: true, expiresAt: now + PENDING_TTL_MS });
    }
    if (path === "/pending/consume" && request.method === "POST") {
      // Single use: whatever happens, the stored confirmation is gone after this call.
      // Single use. A wrong id leaves the real record alone; a match is deleted whether or not it's still valid.
      const { id } = await request.json();
      const p = await this.state.storage.get("pending");
      if (!p || typeof id !== "string" || !digestEqual(await sha256Hex(p.id), await sha256Hex(id))) return json({ error: "not_found" }, 404);
      await this.state.storage.delete("pending");
      if (p.expiresAt <= now) return json({ error: "expired" }, 410);
      if (p.generation !== (this.device?.pairedAt ?? -1)) return json({ error: "not_found" }, 404);
      return json({ ok: true, data: p.data });
    }
    if (path === "/pending/clear" && request.method === "POST") {
      await this.state.storage.delete("pending");
      return json({ ok: true });
    }
    if (path === "/ws" && request.method === "GET") return this.accept(request);
    return json({ error: "not_found" }, 404);
  }

  async accept(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "upgrade_required" }, 426);
    const m = /^Bearer (\S{1,256})$/.exec(request.headers.get("Authorization") ?? "");
    const t = m ? TOKEN_RE.exec(m[1]) : null;
    if (!t || t[1] !== this.state.id.toString()) return json({ error: "unauthorized" }, 401);
    if (!this.device || !digestEqual(await sha256Hex(m[1]), this.device.tokenHash)) return json({ error: "unauthorized" }, 401);
    this.disconnectAll("Replaced by a new helper connection");
    const pair = new WebSocketPair();
    const info = {
      version: String(request.headers.get("X-Helper-Version") ?? "").slice(0, 20),
      host: String(request.headers.get("X-Helper-Host") ?? "").slice(0, 60),
      connectedAt: Date.now(),
    };
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ hash: this.device.tokenHash, info });
    this.device.lastSeen = Date.now();
    await this.state.storage.put("device", this.device);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** Serialized lease check: every command except a bare ping must carry the active, un-stopped runId. */
  async fence(c) {
    if (!c || typeof c !== "object") return json({ error: "bad_request" }, 400);
    if (c.op === "ping") return null;
    const run = await this.state.storage.get("run");
    const now = Date.now();
    if (!run || run.id !== c.runId || run.expiresAt <= now) return json({ error: "stale_run" }, 409);
    if (run.generation !== (this.device?.pairedAt ?? -1)) return json({ error: "stale_run" }, 409);
    if (run.stopRequested && c.op !== "end") return json({ error: "stopped" }, 409);
    return null;
  }

  command(c) {
    if (!c || typeof c.id !== "string" || !c.id || c.id.length > 128 || !OPS.has(c.op)) return json({ error: "bad_request" }, 400);
    if (this.pending.size) return json({ error: "busy" }, 409);
    const ws = this.socket();
    if (!ws) return json({ error: "offline" }, 503);
    const timeoutMs = Math.min(Math.max(Number(c.timeoutMs) || COMMAND_TIMEOUT_MS, 1000), 30000);
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.finish(c.id, json({ id: c.id, ok: false, error: "outcome_unknown" }, 504)), timeoutMs);
      this.pending.set(c.id, { ws, timer, resolve });
      try {
        ws.send(JSON.stringify({ id: c.id, op: c.op, runId: c.runId ?? null, action: c.action ?? null, task: c.task ?? null, maxSteps: c.maxSteps ?? null }));
      } catch {
        this.drop(ws);
      }
    });
  }

  /** Kill switch from the web: flags the run and tells the helper to stop NOW, bypassing the busy check. */
  async stop() {
    const run = await this.state.storage.get("run");
    if (run) await this.state.storage.put("run", { ...run, stopRequested: true });
    await this.state.storage.delete("pending");
    const ws = this.socket();
    let sent = false;
    if (ws) {
      try { ws.send(JSON.stringify({ id: "stop-" + Date.now(), op: "stop" })); sent = true; } catch {}
    }
    for (const [id] of this.pending) this.finish(id, json({ id, ok: false, error: "stopped" }, 409));
    return json({ ok: true, helperNotified: sent });
  }

  async webSocketMessage(ws, data) {
    if (!this.live(ws)) return this.drop(ws, 1008, "Not paired");
    let m;
    try {
      if (typeof data !== "string" || data.length > MAX_FRAME) throw new Error("frame");
      m = JSON.parse(data);
      if (typeof m.id !== "string") throw new Error("shape");
    } catch {
      return this.drop(ws, 1003, "Bad frame");
    }
    if (m.type === "hello" || m.id.startsWith("evt-")) {
      // Helper-initiated events (hello, local STOP pressed). Local STOP flags the run so the loop ends.
      if (m.event === "local_stop") {
        const run = await this.state.storage.get("run");
        if (run) await this.state.storage.put("run", { ...run, stopRequested: true });
        await this.state.storage.delete("pending");
        for (const [id] of this.pending) this.finish(id, json({ id, ok: false, error: "stopped_on_mac" }, 409));
      }
    } else if (this.pending.get(m.id)?.ws === ws) {
      this.finish(m.id, json(m.ok === true ? { id: m.id, ok: true, result: m.result ?? null } : { id: m.id, ok: false, error: String(m.error ?? "failed").slice(0, 500) }));
    }
    if (this.device && Date.now() - (this.device.lastSeen || 0) > 30000) {
      this.device.lastSeen = Date.now();
      await this.state.storage.put("device", this.device);
    }
  }
  webSocketClose(ws) { this.drop(ws); }
  webSocketError(ws) { this.drop(ws); }
}

/** Hub name for one user. Must match lib/computer/hub-client.ts. */
export function hubNameForUser(userId) {
  const id = String(userId ?? "").trim();
  if (!id) throw new Error("hub_user_required");
  return `user:${id}`;
}

export const TOKEN_RE = /^c3l_([0-9a-f]{64})_[0-9a-f]{64}$/;

/** Worker entry for GET /api/computer/ws. Only this path is forwarded to the hub; the hub checks the token. */
export function computerSocket(request, env) {
  if (!env.COMPUTER_HUB) return new Response("Not found", { status: 404 });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Upgrade required", { status: 426 });
  // Cheap edge check before waking the Durable Object: a well-formed bearer token must be present.
  const m = /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "");
  const t = m ? TOKEN_RE.exec(m[1]) : null;
  if (!t) return new Response("Unauthorized", { status: 401 });
  // Route by the DO id inside the token. That hub then verifies the full token hash, so a forged id gets a 401 there.
  let id;
  try { id = env.COMPUTER_HUB.idFromString(t[1]); } catch { return new Response("Unauthorized", { status: 401 }); }
  const stub = env.COMPUTER_HUB.get(id);
  return stub.fetch(new Request("https://hub.internal/ws", { method: "GET", headers: request.headers }));
}
