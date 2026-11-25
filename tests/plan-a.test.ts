import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  cleanUtmValue,
  decodeUtmCookieValue,
  encodeUtmCookieValue,
  parseUtmFromSearch,
  readUtmCookieHeader,
  UTM_COOKIE,
  utmMetadata,
} from "@/lib/utm";
import { isSlashImageCommand, looksLikeImageRequest } from "@/lib/image-intent";
import { POST as postEvent } from "@/app/api/events/route";
import { LEAK_RE } from "./leak-words";

describe("Plan A — UTM attribution (lib/utm)", () => {
  it("parses and sanitizes valid UTM query parameters", () => {
    const utm = parseUtmFromSearch("?utm_source=X&utm_medium=Social%20Post&utm_campaign=Plan-A_Nov&utm_content=post%201!");
    expect(utm).toEqual({
      source: "x",
      medium: "social-post",
      campaign: "plan-a_nov",
      content: "post-1",
    });
  });

  it("returns null when no UTM parameters are present", () => {
    expect(parseUtmFromSearch("?ref=abcd1234")).toBeNull();
    expect(parseUtmFromSearch("")).toBeNull();
  });

  it("round-trips cookie encoding and builds Stripe metadata", () => {
    const raw = encodeUtmCookieValue({ source: "x", medium: "social", campaign: "launch", content: "hook1" });
    const header = `foo=1; ${UTM_COOKIE}=${encodeURIComponent(raw)}; bar=2`;
    const parsed = readUtmCookieHeader(header);
    expect(parsed).toEqual({ source: "x", medium: "social", campaign: "launch", content: "hook1" });
    expect(utmMetadata(parsed)).toEqual({
      utm_source: "x",
      utm_medium: "social",
      utm_campaign: "launch",
      utm_content: "hook1",
    });
  });

  it("ignores malformed cookies and truncates long values", () => {
    expect(decodeUtmCookieValue("not-json")).toBeNull();
    expect(cleanUtmValue("A".repeat(100))?.length).toBe(40);
  });
});

describe("Plan A — Image intent helper (lib/image-intent)", () => {
  it("detects /image slash command and natural image generation asks", () => {
    expect(isSlashImageCommand("/image a minimalist rook")).toBe(true);
    expect(isSlashImageCommand("/image")).toBe(true);
    expect(looksLikeImageRequest("/image a minimalist rook")).toBe(true);
    expect(looksLikeImageRequest("Draw me a logo for my studio")).toBe(true);
    expect(looksLikeImageRequest("Generate an image of a cyberpunk rook")).toBe(true);
    expect(looksLikeImageRequest("Make a crisp picture of a mountain cabin")).toBe(true);
  });

  it("does not trigger on normal informational questions about images", () => {
    expect(isSlashImageCommand("hello")).toBe(false);
    expect(looksLikeImageRequest("How does PNG image compression work?")).toBe(false);
    expect(looksLikeImageRequest("What is the best resolution for web photos?")).toBe(false);
    expect(looksLikeImageRequest("Plan a focused 4-hour work block today")).toBe(false);
  });
});

describe("Plan A — Privacy-friendly /api/events route", () => {
  it("logs whitelisted events with UTM metadata and ignores unknown event names", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const okReq = new Request("https://citad3l.io/api/events", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${UTM_COOKIE}=${encodeURIComponent(encodeUtmCookieValue({ source: "x", campaign: "plan-a" }))}` },
        body: JSON.stringify({ event: "utm_landing", path: "/pricing" }),
      });
      const okRes = await postEvent(okReq);
      expect(okRes.status).toBe(204);
      expect(spy).toHaveBeenCalledWith("[funnel]", expect.stringContaining('"utm_source":"x"'));

      spy.mockClear();
      const badReq = new Request("https://citad3l.io/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "arbitrary_evil_event" }),
      });
      const badRes = await postEvent(badReq);
      expect(badRes.status).toBe(204);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Plan A — Copy & feature compliance", () => {
  it("keeps copy free of vendor names, E2E claims on site, and banned words", () => {
    const files = [
      "app/layout.tsx",
      "components/marketing/HomeView.tsx",
      "components/marketing/GuestTryBox.tsx",
      "app/account/referrals/page.tsx",
      "components/chat/ChatWorkspace.tsx",
    ];
    for (const f of files) {
      const txt = readFileSync(f, "utf8");
      expect(txt).not.toMatch(LEAK_RE);
      expect(txt).not.toMatch(/end-to-end/i);
      expect(txt).not.toMatch(/abliterat/i);
    }
  });

  it("includes everyday starter prompts, soft save ask, and image upgrade card", () => {
    const tryBox = readFileSync("components/marketing/GuestTryBox.tsx", "utf8");
    expect(tryBox).toContain("Plan a focused 4-hour work block");
    expect(tryBox).toContain("Save your chat");
    expect(tryBox).toContain("Image generation comes with Pro");

    const ws = readFileSync("components/chat/ChatWorkspace.tsx", "utf8");
    expect(ws).toContain('data-testid="image-upgrade-card"');
    expect(ws).toContain("Citad3L Image comes with Pro ($20/mo)");
    expect(ws).toContain("Save your chat");
  });
});
