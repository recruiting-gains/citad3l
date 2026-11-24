import type { Action, Decision } from "./actions";

/**
 * Conservative gate for consequential actions. A hit does NOT execute: the run pauses and the owner must
 * press Confirm in chat. False positives cost a click; false negatives could send, buy, or delete.
 * Screen content is untrusted (prompt injection), so the model's own "risky" flag is only one input.
 */
const RISK_WORDS =
  /\b(send|sends|sending|sent|reply|submit|post|posting|publish|tweet|share|buy|buying|purchase|checkout|check\s*out|pay|payment|place\s+(the\s+)?order|order\s+now|subscribe|transfer|wire|withdraw|venmo|zelle|delete|deleting|remove|erase|trash|empty\s+trash|uninstall|wipe|format|overwrite|discard|unsubscribe|cancel\s+(my\s+)?(subscription|plan|account|order)|deactivate|close\s+account|accept|agree|sign\s+(up|the)|install|grant|allow\s+access|confirm|approve|authorize)\b/i;

const RISKY_TEXT = /(\brm\s+-[a-z]*[rf]|\bsudo\b|\bmkfs\b|diskutil\s+erase|\bdd\s+if=|curl[^|\n]*\|\s*(ba|z)?sh|>\s*\/dev\/|\bgit\s+push\b|\bshutdown\b|\breboot\b|\bkillall\b|\bcsrutil\b|\bspctl\b|\bsecurity\s+(delete|dump|find-generic-password))/i;

const SEND_COMBOS = [
  ["cmd", "enter"], ["cmd", "return"], ["cmd", "backspace"], ["cmd", "delete"],
  ["shift", "cmd", "backspace"], ["shift", "cmd", "delete"], ["cmd", "d"], ["option", "cmd", "esc"],
];
const norm = (k: string) => ({ command: "cmd", control: "ctrl", alt: "option", escape: "esc" } as Record<string, string>)[k] ?? k;

export type Risk = { risky: boolean; reason: string | null };
export type RiskOptions = {
  /**
   * Owner setting (default OFF; stored per admin in their hub). When ON, the model is told ordinary steps are
   * pre-approved, so it stops flagging plain launches. It never weakens the checks below: the strict policy always
   * applies, the model's "risky" flag is always a veto, and auto mode adds extra pauses (AUTO_GATES, drags, Enter
   * outside a launch/search/address-bar context). Pre-deploy review, blockers 1–2, 2026-11-19.
   */
  autoApprove?: boolean;
};

/** Extra pauses in auto-approve mode, matched against the model's thought AND any typed text. */
export const AUTO_GATES: { name: string; re: RegExp; reason: string }[] = [
  { name: "secret", reason: "This looks like a password, code or payment field. You type those yourself.",
    re: /\b(passwords?|passcodes?|passphrase|pin\s*code|credit\s*card|debit\s*card|card\s*(number|details|info)|cvv|cvc|security\s*code|expiration\s*date|billing|2fa|two[-\s]factor|one[-\s]time\s*(code|password)|verification\s*code|apple\s*pay|bank\s*account|routing\s*number|ssn|social\s*security)\b/i },
  { name: "send", reason: "This would send or post something.",
    re: /\b(send|sends|sending|post|posting|publish|publishing|tweet|reply|share|submit|submitting|upload|uploading|attach)\b/i },
  { name: "delete", reason: "This would delete something.",
    re: /\b(delete|deleting|erase|erasing|trash|bin|wipe|uninstall|format|discard|remove|removing)\b/i },
  { name: "purchase", reason: "This would buy or pay for something.",
    re: /\b(buy|buying|purchase|purchasing|checkout|check\s*out|pay|paying|payment|order|subscribe|subscription|transfer|wire|withdraw|venmo|zelle|cash\s*app|donate|download)\b/i },
  { name: "form", reason: "This would submit a form or accept something.",
    re: /\b(form|sign\s*up|register|accept|agree|terms|consent|confirm|approve|authorize|allow)\b/i },
  { name: "system", reason: "This would change system or security settings.",
    re: /\b(system\s+settings|system\s+preferences|settings|preferences|privacy|security|firewall|filevault|gatekeeper|full\s+disk\s+access|permission|grant|admin(istrator)?|install|installing|update|profile|extension|login\s+items|terminal)\b/i },
];

/** Never run, confirmed or not (the run refuses it and moves on): logout/lock/shutdown and typing secrets. */
const DENY_COMBOS = [["shift", "cmd", "q"], ["option", "shift", "cmd", "q"], ["ctrl", "cmd", "q"], ["ctrl", "cmd", "power"], ["ctrl", "option", "cmd", "power"]];
const DENY_WORDS = /\b(log\s*out|logout|log\s*off|sign\s*out\s+of\s+(the\s+)?(mac|computer|user)|lock\s+(the\s+)?(screen|mac|computer)|shut\s*down|restart|reboot|sleep\s+the\s+mac)\b/i;
const SECRET_LIKE = AUTO_GATES[0].re;

export function hardDeny(d: Decision): string | null {
  const a = d.action;
  if (a.type === "key") {
    const keys = a.keys.map(norm).sort().join("+");
    if (DENY_COMBOS.some((c) => c.map(norm).sort().join("+") === keys)) return "Log out, lock and shut down are never done by @computer.";
  }
  if ((a.type === "click" || a.type === "key" || a.type === "drag") && DENY_WORDS.test(d.thought)) return "Log out, lock, restart and shut down are never done by @computer.";
  if (a.type === "type" && (SECRET_LIKE.test(d.thought) || SECRET_LIKE.test(a.text))) return "Passwords, codes and payment details are never typed by @computer. Type them yourself.";
  return null;
}

function strictRisk(d: Decision): Risk {
  const a: Action = d.action;
  if (a.type === "done" || a.type === "wait" || a.type === "move" || a.type === "scroll") return { risky: false, reason: null };
  if (d.risky) return { risky: true, reason: "The model flagged this step as consequential." };
  if (a.type === "type" && RISKY_TEXT.test(a.text)) return { risky: true, reason: "Typed text looks like a destructive or privileged command." };
  if (a.type === "key") {
    const keys = a.keys.map(norm).sort().join("+");
    if (SEND_COMBOS.some((c) => c.map(norm).sort().join("+") === keys)) return { risky: true, reason: `${a.keys.join("+")} can send or delete.` };
  }
  const words = `${d.thought} ${a.type === "type" ? a.text : ""}`;
  const m = RISK_WORDS.exec(words);
  if (m && (a.type === "click" || a.type === "key" || a.type === "drag" || a.type === "type")) {
    // "type" into a field rarely commits anything; only gate when the typed text itself is the risky part.
    if (a.type === "type" && !RISK_WORDS.test(a.text) && !/\n/.test(a.text)) return { risky: false, reason: null };
    return { risky: true, reason: `This step looks like it would ${m[0].toLowerCase()} something.` };
  }
  return { risky: false, reason: null };
}

/** Enter/Return is only routine right after Spotlight, a search box or the address bar. */
const ENTER_OK = /\b(spotlight|launch|open|search|address\s*bar|url|go\s+to|navigate|load|web\s*page|website)\b/i;

function autoExtras(d: Decision): Risk {
  const a = d.action;
  if (a.type === "done" || a.type === "wait" || a.type === "move" || a.type === "scroll") return { risky: false, reason: null };
  if (a.type === "drag") return { risky: true, reason: "Dragging can move files to Trash or upload them." };
  const words = `${d.thought} ${a.type === "type" ? a.text : ""}`;
  for (const g of AUTO_GATES) if (g.re.test(words)) return { risky: true, reason: g.reason };
  if (a.type === "key" && a.keys.some((k) => /^(enter|return)$/i.test(k)) && !ENTER_OK.test(d.thought)) {
    return { risky: true, reason: "Enter could submit a form here." };
  }
  if (a.type === "key" && a.keys.some((k) => /^(delete|backspace)$/i.test(norm(k))) && a.keys.length > 1) {
    return { risky: true, reason: `${a.keys.join("+")} can delete.` };
  }
  return { risky: false, reason: null };
}

export function assessRisk(d: Decision, task: string, opts: RiskOptions = {}): Risk {
  void task;
  const base = strictRisk(d); // always: the model's flag and every strict heuristic
  if (base.risky || !opts.autoApprove) return base;
  return autoExtras(d);
}
