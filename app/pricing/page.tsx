import PricingView from "@/components/marketing/PricingView";
import { currentUser } from "@/lib/session";
import { planCatalog } from "@/lib/plans";
import { billingConfigured, billingOpenFor, billingPublic } from "@/lib/stripe";
import { getUsage } from "@/lib/usage";
import { isAdminEmail } from "@/lib/config";
import { referralProgramVisible } from "@/lib/referrals";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  const usage = u ? await getUsage(u.id) : null;
  return <PricingView plans={planCatalog()} signedIn={!!u} currentPlan={usage?.plan ?? null} billingConfigured={billingConfigured()} billingOpen={u ? billingOpenFor(u.email) : billingPublic()} isAdmin={!!u && isAdminEmail(u.email)} showReferral={referralProgramVisible()} />;
}
