import { referralProgramVisible } from "@/lib/referrals";
import { Footer } from "@/components/Footer";

/** Server-only footer wrapper: shows the referral link only while the promo is on and the window is still open. */
export function SiteFooter() {
  return <Footer showReferral={referralProgramVisible()} />;
}
