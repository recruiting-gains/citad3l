import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { ReferralsView } from "@/components/account/AccountPages";
import { currentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "Referrals · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account/referrals");
  return (
    <AccountShell title="Referrals" intro="Share your code. Rewards for referrals are on the way." isOwner={isAdminEmail(u.email)}>
      <ReferralsView />
    </AccountShell>
  );
}
