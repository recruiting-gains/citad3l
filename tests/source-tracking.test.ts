/** Visitor source tracking (2026-11-25): cookie format, referrer mapping, landing route, conversion rows. No server. */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { visitSource, sourceAttribution, user, db } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const visitSource = { create: vi.fn<AnyFn>(async () => ({})) };
  const sourceAttribution = { createMany: vi.fn<AnyFn>(async () => ({ count: 1 })), findUnique: vi.fn<AnyFn>(async () => null) };
  const user = { findUnique: vi.fn<AnyFn>() };
  const db = { visitSource, sourceAttribution, user };
  return { visitSource, sourceAttribution, user, db };
});
vi.mock("@/lib/db", () => ({ prisma: db, dbConfigured: () => true }));

import {
  cleanReferrerHost,
  decodeFirstTouchCookieValue,
  effectiveSource,
  encodeFirstTouchCookieValue,
  externalReferrerHost,
  makeVisitorId,
  readFirstTouchCookieHeader,
  readUtmCookieHeader,
  sourceFromReferrer,
  UTM_COOKIE,
} from "@/lib/utm";
import {
  attributionRow,
  cleanLandingPath,
  firstTouchFromMetadata,
  hashVisitorId,
  landingRow,
  recordGuestStart,
  recordPaymentSource,
  recordSignupSource,
} from "@/lib/source-tracking";
import { POST as postEvent } from "@/app/api/events/route";

const NOW = new Date("2026-11-26T03:30:00Z"); // 9:30 PM Nov 25 in Chicago

beforeEach(() => {
  vi.clearAllMocks();
  sourceAttribution.findUnique.mockResolvedValue(null);
  sourceAttribution.createMany.mockResolvedValue({ count: 1 });
});

describe("first-touch cookie", () => {
  it("round-trips tags, referrer host and random id, and old tag-only cookies still read", () => {
    const vid = makeVisitorId();
    expect(vid).toMatch(/^[a-f0-9]{24}$/);
    const raw = encodeFirstTouchCookieValue({ tags: { source: "instagram", medium: "social", campaign: "8wk", content: "bio" }, referrerHost: "l.instagram.com", visitorId: vid });
    expect(raw.length).toBeLessThan(256);
    const header = `a=1; ${UTM_COOKIE}=${encodeURIComponent(raw)}`;
    expect(readFirstTouchCookieHeader(header)).toEqual({ tags: { source: "instagram", medium: "social", campaign: "8wk", content: "bio" }, referrerHost: "l.instagram.com", visitorId: vid });
    // the existing tag reader (used by funnel logs and checkout metadata) is unchanged
    expect(readUtmCookieHeader(header)).toEqual({ source: "instagram", medium: "social", campaign: "8wk", content: "bio" });
    expect(decodeFirstTouchCookieValue("s=x&c=launch")).toEqual({ tags: { source: "x", campaign: "launch" } });
  });

  it("drops junk: bad ids, full URLs reduce to host, garbage is null", () => {
    expect(decodeFirstTouchCookieValue("v=<script>&r=not a host")).toBeNull();
    expect(cleanReferrerHost("https://www.Google.com/search?q=secret")).toBe("google.com");
    expect(cleanReferrerHost("javascript:alert(1)")).toBeUndefined();
    expect(decodeFirstTouchCookieValue("x".repeat(300))).toBeNull();
  });

  it("ignores our own site as a referrer", () => {
    expect(externalReferrerHost("https://citad3l.io/pricing", "citad3l.io")).toBeUndefined();
    expect(externalReferrerHost("https://www.citad3l.io/", "citad3l.io")).toBeUndefined();
    expect(externalReferrerHost("https://preview.workers.dev/x", "preview.workers.dev")).toBeUndefined();
    expect(externalReferrerHost("", "citad3l.io")).toBeUndefined();
    expect(externalReferrerHost("https://l.instagram.com/", "citad3l.io")).toBe("l.instagram.com");
  });

  it("maps referring sites to short sources; utm_source wins; nothing = direct", () => {
    expect(sourceFromReferrer("l.instagram.com")).toBe("instagram");
    expect(sourceFromReferrer("t.co")).toBe("x");
    expect(sourceFromReferrer("lm.facebook.com")).toBe("facebook");
    expect(sourceFromReferrer("threads.net")).toBe("threads");
    expect(sourceFromReferrer("www.tiktok.com")).toBe("tiktok");
    expect(sourceFromReferrer("google.co.uk")).toBe("google");
    expect(sourceFromReferrer("news.ycombinator.com")).toBe("news.ycombinator.com");
    expect(effectiveSource({ source: "threads" }, "google.com")).toBe("threads");
    expect(effectiveSource(null, "t.co")).toBe("x");
    expect(effectiveSource(null, undefined)).toBe("direct");
  });
});

describe("rows (privacy)", () => {
  it("landing row: Chicago day, cleaned path, hashed id, no raw id", () => {
    const row = landingRow({ tags: { source: "instagram", medium: "social", campaign: "8wk", content: "bio" }, path: "/pricing?email=a@b.c", visitorId: "abcdef0123456789abcdef01" }, NOW);
    expect(row).toMatchObject({ day: "2026-11-25", source: "instagram", medium: "social", campaign: "8wk", content: "bio", landingPath: "/pricing", tagged: true });
    expect(row.visitorHash).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(row)).not.toContain("abcdef0123456789abcdef01");
    expect(hashVisitorId(undefined)).toBeNull();
    expect(cleanLandingPath("https://evil")).toBe("/");
  });

  it("attribution row without a cookie is 'direct'", () => {
    expect(attributionRow("guest_start", { guestId: "g_1" }, null, {}, NOW)).toMatchObject({ kind: "guest_start", day: "2026-11-25", guestId: "g_1", userId: null, source: "direct" });
  });
});

describe("/api/events landing", () => {
  it("writes one VisitSource row with this visit's tags and referrer host, hashed cookie id only", async () => {
    const cookie = `${UTM_COOKIE}=${encodeURIComponent(encodeFirstTouchCookieValue({ tags: { source: "x" }, visitorId: "0123456789abcdef01234567" }))}`;
    const res = await postEvent(new Request("https://citad3l.io/api/events", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "x-forwarded-for": "10.9.8.7" },
      body: JSON.stringify({ event: "landing", path: "/", src: "Instagram", med: "social", cmp: "8wk", cnt: "bio", ref: "l.instagram.com" }),
    }));
    expect(res.status).toBe(204);
    expect(visitSource.create).toHaveBeenCalledTimes(1);
    const data = (visitSource.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ source: "instagram", medium: "social", campaign: "8wk", content: "bio", referrerHost: "l.instagram.com", landingPath: "/", tagged: true });
    expect(JSON.stringify(data)).not.toContain("10.9.8.7");
    expect(JSON.stringify(data)).not.toContain("0123456789abcdef01234567");
  });

  it("direct landing with no cookie is recorded as direct with no visitor hash; bad bodies write nothing", async () => {
    await postEvent(new Request("https://citad3l.io/api/events", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.2" }, body: JSON.stringify({ event: "landing", path: "/faq" }) }));
    expect((visitSource.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data).toMatchObject({ source: "direct", visitorHash: null, tagged: false, landingPath: "/faq" });
    visitSource.create.mockClear();
    await postEvent(new Request("https://citad3l.io/api/events", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.3" }, body: JSON.stringify({ event: "landing", path: "not a path" }) }));
    expect(visitSource.create).not.toHaveBeenCalled();
  });

  it("a database failure never breaks the request", async () => {
    visitSource.create.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await postEvent(new Request("https://citad3l.io/api/events", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.4" }, body: JSON.stringify({ event: "landing", path: "/" }) }));
    expect(res.status).toBe(204);
    err.mockRestore();
  });
});

describe("conversions", () => {
  const cookie = `${UTM_COOKIE}=${encodeURIComponent(encodeFirstTouchCookieValue({ tags: { source: "threads", campaign: "8wk" }, visitorId: "aaaaaaaaaaaaaaaaaaaaaaaa" }))}`;

  it("guest start uses the first-touch cookie and skips duplicates", async () => {
    await recordGuestStart("g_abc", cookie, NOW);
    expect(sourceAttribution.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ kind: "guest_start", guestId: "g_abc", source: "threads", campaign: "8wk" })], skipDuplicates: true });
  });

  it("signup counts only brand-new accounts", async () => {
    user.findUnique.mockResolvedValueOnce({ createdAt: new Date(NOW.getTime() - 60_000) });
    expect(await recordSignupSource("u1", cookie, NOW)).toBe(true);
    expect(sourceAttribution.createMany.mock.calls[0][0]).toMatchObject({ data: [{ kind: "signup", userId: "u1", source: "threads" }] });
    sourceAttribution.createMany.mockClear();
    user.findUnique.mockResolvedValueOnce({ createdAt: new Date(NOW.getTime() - 2 * 60 * 60_000) });
    expect(await recordSignupSource("u2", cookie, NOW)).toBe(false);
    expect(sourceAttribution.createMany).not.toHaveBeenCalled();
  });

  it("payment copies the signup's first touch, else Stripe metadata tags; free invoices are skipped", async () => {
    sourceAttribution.findUnique.mockResolvedValueOnce({ source: "tiktok", medium: "social", campaign: "8wk", content: "bio", referrerHost: null, visitorHash: "h" });
    await recordPaymentSource("u1", { amountCents: 2000, plan: "pro", metadata: { utm_source: "x" } }, NOW);
    expect(sourceAttribution.createMany.mock.calls[0][0]).toMatchObject({ data: [{ kind: "payment", userId: "u1", source: "tiktok", amountCents: 2000, plan: "pro" }] });
    sourceAttribution.createMany.mockClear();
    await recordPaymentSource("u2", { amountCents: 2000, plan: "pro", metadata: { userId: "u2", utm_source: "x", utm_ref: "t.co" } }, NOW);
    expect(sourceAttribution.createMany.mock.calls[0][0]).toMatchObject({ data: [{ kind: "payment", userId: "u2", source: "x", referrerHost: "t.co" }] });
    sourceAttribution.createMany.mockClear();
    expect(await recordPaymentSource("u3", { amountCents: 0 }, NOW)).toBe(false);
    expect(sourceAttribution.createMany).not.toHaveBeenCalled();
    expect(firstTouchFromMetadata({ userId: "u", plan: "pro" })).toBeNull();
  });

  it("write failures are swallowed", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    sourceAttribution.createMany.mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await recordGuestStart("g_x", null, NOW)).toBe(false);
    err.mockRestore();
  });
});
