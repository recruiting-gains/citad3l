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
        <span>{meter.label === "Weekly cap" ? "Week" : "5h"}</span>
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
        {meter.remaining <= 0
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
  if (usage.guest || usage.plan === "trial") {
    if (compact) return <span className="guest-count">{usage.remaining} of {usage.limit} free messages left</span>;
    return (
      <UsageMeter meter={{ used: usage.used, limit: usage.limit, remaining: usage.remaining, resetAt: null, label: "Free messages" }} />
    );
  }
  const window = usage.window;
  const week = usage.week;
  if (!window && !week) {
    return <UsageMeter meter={{ used: usage.used, limit: usage.limit, remaining: usage.remaining, resetAt: usage.resetAt, label: "Allowance" }} compact={compact} />;
  }
  return (
    <div className={compact ? "usage-meters-sm" : "usage-meters"}>
      {window && <UsageMeter meter={window} compact={compact} />}
      {week && <UsageMeter meter={week} compact={compact} />}
    </div>
  );
}

export default UsageMeter;
