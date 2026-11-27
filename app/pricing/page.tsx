import PricingView from "@/components/marketing/PricingView";
import { currentUser } from "@/lib/session";
import { planCatalog } from "@/lib/plans";
import { billingConfigured, billingOpenFor, billingPublic } from "@/lib/stripe";
import { getUsage } from "@/lib/usage";
import { isAdminEmail } from "@/lib/config";
import { referralProgramVisible } from "@/lib/referrals";
import { holidayActive, holidayIntroEligible } from "@/lib/holiday";
import { marketingModels } from "@/lib/models";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  const usage = u ? await getUsage(u.id) : null;
  const plan = usage?.plan ?? null;
  const holiday = holidayActive();
  const showHolidayPrices = holiday && holidayIntroEligible({ plan, status: usage?.status });
  return <PricingView plans={planCatalog()} signedIn={!!u} currentPlan={plan} billingConfigured={billingConfigured()} billingOpen={u ? billingOpenFor(u.email) : billingPublic()} isAdmin={!!u && isAdminEmail(u.email)} showReferral={referralProgramVisible()} holiday={holiday} showHolidayPrices={showHolidayPrices} models={marketingModels()} />;
}
