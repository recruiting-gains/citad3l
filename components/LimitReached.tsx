import * as React from "react";
import Link from "next/link";
import type { UsageSummary } from "@/lib/types";
import { formatDate } from "@/lib/engine";

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function LimitReached({ usage }: { usage: UsageSummary }) {
  const reset = formatDate(usage.resetAt, { month: "long", day: "numeric" });
  let title: string;
  let body: string;
  let primary: { href: string; label: string };
  const secondary: { href: string; label: string } | null =
    usage.plan === "trial" ? null : { href: "/account", label: "View usage" };

  if (usage.plan === "trial") {
    title = "Your trial replies are used up";
    body = `You've used all ${usage.limit} trial ${usage.unitLabel}. Pro and Max run the same Citad3L V1 engine with a monthly allowance. Failed replies never count.`;
    primary = { href: "/pricing", label: "See plans" };
  } else if (usage.plan === "pro") {
    title = "You've reached this month's allowance";
    body = `Your Pro allowance${reset ? ` resets on ${reset}` : " resets on your billing date"}. Max gives you 2.5× the allowance on the same engine.`;
    primary = { href: "/pricing", label: "Upgrade to Max" };
  } else {
    title = "You've reached this month's allowance";
    body = `Your Max allowance${reset ? ` resets on ${reset}` : " resets on your billing date"}. Failed or stopped replies are never charged.`;
    primary = { href: "/account", label: "Manage plan" };
  }

  return (
    <div className="limit-card" role="alert">
      <div className="limit-icon"><LockIcon /></div>
      <div>
        <div className="limit-title">{title}</div>
        <p className="limit-body">{body}</p>
        <div className="limit-actions">
          <Link href={primary.href} className="btn btn-primary btn-sm">{primary.label}</Link>
          {secondary && primary.href !== secondary.href ? (
            <Link href={secondary.href} className="btn btn-secondary btn-sm">{secondary.label}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LimitReached;
