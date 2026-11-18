import PricingView from "@/components/marketing/PricingView";
import { currentUser } from "@/lib/session";
import { planCatalog } from "@/lib/plans";
import { billingConfigured } from "@/lib/stripe";
import { getUsage } from "@/lib/usage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  const usage = u ? await getUsage(u.id) : null;
  return <PricingView plans={planCatalog()} signedIn={!!u} currentPlan={usage?.plan ?? null} billingConfigured={billingConfigured()} />;
}
