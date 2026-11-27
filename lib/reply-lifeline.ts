/**
 * Keeps a chat reply alive when the phone drops the connection mid-reply (iOS Safari suspends or drops the fetch when
 * the app goes to the background, the screen locks, or the network blips). Before this, a drop cancelled the Worker
 * mid-reply: nothing was saved (the message stayed "streaming" with no text) and the app showed "Connection lost".
 *
 * Now the reply keeps running in the background (ctx.waitUntil) and is saved, so the app can pick it up from
 * /api/conversations/:id. An explicit Stop (POST /api/chat/stop marks the message "stopped") or the grace limit ends it.
 */

/**
 * After the reader is gone, let the reply run this long before stopping it and saving the partial. Cloudflare's
 * documented waitUntil window is ~30 s; in a preview test a dropped reply kept running and saved 68 s after the drop.
 * If the runtime cuts it earlier, the message stays "streaming" (the old behaviour) and the app's recovery times out.
 */
export const DISCONNECT_GRACE_MS = 90_000;
/** An SSE comment line so phones and proxies never see a silent connection (pre-first-token, design check). */
export const HEARTBEAT_MS = 10_000;
/** How often the running reply checks whether the user pressed Stop. */
export const STOP_POLL_MS = 2_000;
/** The design check is a nice-to-have: never hold a finished reply hostage for longer than this. */
export const DESIGN_CHECK_MAX_MS = 20_000;

/** On Workers, register background work with ctx.waitUntil so it is not cancelled when the client disconnects. */
export async function keepReplyAlive(p: Promise<unknown>): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = getCloudflareContext() as unknown as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } };
    if (cf?.ctx?.waitUntil) {
      cf.ctx.waitUntil(p);
      return true;
    }
  } catch {
    /* not on Workers (Node/tests) */
  }
  return false;
}

/** An abort signal that fires when `parent` aborts or after `ms`, whichever comes first. */
export function timeoutSignal(parent: AbortSignal, ms: number): { signal: AbortSignal; clear: () => void } {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  const onAbort = () => ac.abort();
  if (parent.aborted) ac.abort();
  else parent.addEventListener("abort", onAbort, { once: true });
  return { signal: ac.signal, clear: () => { clearTimeout(t); parent.removeEventListener("abort", onAbort); } };
}
