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
  if (usage.guest) {
    return (
      <div className="limit-card guest-cta" role="alert" data-testid="guest-limit">
        <div className="guest-cta-mark"><LockIcon /></div>
        <div>
          <div className="limit-title">That&apos;s your five.</div>
          <p className="limit-body">Make an account to keep this conversation and pick up where you left off. It&apos;s free to start, and no card is needed.</p>
          <div className="limit-actions guest-cta-actions">
            <Link href="/login?next=/chat" className="btn btn-primary btn-sm">Create an account</Link>
            <Link href="/pricing" className="btn btn-secondary btn-sm">See plans</Link>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}><Link href="/login?next=/chat">Already have one? Sign in</Link></p>
        </div>
      </div>
    );
  }

  const reset = formatDate(usage.resetAt, { month: "long", day: "numeric", hour: "numeric" });
  let title: string;
  let body: string;
  let primary: { href: string; label: string };
  const secondary: { href: string; label: string } | null =
    usage.plan === "trial" ? null : { href: "/account/usage", label: "View usage" };

  if (usage.plan === "trial") {
    title = "Your free messages are used up";
    body = `You've used all ${usage.limit} free ${usage.unitLabel}. Pro and Max refresh every 5 hours, with a weekly cap. Failed replies never count.`;
    primary = { href: "/pricing", label: "See plans" };
  } else if (usage.plan === "pro") {
    title = "You've reached this allowance";
    body = usage.window && usage.window.remaining <= 0
      ? `Your 5-hour window${reset ? ` refreshes at ${reset}` : " refreshes soon"}. Max gives you 2.5× the allowance on the same models.`
      : `Your weekly cap${reset ? ` resets on ${reset}` : " resets later this week"}. Max gives you 2.5× the allowance on the same models.`;
    primary = { href: "/pricing", label: "Upgrade to Max" };
  } else {
    title = "You've reached this allowance";
    body = usage.window && usage.window.remaining <= 0
      ? `Your 5-hour window${reset ? ` refreshes at ${reset}` : " refreshes soon"}. Failed or stopped replies are never charged.`
      : `Your weekly cap${reset ? ` resets on ${reset}` : " resets later this week"}. Failed or stopped replies are never charged.`;
    primary = { href: "/account/usage", label: "View usage" };
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
