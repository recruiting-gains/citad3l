import * as React from "react";
import Link from "next/link";
import { Rook } from "@/components/Rook";
import { marketingModels } from "@/lib/models";

function footerCols(): { title: string; links: { href: string; label: string }[] }[] {
  return [
  {
    title: "Product",
    links: [
      { href: "/chat", label: "Chat" },
      { href: "/projects", label: "Projects" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/connect", label: "Connect" },
    ],
  },
  {
    title: "Engine",
    links: [
      { href: "/models", label: "Models" },
      ...marketingModels().map((m) => ({ href: `/models/${m.id}`, label: m.name })),
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
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
  ];
}

export function Footer() {
  const year = new Date().getFullYear();
  const COLS = footerCols();
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
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {year} Citad3L</span>
          <nav aria-label="Legal">
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
