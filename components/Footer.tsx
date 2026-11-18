import * as React from "react";
import Link from "next/link";
import { Rook } from "@/components/Rook";
import { ENGINE } from "@/lib/engine";

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 16 16 8M10 8h6v6" />
    </svg>
  );
}

const COLS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/chat", label: "Chat" },
      { href: "/projects", label: "Projects" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Engine",
    links: [
      { href: "/models", label: "Models" },
      { href: `/models/${ENGINE.slug}`, label: "Citad3L V1" },
      { href: ENGINE.repoUrl, label: "Weights on Hugging Face", external: true },
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
      { href: ENGINE.licenseUrl, label: "Apache-2.0", external: true },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
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
            <p className="footer-note">{ENGINE.attribution} Base model {ENGINE.baseModel}, licensed {ENGINE.license}.</p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <div className="footer-col-title">{col.title}</div>
              <ul className="footer-links" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer">
                        {l.label}
                        <ExternalIcon />
                      </a>
                    ) : (
                      <Link href={l.href}>{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {year} Citad3L</span>
          <nav aria-label="Legal">
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
