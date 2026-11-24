"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rook } from "@/components/Rook";
import { ThemeToggle, ThemeSegment } from "@/components/ThemeToggle";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />
    </svg>
  );
}
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface NavItem { href: string; label: string; match: (p: string) => boolean; }

const LINKS: NavItem[] = [
  { href: "/", label: "Explore", match: (p) => p === "/" },
  { href: "/chat", label: "Chat", match: (p) => p === "/chat" || p.startsWith("/chat/") },
  { href: "/models", label: "Models", match: (p) => p === "/models" || p.startsWith("/models/") },
  { href: "/projects", label: "Projects", match: (p) => p.startsWith("/projects") },
  { href: "/faq", label: "FAQ", match: (p) => p === "/faq" || p.startsWith("/faq/") },
  { href: "/connect", label: "Connect", match: (p) => p === "/connect" || p.startsWith("/connect") },
];

/** Signed-out visitors get a short menu: Chat, Pricing, FAQ (plus Log in / Get started). */
const GUEST_LINKS: NavItem[] = [
  { href: "/chat", label: "Chat", match: (p) => p === "/chat" || p.startsWith("/chat/") },
  { href: "/pricing", label: "Pricing", match: (p) => p.startsWith("/pricing") },
  { href: "/faq", label: "FAQ", match: (p) => p === "/faq" || p.startsWith("/faq/") },
];

function initials(label?: string): string {
  if (!label) return "C";
  const base = label.includes("@") ? label.split("@")[0] : label;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return s.toUpperCase() || "C";
}

export interface TopNavProps { signedIn: boolean; userLabel?: string; isOwner?: boolean; }

export function TopNav({ signedIn, userLabel, isOwner }: TopNavProps) {
  const pathname = usePathname() ?? "/";
  const links = !signedIn ? GUEST_LINKS : isOwner ? [...LINKS, { href: "/admin", label: "Admin", match: (p: string) => p === "/admin" || p.startsWith("/admin/") }] : LINKS;
  const [open, setOpen] = React.useState(false);
  const burgerRef = React.useRef<HTMLButtonElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const [isPhone, setIsPhone] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const update = () => {
      setIsPhone(mq.matches);
      if (!mq.matches) setOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  React.useEffect(() => { setOpen(false); }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pricingActive = pathname.startsWith("/pricing");
  const accountActive = pathname.startsWith("/account");

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand" aria-label="Citad3L home">
          <Rook size={isPhone ? 22 : 18} />
          <span>Citad3L</span>
        </Link>

        {(
          <nav className="nav-links" aria-label="Primary">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" aria-current={l.match(pathname) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="nav-right">
          <ThemeToggle />
          {signedIn && (
            <Link href="/chat" className="icon-btn nav-icon" aria-label="Search chats">
              <SearchIcon />
            </Link>
          )}
          <>
            <div className="nav-desktop">
              {signedIn ? (
                <>
                <Link href="/projects" className="icon-btn nav-icon" aria-label="Projects">
                  <FolderIcon />
                </Link>
                <Link href="/pricing" className="nav-text" aria-current={pricingActive ? "page" : undefined}>
                  Pricing
                </Link>
                <Link
                  href="/account"
                  className="nav-avatar"
                  aria-label={`Account${userLabel ? ` (${userLabel})` : ""}`}
                  aria-current={accountActive ? "page" : undefined}
                  title={userLabel}
                >
                  {initials(userLabel)}
                </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary btn-sm">Log in</Link>
                  <Link href="/login?next=/chat" className="btn btn-primary btn-sm">Get started</Link>
                </>
              )}
            </div>
            <button
              ref={burgerRef}
              type="button"
              className="icon-btn nav-icon nav-burger"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="nav-sheet"
              onClick={() => setOpen((o) => !o)}
            >
              <MenuIcon open={open} />
            </button>
          </>
        </div>
      </div>

      {isPhone && open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="nav-sheet" ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="sheet-link" aria-current={l.match(pathname) ? "page" : undefined}>
                {l.label}
                <ChevronIcon />
              </Link>
            ))}
            {signedIn && (
              <Link href="/pricing" className="sheet-link" aria-current={pricingActive ? "page" : undefined}>
                Pricing
                <ChevronIcon />
              </Link>
            )}
            {signedIn && (
              <Link href="/account" className="sheet-link" aria-current={accountActive ? "page" : undefined}>
                <span>Account{userLabel ? <span className="text-3"> · {userLabel}</span> : null}</span>
                <ChevronIcon />
              </Link>
            )}
            <div className="sheet-theme">
              <span id="sheet-theme-label">Theme</span>
              <ThemeSegment size="sm" labelledBy="sheet-theme-label" />
            </div>
            {!signedIn && (
              <div className="sheet-actions">
                <Link href="/login" className="btn btn-secondary">Log in</Link>
                <Link href="/login?next=/chat" className="btn btn-primary">Get started</Link>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}

export default TopNav;
