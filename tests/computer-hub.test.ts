/**
 * End-to-end over a REAL Durable Object (`wrangler dev --local`, i.e. workerd) and the REAL Python helper in --dry-run mode:
 * pair → helper dials out → agent loop drives screenshot/act → revoke kicks the helper → old token is refused.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import os from "node:os";
import fs from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import http from "node:http";
import { runComputerTask, type AgentEvent } from "@/lib/computer/agent";
import type { HubClient } from "@/lib/computer/hub-client";

const root = path.resolve(import.meta.dirname, "..");
let dev: ChildProcess;
let base: string;
const hubFor = (userId: string): HubClient => ({
  async call(p, body, method = body === undefined ? "GET" : "POST") {
    const r = await fetch(`${base}internal/${userId}${p}`, { method, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
    return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
  },
});
const hub = hubFor("u-cruz");
const TOKEN = /^c3l_[0-9a-f]{64}_[0-9a-f]{64}$/;

function startHelper(token: string) {
  const child = spawn("python3", [path.join(root, "tools/mac-helper/citad3l_helper.py"), "run", "--dry-run", "--once", "--server", base.replace(/\/$/, ""), "--token-env", "C3L_TOKEN"], {
    env: { ...process.env, C3L_TOKEN: token, PYTHONUNBUFFERED: "1" },
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const exited = new Promise<number | null>((res) => child.on("exit", (c) => res(c)));
  return { child, out: () => out, exited };
}
async function until(fn: () => Promise<boolean> | boolean, ms = 10000) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("timeout");
}
const kids: ChildProcess[] = [];

/** Raw HTTP upgrade attempt; returns the status line code (101 = accepted). */
function wsStatus(token: string | null): Promise<number> {
  return new Promise((resolve, reject) => {
    const u = new URL(`${base}api/computer/ws`);
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    r.on("upgrade", (res, socket) => { socket.destroy(); resolve(res.statusCode ?? 0); });
    r.on("response", (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    r.on("error", reject);
    r.end();
  });
}

beforeAll(async () => {
  const port = 18700 + Math.floor(Math.random() * 1000);
  base = `http://127.0.0.1:${port}/`;
  const persist = fs.mkdtempSync(path.join(os.tmpdir(), "c3l-hub-"));
  dev = spawn(path.join(root, "node_modules/.bin/wrangler"), ["dev", "-c", "tests/fixtures/wrangler.hub.jsonc", "--local", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", persist, "--show-interactive-dev-session=false", "--log-level", "warn"], {
    cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1", CLOUDFLARE_API_TOKEN: "", CLOUDFLARE_ACCOUNT_ID: "" },
  });
  let log = "";
  dev.stdout?.on("data", (d) => (log += d));
  dev.stderr?.on("data", (d) => (log += d));
  try {
    await until(async () => { try { return (await fetch(`${base}internal/u-probe/status`)).ok; } catch { return false; } }, 60000);
  } catch {
    throw new Error("wrangler dev did not start:\n" + log.slice(-2000));
  }
}, 90000);
afterAll(async () => {
  for (const k of kids) k.kill();
  dev?.kill();
});

describe("ComputerHub + Mac helper (dry-run)", () => {
  it("rejects sockets with no token or a wrong token", async () => {
    expect((await hub.call("/status")).body).toMatchObject({ paired: false, connected: false });
    expect(await wsStatus("c3l_nope")).toBe(401);
    expect(await wsStatus(null)).toBe(401);
    expect((await fetch(`${base}api/computer/ws`)).status).toBe(426);
  });

  it("pairs, connects, runs a task, revokes", async () => {
    const pair = await hub.call<{ token: string }>("/pair", { name: "Test Mac" });
    expect(pair.status).toBe(200);
    expect(pair.body.token).toMatch(TOKEN);

    const h = startHelper(pair.body.token);
    kids.push(h.child);
    await until(async () => (await hub.call<{ connected: boolean }>("/status")).body.connected === true);

    const replies = [
      { thought: "open spotlight", action: { type: "key", keys: ["cmd", "space"] } },
      { thought: "type app", action: { type: "type", text: "Safari" } },
      { thought: "launch", action: { type: "key", keys: ["enter"] } },
      { thought: "finished", action: { type: "done", summary: "Safari opened." } },
    ];
    let i = 0;
    const sizes: number[] = [];
    const events: AgentEvent[] = [];
    const summary = await runComputerTask({
      runId: "it-1", task: "open Safari", hub, model: "test-vision-model", maxSteps: 10, signal: new AbortController().signal,
      emit: (e) => events.push(e),
      decide: async (input) => { sizes.push(input.width); return { raw: JSON.stringify(replies[i++]), promptTokens: 1500, completionTokens: 60 }; },
    });
    expect(summary.outcome).toBe("done");
    expect(sizes).toEqual([1440, 1440, 1440, 1440]); // real screenshots came back through the DO
    await until(() => h.out().includes('"text": "Safari"'));
    expect(h.out()).toContain('[dry-run] {"type": "key", "keys": ["cmd", "space"]}');
    expect(h.out()).toContain('[dry-run] {"type": "key", "keys": ["enter"]}');
    expect((await hub.call<{ run: unknown }>("/status")).body.run).toBeNull(); // lock released

    // a second run while one is active is refused
    await hub.call("/run/start", { id: "other" });
    expect((await hub.call("/run/start", { id: "mine" })).status).toBe(409);
    await hub.call("/run/end", { id: "other" });

    // web kill switch reaches the helper even while no command is pending
    const stop = await hub.call<{ helperNotified: boolean }>("/stop", {});
    expect(stop.body.helperNotified).toBe(true);
    await until(() => h.out().includes("stopped from Citad3L"));

    // confirmations: only a live run may park one; a wrong id doesn't destroy it; single-use
    expect((await hub.call("/pending/put", { id: "p".repeat(32), data: { x: 1 }, runId: "nope" })).status).toBe(409);
    await hub.call("/run/start", { id: "conf" });
    expect((await hub.call("/pending/put", { id: "p".repeat(32), data: { x: 1 }, runId: "conf" })).status).toBe(200);
    expect((await hub.call("/pending/consume", { id: "q".repeat(32) })).status).toBe(404);
    expect((await hub.call("/pending/consume", { id: "p".repeat(32) })).status).toBe(200);
    expect((await hub.call("/pending/consume", { id: "p".repeat(32) })).status).toBe(404);
    // after web STOP, the stopped run can't park a confirmation or send input
    await hub.call("/stop", {});
    expect((await hub.call("/pending/put", { id: "r".repeat(32), data: {}, runId: "conf" })).status).toBe(409);
    expect((await hub.call("/command", { id: "late", runId: "conf", op: "act", action: { type: "key", keys: ["a"] } })).status).toBe(409);
    await hub.call("/run/end", { id: "conf" });

    // revoke: helper is disconnected and the old token no longer works
    await hub.call("/revoke", {});
    expect(await h.exited).not.toBeNull();
    expect(await wsStatus(pair.body.token)).toBe(401);
    expect((await hub.call("/status")).body).toMatchObject({ paired: false, connected: false });
  }, 40000);

  it("confirm claim is atomic; run-scoped stop only touches its own run", async () => {
    await hub.call("/revoke", {});
    await hub.call("/pair", { name: "D" });
    await hub.call("/run/start", { id: "orig" });
    expect((await hub.call("/pending/put", { id: "k".repeat(32), data: { a: 1 }, runId: "orig" })).status).toBe(200);
    await hub.call("/run/end", { id: "orig" });
    await hub.call("/run/start", { id: "intruder" });
    expect((await hub.call("/pending/claim", { id: "k".repeat(32), runId: "resume-1" })).status).toBe(409); // busy → kept
    expect((await hub.call("/run/stop", { id: "someone-else" })).body).toMatchObject({ matched: false });
    expect((await hub.call<{ run: any }>("/status")).body.run.stopRequested).toBe(false);
    await hub.call("/run/end", { id: "intruder" });
    const claim = await hub.call<{ data: any }>("/pending/claim", { id: "k".repeat(32), runId: "resume-1" });
    expect(claim.status).toBe(200);
    expect(claim.body.data).toEqual({ a: 1 });
    expect((await hub.call<{ run: any }>("/status")).body.run.id).toBe("resume-1"); // lease taken atomically
    expect((await hub.call("/pending/claim", { id: "k".repeat(32), runId: "resume-2" })).status).toBe(404); // single use
    expect((await hub.call("/run/stop", { id: "resume-1" })).body).toMatchObject({ matched: true });
    await hub.call("/run/end", { id: "resume-1" });
  });

  it("enforces the durable daily run cap", async () => {
    for (let i = 0; i < 3; i++) { expect((await hub.call("/run/start", { id: `cap-${i}`, maxRunsPerDay: 1000 })).status).toBe(200); await hub.call("/run/end", { id: `cap-${i}` }); }
    expect((await hub.call("/run/start", { id: "cap-x", maxRunsPerDay: 1 })).status).toBe(429);
  });

  it("re-pairing invalidates the previous token", async () => {
    const a = await hub.call<{ token: string }>("/pair", { name: "A" });
    const b = await hub.call<{ token: string }>("/pair", { name: "B" });
    expect(await wsStatus(a.body.token)).toBe(401);
    expect(await wsStatus(b.body.token)).toBe(101);
  });

  it("a command with the helper offline fails fast instead of hanging", async () => {
    expect((await hub.call("/command", { id: "x0", op: "screenshot" })).status).toBe(409); // no run → fenced
    await hub.call("/revoke", {});
    await hub.call("/pair", { name: "C" });
    await hub.call("/run/start", { id: "r-off" });
    const r = await hub.call("/command", { id: "x1", runId: "r-off", op: "screenshot" });
    expect(r.status).toBe(503);
    expect((await hub.call("/command", { id: "x2", runId: "someone-else", op: "act", action: {} })).status).toBe(409);
    await hub.call("/run/end", { id: "r-off" });
  });

  it("auto-approve: OFF by default in the real hub, explicit true only, independent per admin (pre-deploy review, blocker 2)", async () => {
    const a = hubFor("u-settings-a"), b = hubFor("u-settings-b");
    expect((await a.call("/settings")).body).toEqual({ autoApprove: false });
    expect((await b.call("/settings")).body).toEqual({ autoApprove: false });
    expect((await a.call("/settings", { autoApprove: "yes" })).status).toBe(400);
    expect((await a.call("/settings", { autoApprove: true })).body).toEqual({ autoApprove: true });
    expect((await a.call("/settings")).body).toEqual({ autoApprove: true });
    expect((await b.call("/settings")).body).toEqual({ autoApprove: false }); // A's choice never reaches B
    await a.call("/settings", { autoApprove: false });
    expect((await a.call("/settings")).body).toEqual({ autoApprove: false });
  });
  it("per-user isolation: each admin's session only reaches THEIR OWN Mac", async () => {
    const cruz = hubFor("u-iso-cruz");
    const cousin = hubFor("u-iso-cousin");
    const tc = (await cruz.call<{ token: string }>("/pair", { name: "Owner Mac" })).body.token;
    const tk = (await cousin.call<{ token: string }>("/pair", { name: "Cousin Mac" })).body.token;
    expect(tc).toMatch(TOKEN);
    expect(tk).toMatch(TOKEN);
    expect(tc.slice(4, 68)).not.toBe(tk.slice(4, 68)); // different hubs

    // Forged token: the cousin's hub id + the owner's secret (and vice versa) is refused by the hub it routes to.
    const forged = "c3l_" + tk.slice(4, 68) + "_" + tc.slice(69);
    expect(await wsStatus(forged)).toBe(401);
    expect(await wsStatus("c3l_" + tc.slice(4, 68) + "_" + tk.slice(69))).toBe(401);
    expect(await wsStatus("c3l_" + "0".repeat(64) + "_" + tc.slice(69))).toBe(401); // not a real DO id

    // Only the owner's helper connects. It shows up in the owner's hub and NOT in the cousin's.
    const h = startHelper(tc);
    kids.push(h.child);
    await until(async () => (await cruz.call<{ connected: boolean }>("/status")).body.connected === true);
    expect((await cousin.call<{ connected: boolean; device: any }>("/status")).body).toMatchObject({ connected: false, device: { name: "Cousin Mac" } });

    // The cousin's run and commands go to the cousin's hub and never reach the owner's Mac.
    expect((await cousin.call("/run/start", { id: "k-run" })).status).toBe(200);
    expect((await cousin.call("/command", { id: "k1", runId: "k-run", op: "screenshot" })).status).toBe(503); // no Mac of theirs online
    expect((await cousin.call("/command", { id: "k2", runId: "k-run", op: "act", action: { type: "type", text: "XSECRETX" } })).status).toBe(503);
    const stop = await cousin.call<{ helperNotified: boolean }>("/stop", {});
    expect(stop.body.helperNotified).toBe(false);
    await cousin.call("/run/end", { id: "k-run" });
    // ...and the cousin revoking only revokes the cousin's pairing.
    await cousin.call("/revoke", {});
    expect((await cruz.call<{ connected: boolean }>("/status")).body.connected).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    expect(h.out()).not.toContain("XSECRETX");
    expect(h.out()).not.toContain("stopped from Citad3L");

    // A call routed to the owner's hub but tagged as another user (or untagged) is refused.
    for (const who of ["u-iso-cousin", ""]) {
      for (const [path, body] of [["/status", null], ["/pair", {}], ["/revoke", {}], ["/stop", {}], ["/run/start", { id: "x" }]] as const) {
        const r = await fetch(`${base}raw/u-iso-cruz/${who}${path}`, { method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined });
        expect(r.status, `${who || "untagged"} ${path}`).toBe(403);
      }
    }
    expect((await cruz.call<{ connected: boolean; device: any }>("/status")).body).toMatchObject({ connected: true, device: { name: "Owner Mac" } });
    await cruz.call("/revoke", {});
    expect(await h.exited).not.toBeNull();
  }, 40000);
});
