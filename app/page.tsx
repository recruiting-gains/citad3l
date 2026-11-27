import { cookies } from "next/headers";
import { FREE_MESSAGES, GUEST_COOKIE, guestChatEnabled, isAdminEmail } from "@/lib/config";
import { decodeGuestCookie } from "@/lib/guest";
import { guestStore } from "@/lib/guest-store";
import HomeView from "@/components/marketing/HomeView";
import { currentUser } from "@/lib/session";
import { providerInfo } from "@/lib/inference";
import { siteJsonLd } from "@/lib/site-jsonld";
import { referralProgramVisible } from "@/lib/referrals";
import { holidayActive, holidayIntroEligible } from "@/lib/holiday";
import { marketingModels } from "@/lib/models";
import { getUsage } from "@/lib/usage";
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await currentUser();
  // Signed-out: how many free messages this browser already used (signed cookie; the server re-checks on send).
  const gc = u ? null : decodeGuestCookie((await cookies()).get(GUEST_COOKIE)?.value);
  const row = gc ? await (await guestStore()).get(gc.id).catch(() => null) : null;
  const guestUsed = Math.min(FREE_MESSAGES, Math.max(gc?.used ?? 0, row?.used ?? 0));
  const usage = u ? await getUsage(u.id) : null;
  const holiday = holidayActive();
  const showHolidayPrices = holiday && holidayIntroEligible(usage);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd("https://citad3l.io")).replace(/</g, "\\u003c") }} />
      <HomeView signedIn={!!u} provider={providerInfo()} isAdmin={!!u && isAdminEmail(u.email)} guestUsed={guestUsed} freeLimit={FREE_MESSAGES} guestChat={guestChatEnabled()} showReferral={referralProgramVisible()} holiday={holiday} showHolidayPrices={showHolidayPrices} models={marketingModels()} />
    </>
  );
}
