import { z } from "zod";

/** Normalized screen coordinate: 0..1000 of the screenshot (the vision model's native grid), mapped to points on the Mac. */
const Coord = z.number().finite().min(0).max(1000).transform((n) => Math.round(n));

export const ALLOWED_KEYS = new Set([
  "cmd", "command", "ctrl", "control", "option", "alt", "shift", "fn",
  "enter", "return", "tab", "esc", "escape", "space", "backspace", "delete",
  "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
  ..."abcdefghijklmnopqrstuvwxyz0123456789".split(""),
  "-", "=", "[", "]", ";", "'", ",", ".", "/", "\\", "`",
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
]);

export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: Coord, y: Coord, button: z.enum(["left", "right"]).default("left"), clicks: z.union([z.literal(1), z.literal(2)]).default(1) }),
  z.object({ type: z.literal("move"), x: Coord, y: Coord }),
  z.object({ type: z.literal("drag"), x: Coord, y: Coord, toX: Coord, toY: Coord }),
  z.object({ type: z.literal("scroll"), x: Coord.optional(), y: Coord.optional(), dy: z.number().int().min(-15).max(15) }),
  // No control characters: a newline or tab inside typed text could submit or move focus without the confirm gate.
  z.object({ type: z.literal("type"), text: z.string().min(1).max(500).regex(/^[^\u0000-\u001f\u007f]+$/, "no newlines, tabs or control characters in typed text (press enter or tab with a key action)") }),
  z.object({
    type: z.literal("key"),
    keys: z.array(z.string().trim().toLowerCase().refine((k) => ALLOWED_KEYS.has(k), "key not allowed")).min(1).max(4),
  }),
  z.object({ type: z.literal("wait"), ms: z.number().int().min(100).max(5000) }),
  z.object({ type: z.literal("done"), summary: z.string().max(1000).default("Done.") }),
]);
export type Action = z.infer<typeof Action>;

export const Decision = z.object({
  thought: z.string().max(1200).default(""),
  risky: z.boolean().default(false),
  action: Action,
});
export type Decision = z.infer<typeof Decision>;

export class BadDecision extends Error {}

/**
 * Parse a model reply into a validated Decision.
 *
 * Tolerant on FORMAT, strict on SAFETY: it strips <think>/<tool_call> wrappers and ```json fences, skips prose, tries
 * every top-level JSON object in the reply, repairs trailing commas, and maps the vision model's native computer-use shape
 * ({"action":"left_click","coordinate":[x,y]}, {"name":"computer_use","arguments":{...}}) and common aliases onto our
 * schema. It never relaxes a limit that matters: coordinates outside 0..1000, disallowed keys, and typed text over
 * 500 chars are still rejected (with a message the model can act on), never clamped or truncated.
 */
export function parseDecision(raw: string): Decision {
  const text = stripWrappers(raw ?? "");
  const candidates = jsonObjects(text);
  if (!candidates.length) {
    if (/\{/.test(text)) throw new BadDecision("The JSON object in your reply was cut off or unterminated.");
    throw new BadDecision("Your reply had no JSON object.");
  }
  let firstError: string | null = null;
  for (const c of candidates) {
    const obj = parseLoose(c);
    if (obj === undefined) { firstError ??= "Your reply was not valid JSON."; continue; }
    const r = Decision.safeParse(normalizeDecision(obj));
    if (r.success && r.data.action.type === "click" && r.data.action.button === "right" && r.data.action.clicks === 2) {
      // The first right-click opens a context menu; a second would land on the menu. The helper refuses it too.
      firstError ??= "Right double-click isn't supported. Use a left double_click, or one right click.";
      continue;
    }
    if (r.success) return r.data;
    firstError ??= describeIssue(r.error.issues[0]);
  }
  throw new BadDecision(firstError ?? "Your reply was not valid JSON.");
}

function stripWrappers(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/^[\s\S]*?<\/think>/i, " ") // a reasoning block whose opening tag was dropped
    .replace(/<\/?tool_call>/gi, " ")
    .replace(/```(?:json)?/gi, " ")
    .replace(/[\u201c\u201d]/g, '"')
    .trim();
}

/** Every balanced top-level {...} span in the text, in order (braces inside strings are ignored). */
function jsonObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0, inStr = false, esc = false, start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"' && depth > 0) inStr = true;
    else if (ch === "{") { if (depth++ === 0) start = i; }
    else if (ch === "}" && depth > 0 && --depth === 0) out.push(text.slice(start, i + 1));
  }
  return out;
}

function parseLoose(s: string): unknown {
  try { return JSON.parse(s); } catch { /* try a light repair */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, "$1")); } catch { return undefined; }
}

const TYPE_ALIASES: Record<string, Record<string, unknown>> = {
  click: { type: "click" }, left_click: { type: "click" }, tap: { type: "click" }, mouse_click: { type: "click" },
  right_click: { type: "click", button: "right" }, double_click: { type: "click", clicks: 2 }, doubleclick: { type: "click", clicks: 2 },
  dblclick: { type: "click", clicks: 2 }, dbl_click: { type: "click", clicks: 2 }, left_double_click: { type: "click", clicks: 2 },
  move: { type: "move" }, mouse_move: { type: "move" }, hover: { type: "move" },
  drag: { type: "drag" }, left_click_drag: { type: "drag" },
  scroll: { type: "scroll" },
  type: { type: "type" }, type_text: { type: "type" }, input: { type: "type" }, write: { type: "type" },
  key: { type: "key" }, keys: { type: "key" }, hotkey: { type: "key" }, keypress: { type: "key" }, key_press: { type: "key" }, press: { type: "key" },
  wait: { type: "wait" }, sleep: { type: "wait" },
  done: { type: "done" }, terminate: { type: "done" }, answer: { type: "done" }, finish: { type: "done" }, finished: { type: "done" }, stop: { type: "done" },
};
const KEY_ALIASES: Record<string, string> = {
  meta: "cmd", super: "cmd", "⌘": "cmd", opt: "option", ctl: "ctrl", esc: "esc",
  arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
  up_arrow: "up", down_arrow: "down", left_arrow: "left", right_arrow: "right",
  page_up: "pageup", page_down: "pagedown", spacebar: "space", back_space: "backspace",
};

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v);

/** Map the shapes vision models actually emit onto {thought, risky, action}. Pure reshaping; validation is zod's job. */
export function normalizeDecision(input: unknown): unknown {
  if (!isObj(input)) return input;
  let o: Record<string, any> = input;
  // Tool-call wrapper: {"name":"computer_use","arguments":{...}} (arguments may be a JSON string).
  if (o.arguments !== undefined && o.action === undefined) {
    const args = typeof o.arguments === "string" ? parseLoose(o.arguments) : o.arguments;
    if (isObj(args)) o = { ...args, thought: o.thought ?? args.thought };
  }
  const thought = o.thought ?? o.reasoning ?? o.reason ?? o.thinking ?? o.explanation ?? "";
  const risky = o.risky === "true" ? true : o.risky === "false" ? false : o.risky;
  let action: any;
  if (isObj(o.action)) action = o.action;
  else if (typeof o.action === "string") action = { ...o, type: o.action }; // Native shape: fields sit beside "action"
  else if (typeof o.type === "string") action = o; // bare action, no wrapper
  else action = o.action;
  return { thought: typeof thought === "string" ? thought.slice(0, 1200) : thought, risky: risky ?? false, action: isObj(action) ? normalizeAction(action) : action };
}

function normalizeAction(a: Record<string, any>): Record<string, unknown> {
  const rawType = String(a.type ?? a.action ?? "").trim().replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[\s-]+/g, "_");
  const base = TYPE_ALIASES[rawType] ?? { type: rawType };
  const out: Record<string, unknown> = { ...base };
  const t = base.type;
  const pt = pointOf(a.coordinate ?? a.coordinates ?? a.point ?? a.position ?? a.point_2d ?? a.bbox_2d ?? a.bbox ?? a.start_coordinate ?? a.from);
  const [x, y] = splitPair(a.x, a.y, pt);
  if (t === "click" || t === "move" || t === "drag" || t === "scroll") {
    if (x !== undefined) out.x = x;
    if (y !== undefined) out.y = y;
  }
  if (t === "click") {
    if (a.button !== undefined) out.button = String(a.button).toLowerCase();
    if (a.clicks !== undefined) out.clicks = num(a.clicks);
    else if (a.double === true || a.doubleClick === true || a.double_click === true) out.clicks = 2;
  }
  if (t === "drag") {
    const to = pointOf(a.toCoordinate ?? a.to_coordinate ?? a.end_coordinate ?? a.to);
    [out.toX, out.toY] = splitPair(a.toX ?? a.to_x, a.toY ?? a.to_y, to);
  }
  if (t === "scroll") {
    // Not the model's "pixels" field: its sign convention (positive = up) is the opposite of ours.
    let dy: unknown = num(a.dy ?? a.amount ?? a.scroll_amount ?? a.delta);
    if (dy === undefined && a.direction) dy = 5;
    if (typeof dy === "number") {
      let n = dy;
      const dir = String(a.direction ?? "").toLowerCase();
      if (dir === "up") n = -Math.abs(n);
      else if (dir === "down") n = Math.abs(n);
      // Scroll size is harmless to clamp (it only changes how far the page moves).
      dy = Math.max(-15, Math.min(15, Math.round(n)));
    }
    out.dy = dy;
  }
  if (t === "type") out.text = a.text ?? a.content ?? a.value;
  if (t === "key") {
    let keys = a.keys ?? a.key ?? a.combo ?? a.text;
    if (typeof keys === "string") keys = keys.split(/\s*\+\s*|\s+/).filter(Boolean);
    if (Array.isArray(keys)) {
      keys = keys.flatMap((k) => (typeof k === "string" && k.length > 1 && k.includes("+") ? k.split("+") : [k]))
        .map((k) => (typeof k === "string" ? (KEY_ALIASES[k.trim().toLowerCase()] ?? k.trim().toLowerCase()) : k));
    }
    out.keys = keys;
  }
  if (t === "wait") {
    let ms: unknown = num(a.ms);
    const secs = num(a.time ?? a.seconds ?? a.duration);
    if (ms === undefined && typeof secs === "number") ms = secs * 1000;
    // Wait length is harmless to clamp.
    out.ms = typeof ms === "number" ? Math.max(100, Math.min(5000, Math.round(ms))) : ms ?? 1000;
  }
  if (t === "done") {
    const s = a.summary ?? a.text ?? a.answer ?? a.result ?? a.status;
    if (s !== undefined) out.summary = String(s).slice(0, 1000);
  }
  return out;
}

/**
 * A point from whatever shape the model used: [x, y], "[x, y]", "x, y", "(x, y)", {x, y}, or a 4-number box
 * [x1, y1, x2, y2] (its center). Values are NOT clamped; zod still enforces 0..1000.
 */
export function pointOf(v: unknown): [number, number] | null {
  if (typeof v === "string") {
    const nums = v.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || (nums.length !== 2 && nums.length !== 4) || /[a-df-z]/i.test(v)) return null;
    v = nums.map(Number);
  }
  if (isObj(v)) v = [num(v.x), num(v.y)];
  if (!Array.isArray(v)) return null;
  const n = v.map(num);
  if (!n.every((k) => typeof k === "number" && Number.isFinite(k))) return null;
  if (n.length === 2) return [n[0] as number, n[1] as number];
  if (n.length === 4) return [((n[0] as number) + (n[2] as number)) / 2, ((n[1] as number) + (n[3] as number)) / 2];
  return null;
}

/** x/y fields, where the model may have put the whole pair in "x" (e.g. "x":[512,880]) or in "y", or as a string. */
function splitPair(xv: unknown, yv: unknown, fallback: [number, number] | null): [unknown, unknown] {
  const px = typeof xv === "number" ? null : pointOf(xv);
  const py = typeof yv === "number" ? null : pointOf(yv);
  const yn = num(yv), xn = num(xv);
  // Pair in x: use it when y is missing, the same pair, or agrees with the pair's y. A conflicting y is left as an
  // invalid x so the model is asked again rather than us guessing.
  if (px && (yv === undefined || (py && py[0] === px[0] && py[1] === px[1]) || yn === px[1])) return px;
  if (py && xv === undefined) return py;
  if (xv === undefined && yv === undefined && fallback) return fallback;
  return [px ? xv : xn ?? fallback?.[0], py ? yv : yn ?? fallback?.[1]];
}

function describeIssue(issue: { path: PropertyKey[]; message: string; code?: string } | undefined): string {
  if (!issue) return "Your action was invalid.";
  const field = issue.path.filter((p) => p !== "action").join(".") || "action";
  if (/^(x|y|toX|toY)$/.test(field) && /(too_big|too_small)/.test(issue.code ?? "")) {
    return `"${field}" was outside 0..1000. Coordinates are on the 0..1000 grid of the screenshot (500 = middle), not pixels.`;
  }
  if (field === "type" || issue.code === "invalid_union_discriminator" || issue.code === "invalid_union") {
    return 'Unknown action type. Use one of: click, double_click, move, drag, scroll, type, key, wait, done.';
  }
  if (/^(x|y|toX|toY)$/.test(field)) {
    return `Invalid "${field}": ${issue.message}. Give "x" and "y" as two separate numbers on the 0..1000 grid, e.g. {"type":"click","x":512,"y":880}.`;
  }
  if (field.startsWith("keys")) return `${issue.message} for "keys". Use 1-4 allowed key names, e.g. ["cmd","l"].`;
  return `Invalid "${field}": ${issue.message}.`;
}

/** Human-readable one-liner for the chat log. Typed text is shown (the owner is watching his own screen). */
export function describeAction(a: Action, full = false): string {
  switch (a.type) {
    case "click": return `${a.clicks === 2 ? "double-" : ""}${a.button === "right" ? "right-" : ""}click at (${a.x}, ${a.y})`;
    case "move": return `move to (${a.x}, ${a.y})`;
    case "drag": return `drag (${a.x}, ${a.y}) → (${a.toX}, ${a.toY})`;
    case "scroll": return `scroll ${a.dy > 0 ? "down" : "up"} ${Math.abs(a.dy)}`;
    case "type": return `type "${!full && a.text.length > 80 ? a.text.slice(0, 80) + "…" : a.text}"`;
    case "key": return `press ${a.keys.join("+")}`;
    case "wait": return `wait ${a.ms} ms`;
    case "done": return `done: ${a.summary}`;
  }
}

/** Audit-log form: never stores typed text, only its length. */
export function auditAction(a: Action): string {
  if (a.type === "type") return `type(${a.text.length} chars)`;
  return describeAction(a);
}

/** True when a chat message is an @computer command. */
export function isComputerCommand(message: string): boolean {
  return /^\s*@computer\b/i.test(message);
}
/** Strips the leading "@computer" so "@computer open Safari" and "open Safari" are the same task. */
export function taskFrom(message: string): string {
  return message.replace(/^\s*@computer\b[:,]?\s*/i, "").trim();
}

/** Stable comparison of two validated actions (used to re-verify a confirmed action against a fresh screen). */
export function sameAction(a: Action, b: Action): boolean {
  const norm = (x: Action) => JSON.stringify(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]));
  return norm(a) === norm(b);
}
