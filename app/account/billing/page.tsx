import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { BillingView } from "@/components/account/AccountPages";
import { currentUser } from "@/lib/session";
import { getUsage } from "@/lib/usage";
import { billingConfigured, billingOpenFor } from "@/lib/stripe";
import { isAdminEmail } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";
export const dynamic = "force-dynamic";
export const metadata = { title: "Billing · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account/billing");
  return (
    <>
      <AccountShell title="Billing" intro="Plans, invoices, and payment method." isOwner={isAdminEmail(u.email)}>
        <BillingView usage={await getUsage(u.id)} billingConfigured={billingConfigured()} billingOpen={billingOpenFor(u.email)} />
      </AccountShell>
      <SiteFooter />
    </>
  );
}
