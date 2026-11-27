import * as React from "react";
import Link from "next/link";
import { Rook } from "@/components/Rook";
import { marketingModels, type PublicModel } from "@/lib/models";
export type FooterLink = { href: string; label: string; tag?: string };

export function footerCols(showReferral: boolean, models: readonly PublicModel[] = marketingModels()): { title: string; links: FooterLink[] }[] {
  const product: FooterLink[] = [
    { href: "/chat", label: "Chat" },
    { href: "/projects", label: "Projects" },
    { href: "/pricing", label: "Pricing" },
    { href: "/faq", label: "FAQ" },
    { href: "/connect", label: "Connect" },
    ...(showReferral ? [{ href: "/account/referrals", label: "Referral program", tag: "Free month of Pro" } satisfies FooterLink] : []),
  ];
  return [
    { title: "Product", links: product },
    {
      title: "Engine",
      links: [
        { href: "/models", label: "Models" },
        ...models.map((m) => ({ href: `/models/${m.id}`, label: m.name })),
      ],
    },
    {
      title: "Account",
      links: [
        { href: "/account", label: "Plan & usage" },
        { href: "/login", label: "Log in" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
        { href: "/terms", label: "Terms" },
        { href: "/privacy", label: "Privacy" },
      ],
    },
  ];
}

/**
 * `showReferral` is decided by a server parent (`referralProgramVisible`) so the link is present in the HTML only
 * while the promo is on, and so client hydration can't flash it on or off.
 */
export function Footer({ showReferral = false, models }: { showReferral?: boolean; models?: PublicModel[] }) {
  const year = new Date().getFullYear();
  const COLS = footerCols(showReferral, models);
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="nav-brand" aria-label="Citad3L home">
              <Rook size={20} />
              <span>Citad3L</span>
            </Link>
            <p className="footer-brand-line">Hold the high ground<br />on what&apos;s next.</p>
            <p className="footer-tag">A strategic AI assistant for everyday work and frontier questions.</p>
            <p className="footer-note">Citad3L runs on third-party providers. We don&apos;t train these models from scratch.</p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="footer-col-title">{col.title}</div>
              <ul className="footer-links" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>
                      {l.label}
                      {l.tag ? <span className="footer-link-tag">{l.tag}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {year} Citad3L</span>
          <nav aria-label="Legal">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
      </div>
      <div className="footer-giant" aria-hidden="true">Citad3L</div>
    </footer>
  );
}

export default Footer;
