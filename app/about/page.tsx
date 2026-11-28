import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "About · Citad3L",
  description: "Citad3L is a private, fast AI chat app with Swarm, Image and Video, operated by Cruz Garza.",
};

export default function Page() {
  return (
    <>
      <main className="state-page" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "left" }}>
        <h1 className="display" style={{ fontSize: 40 }}>About Citad3L</h1>
        <p className="text-2" style={{ marginTop: 20, lineHeight: 1.6 }}>
          Citad3L is operated by {LEGAL_OPERATOR}.
        </p>
        <p className="text-2" style={{ marginTop: 16, lineHeight: 1.6 }}>
          Citad3L is private, fast AI chat. Talk with Citad3L V1 Fast, sign in for Private mode, and turn on Swarm when a request is big enough to split across workers. Pro adds Citad3L Image, and Max adds Citad3L Video.
        </p>
        <p className="text-2" style={{ marginTop: 16, lineHeight: 1.6 }}>
          There are no ads. We don&apos;t train on your chats.
        </p>
        <p className="tiny" style={{ marginTop: 32 }}>
          <Link href="/pricing">Pricing</Link>
          {" · "}
          <Link href="/privacy">Privacy</Link>
          {" · "}
          <Link href="/terms">Terms</Link>
          {" · "}
          <Link href="/contact">Contact</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
