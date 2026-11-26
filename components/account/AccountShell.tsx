"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/account", label: "Profile", exact: true },
  { href: "/account/instructions", label: "Custom instructions" },
  { href: "/account/usage", label: "Usage" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/sessions", label: "Sessions" },
  { href: "/account/referrals", label: "Referrals" },
];

export function AccountShell({ title, intro, children, isOwner }: { title: string; intro?: string; children: React.ReactNode; isOwner?: boolean }) {
  const path = usePathname() ?? "/account";
  return (
    <main className="page-wrap account-page page-main account-shell">
      <nav className="account-nav" aria-label="Account">
        <div className="account-nav-label">Account</div>
        {NAV.map((item) => {
          const current = item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
        <div className="account-nav-sep" />
        <Link href="/connect" aria-current={path === "/connect" ? "page" : undefined}>Connect</Link>
        {isOwner ? <Link href="/admin" aria-current={path === "/admin" ? "page" : undefined}>Admin</Link> : null}
      </nav>
      <div className="account-main">
        <header className="account-head">
          <h1 className="page-title">{title}</h1>
          {intro ? <p className="page-sub">{intro}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

export default AccountShell;
