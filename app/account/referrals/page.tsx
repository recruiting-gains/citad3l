import Link from "next/link";
import AccountShell from "@/components/account/AccountShell";
import { ReferralsView } from "@/components/account/AccountPages";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/config";
import { promoEnded, REFERRAL_PROMO_END_LABEL, referralCap, referralsEnabled } from "@/lib/referrals";
export const dynamic = "force-dynamic";
export const metadata = { title: "Referrals · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  const enabled = referralsEnabled();
  const ended = promoEnded();
  const cap = referralCap();
  const intro = !enabled
    ? "Share your link. Rewards aren't switched on yet."
    : ended
      ? `The referral promo ended ${REFERRAL_PROMO_END_LABEL}. Thanks for sharing.`
      : `When they sign up with your code and subscribe, you get a free month of Pro. Up to ${cap}. Ends ${REFERRAL_PROMO_END_LABEL}.`;

  if (!u) {
    return (
      <>
        <main className="page referral-public">
          <section className="referral-public-hero">
            <span className="eyebrow">Referral program</span>
            <h1 className="display referral-public-title">
              {enabled && !ended ? "Give Citad3L, earn a free month of Pro." : "Referrals on Citad3L."}
            </h1>
            <p className="referral-public-sub">{intro}</p>
            <div className="referral-public-ctas">
              <Link href="/login?next=/account/referrals" className="btn btn-primary">
                Sign in to get your link
              </Link>
              <Link href="/pricing#plans" className="btn btn-secondary">
                See plans
              </Link>
            </div>
          </section>

          <section className="referral-public-steps" aria-label="How referrals work">
            <div className="referral-step-card">
              <span className="referral-step-num tnum">01</span>
              <h2 className="referral-step-title">Get your link</h2>
              <p className="referral-step-body">Sign in with a 6-digit email code — no password or card needed to generate your referral link.</p>
            </div>
            <div className="referral-step-card">
              <span className="referral-step-num tnum">02</span>
              <h2 className="referral-step-title">Share with friends</h2>
              <p className="referral-step-body">Anyone who lands through your link keeps attribution for 30 days across the site.</p>
            </div>
            <div className="referral-step-card">
              <span className="referral-step-num tnum">03</span>
              <h2 className="referral-step-title">Earn Pro time</h2>
              <p className="referral-step-body">When they sign up and subscribe to a paid plan, your account earns a free month of Pro (up to {cap}).</p>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <AccountShell title="Referrals" intro={intro} isOwner={isAdminEmail(u.email)}>
      <ReferralsView />
    </AccountShell>
  );
}
