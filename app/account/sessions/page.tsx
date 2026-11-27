import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { SessionsView } from "@/components/account/AccountPages";
import { currentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/config";
import { SiteFooter } from "@/components/SiteFooter";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sessions · Citad3L" };
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login?next=/account/sessions");
  return (
    <>
      <AccountShell title="Sessions" intro="Devices that are signed in to your account." isOwner={isAdminEmail(u.email)}>
        <SessionsView />
      </AccountShell>
      <SiteFooter />
    </>
  );
}
