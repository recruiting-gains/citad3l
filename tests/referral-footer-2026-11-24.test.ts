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
  it("hamburger/menu has no Product section, so the link lives in the footer only", () => {
    const nav = readFileSync("components/TopNav.tsx", "utf8");
    expect(nav).not.toMatch(/Product/);
    expect(nav).not.toMatch(/Referral program/);
  });
  it("signed-out visitors who open /account/referrals are sent to sign-in with a return URL", () => {
    const page = readFileSync("app/account/referrals/page.tsx", "utf8");
    expect(page).toMatch(/redirect\("\/login\?next=\/account\/referrals"\)/);
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
