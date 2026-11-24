/**
 * "Did the last action change anything?" The Mac helper (0.1.1+) sends `sig`: a 32x18 grayscale thumbnail as hex.
 * Comparing consecutive ones tells the model when a click or key press had no visible effect, so it tries something
 * else (e.g. Spotlight) instead of repeating itself. Older helpers send no sig and this check is skipped.
 */
export const SIG_CELLS = 32 * 18;
/** A cell counts as changed when its gray level moved by more than this (JPEG noise and the cursor stay below). */
export const CELL_DELTA = 8;
/** At most this many changed cells (of 576) still counts as "no visible change". The cursor alone can touch ~2. */
export const MAX_CHANGED_CELLS = 3;

export function parseSig(sig: unknown): Uint8Array | null {
  if (typeof sig !== "string" || sig.length !== SIG_CELLS * 2 || !/^[0-9a-f]+$/i.test(sig)) return null;
  const out = new Uint8Array(SIG_CELLS);
  for (let i = 0; i < SIG_CELLS; i++) out[i] = parseInt(sig.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function changedCells(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > CELL_DELTA) n++;
  return n;
}

/** True when both signatures exist and the screen is effectively identical. */
export function noVisibleChange(prev: unknown, next: unknown): boolean {
  const a = parseSig(prev), b = parseSig(next);
  return !!a && !!b && changedCells(a, b) <= MAX_CHANGED_CELLS;
}

/**
 * This many acting steps in a row (click/key/type/drag) with no visible change end the run. The 2:50 PM CT run cycled
 * double-click → cmd+space → type → double-click for 18 steps because macOS was silently dropping every event
 * (the LaunchAgent helper had no Accessibility permission); alternating actions slipped past the repeat guard.
 */
export const STALL_LIMIT = 4;

export const STALL_MESSAGE =
  `Stopped: ${STALL_LIMIT} actions in a row changed nothing on the screen. If clicks and keys aren't reaching the Mac, ` +
  "turn on Accessibility for the helper (System Settings → Privacy & Security → Accessibility → Python), then restart the helper.";
