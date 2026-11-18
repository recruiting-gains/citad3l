import { redirect } from "next/navigation";
import AccountView from "@/components/account/AccountView";
import { currentUser, labelFor } from "@/lib/session";
import { getUsage } from "@/lib/usage";
import { billingConfigured } from "@/lib/stripe";
import { providerInfo } from "@/lib/inference";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account");
  return <AccountView userLabel={labelFor(u)} email={u.email ?? ""} usage={await getUsage(u.id)} billingConfigured={billingConfigured()} provider={providerInfo()} />;
}
