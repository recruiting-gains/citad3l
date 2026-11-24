import type { Action } from "./actions";

/** Grid units (0..1000) within which two points count as "the same spot". */
export const NEAR = 15;
/** Consecutive identical actions that end a run. Scrolling the same way is often legitimate, so it gets a bit more room. */
export const REPEAT_LIMIT = 3;
export const SCROLL_REPEAT_LIMIT = 4;
/** Window-management shortcuts (minimize / hide / quit) end the run on their 2nd use in a run. */
export const WINDOW_REPEAT_LIMIT = 2;
/** Waiting for an app to launch or a page to load is normal: up to this many waits in a row, ... */
export const WAIT_REPEAT_LIMIT = 5;
/** ... and up to this much waiting in a row (ms), before it counts as stuck. */
export const WAIT_TOTAL_MS = 10_000;
export const WAIT_STOP_MESSAGE = "Stopped: waited too long without anything happening.";
export const REPEAT_STOP_MESSAGE = "Stopped: the same action kept repeating without progress.";

const MODS = new Set(["cmd", "command"]);
const WINDOW_KEYS = new Set(["m", "h", "q"]);
const norm = (k: string) => (k === "command" ? "cmd" : k === "control" ? "ctrl" : k === "alt" ? "option" : k === "return" ? "enter" : k === "escape" ? "esc" : k);

const chord = (a: Action & { type: "key" }) => [...new Set(a.keys.map((k) => norm(k.toLowerCase())))].sort().join("+");

/** Any cmd chord with m/h/q: minimize, hide, quit, and also logout (cmd+shift+q) and lock (ctrl+cmd+q). */
export function isWindowAction(a: Action): boolean {
  if (a.type !== "key") return false;
  const ks = a.keys.map((k) => norm(k.toLowerCase()));
  return ks.includes("cmd") && ks.some((k) => WINDOW_KEYS.has(k));
}

/** The exact chords a task may unlock, each by its own wording. Logout/lock variants are never unlocked. */
const PERMITTED: Record<string, RegExp> = {
  "cmd+m": /\bminimi[sz]e/i,
  "cmd+h": /\bhide\b/i,
  "cmd+h+option": /\bhide\b/i,
  "cmd+q": /\b(quit|close (the )?app)\b/i,
};
const NEGATED = /\b(don'?t|do not|never|without|no)\s+(\w+\s+){0,2}(minimi[sz]|hid|quit|clos)/i;

/** True when the owner's task explicitly asks for THIS shortcut (minimize, hide or quit), and doesn't forbid it. */
export function taskAllowsWindowAction(task: string, a: Action): boolean {
  if (a.type !== "key" || !isWindowAction(a) || NEGATED.test(task)) return false;
  const re = PERMITTED[chord(a)];
  return !!re && re.test(task);
}
/** Back-compat helper: does the task ask for any minimize/hide/quit at all? */
export function taskAllowsWindowActions(task: string): boolean {
  return !NEGATED.test(task) && Object.values(PERMITTED).some((re) => re.test(task));
}

const near = (a?: number, b?: number) => (a === undefined && b === undefined) || (a !== undefined && b !== undefined && Math.abs(a - b) <= NEAR);

/** "Same action" for loop detection: same type and key set, nearly the same coordinates, same text/amount. */
export function similarAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "key": return chord(a) === chord(b as typeof a);
    case "click": { const o = b as typeof a; return a.button === o.button && a.clicks === o.clicks && near(a.x, o.x) && near(a.y, o.y); }
    case "move": { const o = b as typeof a; return near(a.x, o.x) && near(a.y, o.y); }
    case "drag": { const o = b as typeof a; return near(a.x, o.x) && near(a.y, o.y) && near(a.toX, o.toX) && near(a.toY, o.toY); }
    case "scroll": { const o = b as typeof a; return Math.sign(a.dy) === Math.sign(o.dy) && near(a.x, o.x) && near(a.y, o.y); }
    case "type": return a.text === (b as typeof a).text;
    case "wait": return true;
    case "done": return false;
  }
}

/**
 * Would running `next` after `previous` (oldest first) be a loop? Returns the stop message, or null.
 * `previous` are the actions already chosen in this run, in order.
 */
export function repetitionStop(previous: Action[], next: Action): string | null {
  // Minimize/hide/quit shortcuts: the 2nd in a run stops it, even with other actions in between.
  if (isWindowAction(next)) return previous.some(isWindowAction) ? REPEAT_STOP_MESSAGE : null;
  // Waits: Enter in Spotlight → wait → wait while Safari launches is progress-in-waiting, not a loop.
  if (next.type === "wait") {
    let n = 1, ms = next.ms;
    for (let i = previous.length - 1; i >= 0; i--) {
      const p = previous[i];
      if (p.type !== "wait") break;
      n++;
      ms += p.ms;
    }
    return n > WAIT_REPEAT_LIMIT || ms > WAIT_TOTAL_MS ? WAIT_STOP_MESSAGE : null;
  }
  // Consecutive repeats. "wait" and "move" in between aren't progress, so click → wait → click still counts.
  let run = 1;
  for (let i = previous.length - 1; i >= 0; i--) {
    const p = previous[i];
    if (similarAction(p, next)) run++;
    else if (next.type !== "move" && (p.type === "wait" || p.type === "move")) continue;
    else break;
  }
  const limit = next.type === "scroll" ? SCROLL_REPEAT_LIMIT : REPEAT_LIMIT;
  return run >= limit ? REPEAT_STOP_MESSAGE : null;
}
