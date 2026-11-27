import Link from "next/link";
import AccountShell from "@/components/account/AccountShell";
import { CustomInstructionsView } from "@/components/account/AccountPages";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/config";
import { MAX_CUSTOM_INSTRUCTIONS } from "@/lib/custom-instructions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Custom instructions · Citad3L" };

const INTRO = "Save who you want Citad3L to be, once. Every chat uses it.";

export default async function Page() {
  const u = await currentUser();
  if (!u) {
    // Guests can't save instructions: show what it is and a sign-in prompt.
    return (
      <>
        <main className="page referral-public">
          <section className="referral-public-hero">
            <span className="eyebrow">Custom instructions</span>
            <h1 className="display referral-public-title">Set your assistant up once.</h1>
            <p className="referral-public-sub">
              Custom instructions are for signed-in accounts. Write who you want Citad3L to be, like your social media analyst or designer, and every new chat starts that way.
            </p>
            <div className="referral-public-ctas">
              <Link href="/login?next=/account/instructions" className="btn btn-primary" data-testid="ci-signin">
                Sign in to set custom instructions
              </Link>
              <Link href="/chat" className="btn btn-secondary">
                Back to chat
              </Link>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }
  return (
    <>
      <AccountShell title="Custom instructions" intro={INTRO} isOwner={isAdminEmail(u.email)}>
        <CustomInstructionsView max={MAX_CUSTOM_INSTRUCTIONS} />
      </AccountShell>
      <SiteFooter />
    </>
  );
}
