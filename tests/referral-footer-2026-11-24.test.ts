/** Footer entry for the referral promo (2026-11-24): under Product, only while the program is on and before the end date. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("footer Product column", () => {
  const footer = readFileSync("components/Footer.tsx", "utf8");
  it("adds Referral program under Product, with a Free month of Pro tag, pointing at the account page", () => {
    expect(footer).toMatch(/title: "Product"/);
    expect(footer).toMatch(/href: "\/account\/referrals"/);
    expect(footer).toMatch(/label: "Referral program"/);
    expect(footer).toMatch(/tag: "Free month of Pro"/);
    expect(footer).toMatch(/footer-link-tag/);
    expect(footer.indexOf("{ href: \"/connect\", label: \"Connect\" }")).toBeLessThan(footer.indexOf("Referral program"));
  });
  it("omits the link when the promo should stay hidden", () => {
    expect(footer).toMatch(/showReferral = false/);
    expect(footer).toMatch(/\.\.\.\(showReferral \? \[\{ href: "\/account\/referrals"/);
  });
  it("mobile hamburger also has Referral program, only when showReferral is on, pointing at the account page", () => {
    const nav = readFileSync("components/TopNav.tsx", "utf8");
    expect(nav).not.toMatch(/title: "Product"|Product column/);
    expect(nav).toMatch(/showReferral && \(/);
    expect(nav).toMatch(/href="\/account\/referrals"/);
    expect(nav).toMatch(/Referral program/);
    expect(nav).toMatch(/Free month of Pro/);
    // Only in the phone sheet, not the desktop link row.
    const sheet = nav.slice(nav.indexOf("nav-sheet"));
    const desktop = nav.slice(0, nav.indexOf("nav-sheet"));
    expect(sheet).toMatch(/Referral program/);
    expect(desktop).not.toMatch(/Referral program/);
  });
  it("the layout decides hamburger visibility on the server so the link hides after Dec 8", () => {
    expect(readFileSync("app/layout.tsx", "utf8")).toMatch(/showReferral=\{referralProgramVisible\(\)\}/);
  });
  it("signed-out visitors who open /account/referrals see the public referral page with a sign-in CTA", () => {
    const page = readFileSync("app/account/referrals/page.tsx", "utf8");
    expect(page).not.toMatch(/redirect\("\/login/);
    expect(page).toContain('href="/login?next=/account/referrals"');
    expect(page).toContain("Sign in to get your link");
  });
  it("marketing pages decide visibility on the server so the link hides after Dec 8 without a client flash", () => {
    expect(readFileSync("app/page.tsx", "utf8")).toMatch(/showReferral=\{referralProgramVisible\(\)\}/);
    expect(readFileSync("app/pricing/page.tsx", "utf8")).toMatch(/showReferral=\{referralProgramVisible\(\)\}/);
    expect(readFileSync("app/models/[id]/page.tsx", "utf8")).toMatch(/showReferral=\{referralProgramVisible\(\)\}/);
    expect(readFileSync("components/SiteFooter.tsx", "utf8")).toMatch(/showReferral=\{referralProgramVisible\(\)\}/);
    expect(readFileSync("app/faq/page.tsx", "utf8")).toMatch(/SiteFooter/);
    expect(readFileSync("components/legal/LegalPage.tsx", "utf8")).toMatch(/SiteFooter/);
    expect(readFileSync("components/account/ConnectView.tsx", "utf8")).toMatch(/SiteFooter/);
    expect(readFileSync("components/model/ModelsIndexView.tsx", "utf8")).toMatch(/SiteFooter/);
  });
});
