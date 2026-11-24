import { z } from "zod";
import { computerCtx } from "../_shared";
import { readAutoApprove } from "@/lib/computer/settings";
import { jerr } from "@/lib/http";
import { writeAudit } from "@/lib/admin";
import { rateLimit } from "@/lib/ratelimit";
import { checkText } from "@/lib/filter";
import { computerMaxRunsPerDay, computerMaxSteps, computerMaxUsd } from "@/lib/computer/gate";
import { computerModel, visionDecider } from "@/lib/computer/model";
import { runComputerTask, type AgentEvent, type PendingData } from "@/lib/computer/agent";
import { Action, taskFrom } from "@/lib/computer/actions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({ task: z.string().trim().min(1).max(2000) }),
  z.object({ confirm: z.string().min(16).max(128) }),
  z.object({ cancel: z.string().min(16).max(128) }),
]);

export async function POST(req: Request) {
  const c = await computerCtx(req, true);
  if (c instanceof Response) return c;
  if (!rateLimit(`computer:${c.owner.id}`, 10)) return jerr(429, "rate_limited", "Too many @computer requests this minute.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jerr(400, "bad_request", "Invalid request.");
  const b = parsed.data;

  if ("cancel" in b) {
    await c.hub.call("/pending/consume", { id: b.cancel });
    await writeAudit(c.owner.id, "computer.cancel").catch(() => null);
    return Response.json({ ok: true });
  }

  const runId = crypto.randomUUID();
  let task: string;
  let resume: PendingData | undefined;
  if ("confirm" in b) {
    // Atomic in the DO: validate approval + pairing, take the run lease, then consume (busy leaves it intact).
    const p = await c.hub.call<{ data?: PendingData }>("/pending/claim", { id: b.confirm, runId, maxRunsPerDay: computerMaxRunsPerDay() });
    if (p.status === 409) return jerr(409, "busy", "The previous step is still finishing. Press Confirm again in a second.");
    if (p.status === 429) return jerr(429, "daily_cap", "Daily @computer limit reached.");
    if (p.status === 410) return jerr(410, "expired", "That confirmation expired. Ask again.");
    if (p.status !== 200 || !p.body.data) return jerr(404, "not_found", "Nothing is waiting for confirmation.");
    const action = Action.safeParse(p.body.data.action);
    if (!action.success) return jerr(400, "bad_request", "Stored action is invalid.");
    resume = { ...p.body.data, action: action.data };
    task = resume.task;
  } else {
    task = taskFrom(b.task);
    if (!task) return jerr(400, "bad_request", "Tell @computer what to do, e.g. \"@computer open Safari and go to citad3l.io\".");
    if (!checkText(task).allowed) return jerr(400, "content_policy", "Citad3L can't help with that.");
  }

  // Per-admin setting, default OFF, fail closed: anything but a valid stored `true` runs strict (original prompt).
  const { autoApprove } = await readAutoApprove(c.hub);
  const model = computerModel();
  const enc = new TextEncoder();
  // Run-scoped abort: request disconnect or stream cancel both stop the agent's own work, not just the helper.
  const ac = new AbortController();
  const abort = () => ac.abort();
  req.signal?.addEventListener("abort", abort);
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch {}
      };
      try {
        const summary = await runComputerTask({
          runId, task, hub: c.hub, decide: visionDecider, model, maxSteps: computerMaxSteps(), signal: ac.signal, emit, resume,
          maxUsd: computerMaxUsd(), maxRunsPerDay: computerMaxRunsPerDay(), autoApprove,
        });
        await writeAudit(
          c.owner.id,
          resume ? "computer.run.confirmed" : "computer.run",
          null,
          `${summary.outcome} · ${summary.steps} steps · ~$${summary.usd.toFixed(4)} · task(${task.length} chars) · ${summary.actions.join(" | ")}`,
        ).catch(() => null);
      } finally {
        req.signal?.removeEventListener("abort", abort);
        try { controller.close(); } catch {}
      }
    },
    async cancel() {
      ac.abort();
      // Run-scoped: a late cancel from an old stream can't stop a newer run.
      await c.hub.call("/run/stop", { id: runId }).catch(() => null);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
