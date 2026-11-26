"use client";

import type { UsageMeter as Meter, UsageSummary } from "@/lib/types";

function clsFor(m: Meter): string {
  if (m.limit <= 0) return "";
  const pct = (m.used / m.limit) * 100;
  if (pct >= 100) return " is-full";
  if (pct >= 80) return " is-warn";
  return "";
}

function fmtReset(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function UsageMeter({ meter, compact }: { meter: Meter; compact?: boolean }) {
  const pct = meter.limit > 0 ? Math.min(100, Math.round((meter.used / meter.limit) * 100)) : 0;
  if (compact) {
    return (
      <div className={`usage-meter-sm${clsFor(meter)}`} title={`${meter.label}: ${meter.remaining} left`}>
        <span>{meter.label === "Weekly cap" ? "Week" : meter.label === "Images today" ? "Img" : meter.label === "Video clips today" ? "Vid" : "5h"}</span>
        <span className="usage-meter-track"><span className={`usage-meter-fill${clsFor(meter)}`} style={{ width: `${pct}%` }} /></span>
      </div>
    );
  }
  return (
    <div className={`usage-meter${clsFor(meter)}`}>
      <div className="usage-meter-head">
        <span className="usage-meter-label">{meter.label}</span>
        <span className="usage-meter-value tnum">{pct}% used</span>
      </div>
      <div className="usage-meter-track"><span className={`usage-meter-fill${clsFor(meter)}`} style={{ width: `${pct}%` }} /></div>
      <div className="usage-meter-foot">
        {meter.label === "Free messages today"
          ? (meter.remaining <= 0
            ? "You've used today's 3 free messages. More at midnight Central."
            : `${meter.remaining} of ${meter.limit} left today · resets at midnight Central`)
          : meter.remaining <= 0
          ? (meter.label === "Weekly cap" ? `This week's cap is reached. It resets ${fmtReset(meter.resetAt)}.` : `Window spent. You're back at ${fmtReset(meter.resetAt)}.`)
          : meter.resetAt
            ? (meter.label === "Weekly cap" ? `Resets ${fmtReset(meter.resetAt)}` : `Refreshes at ${fmtReset(meter.resetAt)}`)
            : `${meter.remaining.toLocaleString()} of ${meter.limit.toLocaleString()} left`}
      </div>
    </div>
  );
}

export function UsageMeters({ usage, compact }: { usage: UsageSummary; compact?: boolean }) {
  if (usage.unlimited) {
    return compact ? <div className="usage-meter-sm" title="Unlimited">Unlimited</div> : <p className="tiny">Operator access — no usage cap.</p>;
  }
  if (usage.guest) {
    if (compact) return <span className="guest-count">{usage.remaining} of {usage.limit} free messages left</span>;
    return (
      <UsageMeter meter={{ used: usage.used, limit: usage.limit, remaining: usage.remaining, resetAt: null, label: "Free messages" }} />
    );
  }
  if (usage.plan === "trial") {
    const reset = "midnight Central";
    if (compact) {
      const left = Math.max(0, usage.remaining);
      return (
        <span className="daily-count" data-left={left} title={`Resets at ${reset}`} role="status" aria-live="polite">
          <span className="daily-count-pips" aria-hidden="true">
            {Array.from({ length: Math.max(0, usage.limit) }, (_, i) => (
              <i key={i} className={i < left ? "" : "is-used"} />
            ))}
          </span>
          {left > 0 ? (
            <>
              <span>{left} of {usage.limit} free messages left today</span>
              <span className="daily-count-reset">resets at {reset}</span>
            </>
          ) : (
            <>
              <span>You&apos;ve used today&apos;s {usage.limit} free messages</span>
              <span className="daily-count-reset">More at {reset}.</span>
            </>
          )}
        </span>
      );
    }
    return (
      <UsageMeter
        meter={{
          used: usage.used,
          limit: usage.limit,
          remaining: usage.remaining,
          resetAt: usage.resetAt,
          label: "Free messages today",
        }}
      />
    );
  }
  const window = usage.window;
  const week = usage.week;
  const extra = [usage.image, usage.video].filter((m): m is Meter => !!m);
  if (!window && !week && !extra.length) {
    return <UsageMeter meter={{ used: usage.used, limit: usage.limit, remaining: usage.remaining, resetAt: usage.resetAt, label: "Allowance" }} compact={compact} />;
  }
  return (
    <div className={compact ? "usage-meters-sm" : "usage-meters"}>
      {window && <UsageMeter meter={window} compact={compact} />}
      {week && <UsageMeter meter={week} compact={compact} />}
      {extra.map((m) => <UsageMeter key={m.label} meter={m} compact={compact} />)}
    </div>
  );
}

export default UsageMeter;
