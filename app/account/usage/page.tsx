import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { UsageView } from "@/components/account/AccountPages";
import { currentUser } from "@/lib/session";
import { getUsage } from "@/lib/usage";
import { isAdminEmail } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "Usage · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account/usage");
  return (
    <AccountShell title="Usage" intro="Two limits keep things fair: a short rolling window and a weekly ceiling." isOwner={isAdminEmail(u.email)}>
      <UsageView usage={await getUsage(u.id)} />
    </AccountShell>
  );
}
