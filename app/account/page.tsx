import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { ProfileView } from "@/components/account/AccountPages";
import { currentUser, labelFor } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { isAdminEmail } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account");
  return (
    <>
      <AccountShell title="Profile" intro="Your identity, appearance, and data." isOwner={isAdminEmail(u.email)}>
        <ProfileView userLabel={labelFor(u)} email={u.email ?? ""} provider={providerInfo()} />
      </AccountShell>
      <SiteFooter />
    </>
  );
}
