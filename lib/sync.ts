import type { ChatMessage } from "@/lib/types";

/**
 * Cross-device live sync by polling (cheapest: no new Durable Object, no open sockets). A tab that is VISIBLE asks
 * /api/sync for two tiny fingerprints: one for the user's conversation list, one for the open conversation. Only when a
 * fingerprint changes does it refetch the list or the messages. Hidden tabs don't poll at all.
 */
export const SYNC_FAST_MS = 4_000;
export const SYNC_SLOW_MS = 15_000;
/** After this long with nothing changing, a visible tab slows to SYNC_SLOW_MS. Any change or focus speeds it back up. */
export const SYNC_IDLE_AFTER_MS = 120_000;

export function stamp(count: number, max: Date | string | null | undefined): string {
  const t = max ? new Date(max).getTime() : 0;
  return `${count}:${t}`;
}

export function nextSyncDelay(msSinceLastChange: number): number {
  return msSinceLastChange >= SYNC_IDLE_AFTER_MS ? SYNC_SLOW_MS : SYNC_FAST_MS;
}

/**
 * Server messages replace local ones, but local-only messages (ids starting "tmp-": @computer transcripts, client-side
 * errors) are kept, each right after the message it followed locally, or at the end.
 */
export function mergeRemote(local: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  const out = [...server];
  const ids = new Set(server.map((m) => m.id));
  let anchor: string | null = null;
  const pending: { after: string | null; m: ChatMessage }[] = [];
  for (const m of local) {
    if (m.id.startsWith("tmp-")) pending.push({ after: anchor, m });
    else if (ids.has(m.id)) anchor = m.id;
  }
  for (const { after, m } of pending) {
    if (after === null) {
      out.push(m);
      continue;
    }
    // insert after the anchor and after any tmp messages already placed behind it
    let i = out.findIndex((x) => x.id === after);
    if (i < 0) { out.push(m); continue; }
    while (i + 1 < out.length && out[i + 1].id.startsWith("tmp-")) i++;
    out.splice(i + 1, 0, m);
  }
  return out;
}

/** Same messages, same content and status: skip the re-render (keeps scroll and selection still). */
export function sameMessages(a: ChatMessage[], b: ChatMessage[]): boolean {
  return a.length === b.length && a.every((m, i) => m.id === b[i].id && m.content === b[i].content && m.status === b[i].status);
}

/**
 * Generation gate (pre-deploy review, blocker 3): every screen-changing fetch takes a token when it starts and may apply its
 * result only if nothing newer happened since (chat switch, a local reply starting/finishing, sign-out, or a newer
 * fetch already applied). Older responses that arrive late are dropped instead of overwriting newer messages.
 */
export function createGate() {
  let gen = 0;
  let seq = 0;
  let applied = 0;
  return {
    /** Something changed locally: every response already in flight is now stale. */
    bump() { gen++; },
    begin(): { gen: number; seq: number } { return { gen, seq: ++seq }; },
    /** True if this token's result may be applied now (and records it as the newest applied). */
    accept(t: { gen: number; seq: number }): boolean {
      if (t.gen !== gen || t.seq < applied) return false;
      applied = t.seq;
      return true;
    },
  };
}

export type SyncStamps = { list: string; conv: string | null };
export type SyncDeps = {
  /** GET /api/sync. Throws on any failure. */
  fetchStamps(convId: string | null, signal: AbortSignal): Promise<SyncStamps>;
  /** Refetch the sidebar. Return true only if the result was applied. */
  refreshList(signal: AbortSignal): Promise<boolean>;
  /** Refetch the open chat. Return true only if the result was applied (false = failed or stale: retry later). */
  refreshConv(convId: string, signal: AbortSignal): Promise<boolean>;
  currentConvId(): string | null;
  /** A reply is streaming on this device: don't touch the open chat now, and don't acknowledge its stamp. */
  busy(): boolean;
};

/**
 * One poll loop per tab. Polls never overlap (a tick during a tick queues exactly one re-run), and a fingerprint is
 * only acknowledged after its refetch succeeded and was applied, so a failed or skipped refresh is retried on the next
 * tick. The first poll after switching chats reconciles instead of trusting the snapshot. stop() aborts in-flight fetches.
 */
export function createSyncEngine(d: SyncDeps) {
  let list: string | null = null;
  let conv: string | null = null;
  let convId: string | null | undefined;
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;
  let changedAt = Date.now();
  const ac = new AbortController();

  async function once(): Promise<void> {
    const cid = d.currentConvId();
    const s = await d.fetchStamps(cid, ac.signal);
    if (stopped) return;
    if (d.currentConvId() !== cid) { again = true; return; } // switched mid-flight: redo for the new chat
    if (s.list !== list) {
      if (await d.refreshList(ac.signal)) {
        if (list !== null) changedAt = Date.now();
        list = s.list;
      }
    }
    if (cid !== convId) { convId = cid; conv = null; } // new chat: reconcile on this poll
    if (!cid) { conv = s.conv; return; }
    if (s.conv !== conv && !d.busy()) {
      if (await d.refreshConv(cid, ac.signal)) {
        if (conv !== null) changedAt = Date.now();
        conv = s.conv;
      }
    }
  }

  return {
    tick(): Promise<void> {
      if (stopped) return Promise.resolve();
      if (running) { again = true; return running; }
      running = (async () => {
        try {
          do {
            again = false;
            try { await once(); } catch { if (ac.signal.aborted) return; /* failed: nothing acknowledged, next tick retries */ }
          } while (again && !stopped);
        } finally {
          running = null;
        }
      })();
      return running;
    },
    stop() { stopped = true; ac.abort(); },
    get changedAt() { return changedAt; },
    poke() { changedAt = Date.now(); },
    /** Test/debug view of what is acknowledged. */
    state: () => ({ list, conv, convId: convId ?? null }),
  };
}
