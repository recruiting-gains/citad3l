import { Action, BadDecision, describeAction, auditAction, parseDecision, sameAction, type Decision } from "./actions";
import { assessRisk, hardDeny } from "./risk";
import { isWindowAction, repetitionStop, taskAllowsWindowAction } from "./repetition";
import { noVisibleChange, STALL_LIMIT, STALL_MESSAGE } from "./progress";
import type { HubClient } from "./hub-client";
import { estimateUsd, MAX_COMPLETION_TOKENS, type Decider, type PreviousAttempt } from "./model";

export type AgentEvent =
  | { type: "start"; runId: string; model: string; maxSteps: number }
  | { type: "step"; step: number; thought: string; action: string }
  | { type: "result"; step: number; ok: boolean; error?: string }
  | { type: "confirm"; step: number; pendingId: string; reason: string; thought: string; action: string; expiresAt: number }
  | { type: "done"; summary: string; steps: number; usd: number }
  | { type: "stopped"; reason: string; steps: number; usd: number }
  | { type: "error"; message: string; steps: number; usd: number };

export type PendingData = { task: string; action: Action; thought: string; history: string[]; stepsUsed: number; usd: number; maxSteps: number; deadline?: number };

export type RunOptions = {
  runId: string;
  task: string;
  hub: HubClient;
  decide: Decider;
  model: string;
  maxSteps: number;
  maxWallMs?: number;
  /** Stop once the estimated model spend for this task passes this (USD). */
  maxUsd?: number;
  maxRunsPerDay?: number;
  signal: AbortSignal;
  emit: (e: AgentEvent) => void;
  /** Resume after the owner confirmed a paused action: run it first, then keep going. */
  resume?: PendingData;
  newId?: () => string;
  /** Owner setting: ordinary actions run without a confirm pause; only sends/deletes/purchases/secrets/system pause. */
  autoApprove?: boolean;
};

export type RunSummary = { outcome: "done" | "stopped" | "error" | "confirm"; steps: number; usd: number; actions: string[]; summary: string };

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function runComputerTask(o: RunOptions): Promise<RunSummary> {
  const newId = o.newId ?? randomId;
  const maxWall = o.maxWallMs ?? 5 * 60 * 1000;
  const maxUsd = o.maxUsd ?? 0.25;
  // One absolute deadline for the whole task, carried through confirmations so a resume can't reset it.
  const deadline = o.resume?.deadline ?? Date.now() + maxWall;
  // Run-scoped abort: chat disconnect OR the deadline cancels in-flight model calls too.
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  o.signal.addEventListener("abort", onAbort);
  if (o.signal.aborted) ac.abort();
  const timer = setTimeout(() => ac.abort(), Math.max(0, deadline - Date.now()));
  const signal = ac.signal;
  const stopReason = () => (o.signal.aborted ? "Stopped from chat." : "Time limit reached (5 minutes).");
  const history = [...(o.resume?.history ?? [])];
  const audit: string[] = [];
  let usd = o.resume?.usd ?? 0;
  let steps = o.resume?.stepsUsed ?? 0;
  const maxSteps = o.resume?.maxSteps ?? o.maxSteps;

  const finish = (outcome: RunSummary["outcome"], summary: string): RunSummary => ({ outcome, steps, usd: round(usd), actions: audit, summary });
  const stop = (reason: string) => { o.emit({ type: "stopped", reason, steps, usd: round(usd) }); return finish("stopped", reason); };
  const fail = (message: string) => { o.emit({ type: "error", message, steps, usd: round(usd) }); return finish("error", message); };

  if (signal.aborted) {
    clearTimeout(timer);
    o.signal.removeEventListener("abort", onAbort);
    return stop(stopReason());
  }
  const lock = await o.hub.call("/run/start", { id: o.runId, maxRunsPerDay: o.maxRunsPerDay });
  if (lock.status !== 200) {
    clearTimeout(timer);
    o.signal.removeEventListener("abort", onAbort);
    if (lock.status === 409) return fail("Another @computer task is already running. Stop it first.");
    if (lock.status === 429) return fail("Daily @computer limit reached. It resets at midnight UTC.");
    return fail("Couldn't reach the @computer relay.");
  }

  // Every command is fenced by runId in the Durable Object, so a stopped or superseded run can't act.
  const cmd = async (op: string, extra: Record<string, unknown> = {}) => o.hub.call<{ ok?: boolean; result?: any }>("/command", { id: newId(), runId: o.runId, op, ...extra });
  const act = async (step: number, action: Action): Promise<string | null> => {
    const r = await cmd("act", { action });
    const ok = r.status === 200 && r.body.ok === true;
    const error = ok ? undefined : String(r.body.error ?? `relay ${r.status}`);
    o.emit({ type: "result", step, ok, error });
    history.push(`${step}. ${describeAction(action)} -> ${ok ? "ok" : `failed (${error})`}`);
    audit.push(`${auditAction(action)}${ok ? "" : ` [${error}]`}`);
    return ok ? null : error!;
  };

  try {
    o.emit({ type: "start", runId: o.runId, model: "Citad3L Vision", maxSteps });
    if (signal.aborted) return stop(stopReason());
    const begin = await cmd("begin", { task: o.task.slice(0, 300), maxSteps });
    if (begin.status === 503) return fail("Your Mac helper isn't connected. Open Terminal on the Mac and run the Citad3L helper.");
    if (begin.status !== 200 || begin.body.ok !== true) return fail(`The Mac helper refused to start (${begin.body.error ?? begin.status}).`);

    // A confirmed action is NOT replayed blind: take a fresh screenshot and make the model re-decide. Only an
    // identical action runs without asking again; anything else goes through the risk gate like a new step.
    let approved: Action | null = o.resume?.action ?? null;
    // Actions chosen so far in this run (including refused ones), for loop detection.
    const chosen: Action[] = [];
    let prevSig: string | undefined;
    let lastActed: Action | null = null;
    // Acting steps in a row that left the screen unchanged (needs helper sigs; older helpers never count).
    let stalled = 0;

    while (steps < maxSteps) {
      if (signal.aborted) return stop(stopReason());
      if (usd >= maxUsd) return stop(`Spend cap for one task reached (about $${maxUsd.toFixed(2)}).`);
      const check = await o.hub.call<{ stopRequested?: boolean }>("/run/check", { id: o.runId });
      if (check.body.stopRequested) return stop("Stopped (kill switch).");

      steps++;
      const shot = await cmd("screenshot");
      if (signal.aborted) return stop(stopReason());
      if (shot.status !== 200 || shot.body.ok !== true || typeof shot.body.result?.image !== "string") {
        return stop(`Couldn't get a screenshot (${shot.body.error ?? shot.status}).`);
      }
      const { image, width, height, sig } = shot.body.result as { image: string; width: number; height: number; sig?: string };
      // Progress check: if the last click/key/type changed nothing visible, say so, so the model tries something else.
      let noEffect: string | undefined;
      if (lastActed) stalled = noVisibleChange(prevSig, sig) ? stalled + 1 : 0;
      if (stalled >= STALL_LIMIT) {
        audit.push(`stopped (no visible change x${stalled})`);
        return stop(STALL_MESSAGE);
      }
      if (lastActed && noVisibleChange(prevSig, sig)) {
        noEffect = `No visible change was detected after your last action (${describeAction(lastActed)}). It may have had no effect, or it may still be loading. Don't repeat the same action. If you were opening an app, use Spotlight instead (cmd+space, type the name, enter). Never re-send anything that submits, sends, buys or deletes just because the screen looks unchanged.`;
        history.push(`${steps - 1}. (no visible change after that action)`);
      }
      prevSig = sig;
      lastActed = null;

      let decision: Decision | null = null;
      const note: string | undefined = approved
        ? `The owner approved this exact action: ${JSON.stringify(approved)}. If the screen still shows the same target, reply with exactly that action. If anything changed, choose again.`
        : noEffect;
      let previous: PreviousAttempt | undefined;
      for (let attempt = 0; attempt < DECIDE_ATTEMPTS && !decision; attempt++) {
        // Reserve a worst-case bound BEFORE each paid call (incl. retries) so one call can't blow the cap.
        if (usd + estimateUsd(o.model, WORST_PROMPT_TOKENS, WORST_COMPLETION_TOKENS) > maxUsd) return stop(`Spend cap for one task reached (about $${maxUsd.toFixed(2)}).`);
        const out = await o.decide({ autoApprove: o.autoApprove === true, task: o.task, history, step: steps, maxSteps, image, width, height, note, previous }, signal);
        usd += estimateUsd(o.model, out.promptTokens, out.completionTokens);
        try {
          decision = parseDecision(out.raw);
        } catch (e) {
          if (!(e instanceof BadDecision)) throw e;
          const truncated = out.finishReason === "length";
          previous = { reply: out.raw, error: truncated ? `${e.message} (the reply hit the output-token limit)` : e.message, truncated };
          // Diagnostics for the Worker log: the reason and a redacted snippet (typed text is masked, never logged).
          console.warn("[computer] unusable model reply", JSON.stringify({ step: steps, attempt: attempt + 1, reason: previous.error, finish: out.finishReason ?? null, chars: out.raw.length, completionTokens: out.completionTokens, snippet: redactReply(out.raw) }));
        }
      }
      if (!decision) return fail(`The vision model didn't return a usable action after ${DECIDE_ATTEMPTS} tries (last problem: ${previous?.error ?? "unknown"}). Nothing was done on this step.`);
      if (signal.aborted) return stop(stopReason());

      const a = decision.action;
      const wasApproved = !!approved && sameAction(approved, a);
      if (approved && !wasApproved) history.push(`${steps}. (screen changed; the approved action was not re-chosen, so it was not run)`);
      approved = null;
      if (a.type === "done") {
        o.emit({ type: "done", summary: a.summary, steps, usd: round(usd) });
        audit.push("done");
        return finish("done", a.summary);
      }
      // Loop guard: the same action (same keys, or nearly the same spot) 3 times in a row, or a minimize/hide/quit
      // shortcut twice, ends the run BEFORE it runs again.
      const loop = repetitionStop(chosen, a);
      chosen.push(a);
      if (loop) {
        audit.push(`stopped (repeat): ${auditAction(a)}`);
        return stop(loop);
      }
      // cmd+m / cmd+h / cmd+q hide what the model is looking for. Refuse them (nothing runs) unless the task asks.
      if (isWindowAction(a) && !taskAllowsWindowAction(o.task, a)) {
        history.push(`${steps}. ${describeAction(a)} -> refused (minimize/hide/quit shortcuts are off for this task; use Spotlight: cmd+space, type the app name, enter)`);
        audit.push(`refused window shortcut: ${auditAction(a)}`);
        o.emit({ type: "step", step: steps, thought: decision.thought, action: describeAction(a) });
        o.emit({ type: "result", step: steps, ok: false, error: "refused: minimize/hide/quit isn't part of this task (nothing was done)" });
        continue;
      }
      // Hard denials (logout/lock/shutdown, typing secrets) apply even to a step the owner confirmed.
      const denied = hardDeny(decision);
      if (denied) {
        history.push(`${steps}. ${describeAction(a)} -> refused (${denied})`);
        audit.push(`refused (hard deny): ${auditAction(a)}`);
        o.emit({ type: "step", step: steps, thought: decision.thought, action: describeAction(a) });
        o.emit({ type: "result", step: steps, ok: false, error: `refused: ${denied} (nothing was done)` });
        continue;
      }
      const risk = wasApproved ? { risky: false, reason: null } : assessRisk(decision, o.task, { autoApprove: o.autoApprove === true });
      if (risk.risky) {
        const pendingId = newId() + newId();
        // stepsUsed = steps - 1: the re-verification screenshot after Confirm re-uses this step number.
        const data: PendingData = { task: o.task, action: a, thought: decision.thought, history, stepsUsed: steps - 1, usd, maxSteps, deadline };
        const put = await o.hub.call<{ expiresAt?: number }>("/pending/put", { id: pendingId, data, runId: o.runId });
        if (put.status === 409) return stop("Stopped (kill switch).");
        if (put.status !== 200) return fail("Couldn't save the confirmation request.");
        o.emit({ type: "confirm", step: steps, pendingId, reason: risk.reason ?? "Needs your OK.", thought: decision.thought, action: describeAction(a, true), expiresAt: put.body.expiresAt ?? Date.now() + 120000 });
        audit.push(`paused for confirm: ${auditAction(a)}`);
        return finish("confirm", risk.reason ?? "confirm");
      }
      o.emit({ type: "step", step: steps, thought: wasApproved ? `Confirmed by you: ${decision.thought}` : decision.thought, action: describeAction(a) });
      if (signal.aborted) return stop(stopReason());
      const err = await act(steps, a);
      // wait/scroll are expected to sometimes leave the screen as is; only flag inputs that should change something.
      if (!err && (a.type === "click" || a.type === "key" || a.type === "type" || a.type === "drag")) lastActed = a;
      // Only a pre-input rejection on the Mac is safe to continue past. Anything else may have partly happened.
      if (err && !err.startsWith("rejected")) {
        if (err.startsWith("stopped") || err === "stale_run") return stop("Stopped.");
        return stop(`The Mac reported a problem mid-action (${err}). Check the screen; nothing was retried.`);
      }
    }
    return stop(`Step limit reached (${maxSteps}).`);
  } catch (e) {
    if (signal.aborted) return stop(stopReason());
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  } finally {
    clearTimeout(timer);
    o.signal.removeEventListener("abort", onAbort);
    await cmd("end").catch(() => null);
    await o.hub.call("/run/end", { id: o.runId }).catch(() => null);
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000;
/** Conservative per-call bound: one 1440px screenshot + prompt + history, and max_tokens of output. */
const WORST_PROMPT_TOKENS = 6000;
const WORST_COMPLETION_TOKENS = MAX_COMPLETION_TOKENS;
/** First try plus two repair turns that show the model its own bad reply and the exact problem. */
const DECIDE_ATTEMPTS = 3;

/** Log-safe view of a model reply: whitespace collapsed, any "text" value masked, capped at 300 chars. */
export function redactReply(raw: string): string {
  return raw
    .replace(/("(?:text|content|value)"\s*:\s*")((?:[^"\\]|\\.)*)"/g, (_m, k: string, v: string) => `${k}<${v.length} chars>"`)
    .replace(/\s+/g, " ")
    .slice(0, 300);
}
