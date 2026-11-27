import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact · Citad3L",
  description: "Email Citad3L about your account, billing, refunds, cancellation, or privacy.",
};

export default function Page() {
  return (
    <>
      <main className="state-page" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "left" }}>
        <h1 className="display" style={{ fontSize: 40 }}>Contact</h1>
        <p className="text-2" style={{ marginTop: 20, lineHeight: 1.6 }}>
          Email{" "}
          <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
          {" "}for your account, billing, refunds and cancellation, or privacy questions.
        </p>
        <p className="tiny" style={{ marginTop: 32 }}>
          <Link href="/about">About</Link>
          {" · "}
          <Link href="/pricing">Pricing</Link>
          {" · "}
          <Link href="/privacy">Privacy</Link>
          {" · "}
          <Link href="/terms">Terms</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
