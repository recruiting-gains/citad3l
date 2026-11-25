import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { ReferralsView } from "@/components/account/AccountPages";
import { currentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/config";
import { promoEnded, REFERRAL_PROMO_END_LABEL, referralCap, referralsEnabled } from "@/lib/referrals";
export const dynamic = "force-dynamic";
export const metadata = { title: "Referrals · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account/referrals");
  const intro = !referralsEnabled()
    ? "Share your link. Rewards aren't switched on yet."
    : promoEnded()
      ? `The referral promo ended ${REFERRAL_PROMO_END_LABEL}. Thanks for sharing.`
      : `When they sign up with your code and subscribe, you get a free month. Up to ${referralCap()}. Ends ${REFERRAL_PROMO_END_LABEL}.`;
  return (
    <AccountShell title="Referrals" intro={intro} isOwner={isAdminEmail(u.email)}>
      <ReferralsView />
    </AccountShell>
  );
}
