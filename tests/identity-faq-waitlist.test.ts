import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTurns, systemPrompt } from "@/lib/prompt";
import { checkText } from "@/lib/filter";
import { FAQ_ITEMS, faqJsonLd } from "@/lib/faq";
import { LEAK_RE, LEAK_WORDS } from "./leak-words";
import {
  addWaitlistSignup,
  isHoneypot,
  normalizeWaitlistEmail,
  normalizeWaitlistSource,
  WAITLIST_RATE_LIMIT,
  type WaitlistStore,
} from "@/lib/waitlist";

const VENDORS = LEAK_WORDS;

function memStore(rows: { email: string; source: string; ipHash: string }[] = []): WaitlistStore & { rows: typeof rows } {
  const out = {
    rows,
    async create(data: { email: string; source: string; ipHash: string }) {
      if (rows.some((r) => r.email === data.email)) return "exists" as const;
      rows.push(data);
      return "created" as const;
    },
  };
  return out;
}

describe("system prompt identity", () => {
  it("describes Citad3L accurately and uses the picked model name", () => {
    const v1 = systemPrompt("Citad3L V1");
    const fast = systemPrompt("Citad3L Fast");
    expect(v1).toContain("You are Citad3L (this chat: Citad3L V1)");
    expect(fast).toContain("You are Citad3L (this chat: Citad3L Fast)");
    for (const text of [v1, fast]) {
      expect(text).toMatch(/private, less-filtered/i);
      expect(text).toContain("citad3l.io");
      expect(text).toContain("Cruz Garza");
      expect(text).toMatch(/Citad3L V1/);
      expect(text).toMatch(/Citad3L Fast/);
      expect(text).toMatch(/Citad3L Image/);
      expect(text).toMatch(/Max only/i);
      expect(text).toMatch(/Citad3L Private/);
      expect(text).toMatch(/Swarm/);
      expect(text).toMatch(/Video/);
      expect(text).toMatch(/web search/i);
      expect(text).toMatch(/extended thinking/i);
      expect(text).toMatch(/\$20/);
      expect(text).toMatch(/\$50/);
      expect(text).toMatch(/pricing page/i);
      expect(text).toMatch(/6-digit/i);
      expect(text).toMatch(/no passwords/i);
      expect(text).toMatch(/exploitation of children/i);
      expect(text).toMatch(/explosives/i);
      expect(text).toMatch(/Do not lecture or add extra refusals/);
      expect(text).toMatch(/Never claim to be another company's model/);
      expect(text).toMatch(/never name underlying vendors/i);
      for (const v of VENDORS) expect(text).not.toContain(v);
    }
    expect(v1.length).toBeLessThan(1800);
  });

  it("is prepended as the first turn for every chat", () => {
    const turns = buildTurns([{ role: "user", content: "What is Citad3L?" }], null, "Citad3L V1");
    expect(turns[0]?.role).toBe("system");
    expect(turns[0]?.content).toBe(systemPrompt("Citad3L V1"));
    expect(turns[1]?.content).toBe("What is Citad3L?");
  });

  it("does not trip the output filter when restating site policy", () => {
    expect(checkText(systemPrompt("Citad3L V1")).allowed).toBe(true);
    const answer = `Citad3L is a private, less-filtered AI chat app at citad3l.io, founded by Cruz Garza.
Available now: Citad3L V1, Fast, and Image. Coming soon: Private, Swarm, and Video.
Adult text chat between adults is allowed. The only hard lines are no sexual content involving minors, and nothing about bombs or explosives. Image mode keeps a safety filter and will not produce explicit nude or sexual images.`;
    expect(checkText(answer).allowed).toBe(true);
  });
});

describe("FAQ", () => {
  it("has 10–14 questions covering the required topics", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(10);
    expect(FAQ_ITEMS.length).toBeLessThanOrEqual(14);
    const blob = FAQ_ITEMS.map((i) => i.q + " " + i.a).join("\n");
    expect(blob).toMatch(/What is Citad3L/i);
    expect(blob).toMatch(/different/i);
    expect(blob).toMatch(/Citad3L V1/);
    expect(blob).toMatch(/private/i);
    expect(blob).toMatch(/not allowed/i);
    expect(blob).toMatch(/\$20/);
    expect(blob).toMatch(/Can I make videos/i);
    expect(blob).not.toMatch(/coming soon/i);
    expect(blob).toMatch(/6-digit/i);
    expect(blob).toMatch(/Guests/i);
    expect(blob).toMatch(/image/i);
    expect(blob).toMatch(/refund/i);
    expect(blob).toMatch(/Cruz Garza/);
    expect(blob).toMatch(/private, less-filtered/i);
    expect(blob).toMatch(/Image mode keeps a safety filter/);
    expect(blob).toMatch(/will not produce explicit nude or sexual images/);
    expect(blob).toMatch(/Adult text chat between adults is allowed/);
    for (const v of VENDORS) expect(blob).not.toContain(v);
  });

  it("emits FAQPage JSON-LD", () => {
    const ld = faqJsonLd("https://citad3l.io");
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(FAQ_ITEMS.length);
    expect(ld.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: FAQ_ITEMS[0].q,
      acceptedAnswer: { "@type": "Answer", text: FAQ_ITEMS[0].a },
    });
  });

  it("keeps vendor names out of public FAQ and waitlist UI", () => {
    const files = [
      "lib/faq.ts",
      "lib/prompt.ts",
      "components/marketing/WaitlistForm.tsx",
      "app/faq/page.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");
      for (const v of LEAK_WORDS) expect(src, rel).not.toContain(v);
    }
  });
});

describe("waitlist signup", () => {
  it("normalizes and rejects bad emails, and accepts known sources", () => {
    expect(normalizeWaitlistEmail("  owner@example.com ")).toBe("owner@example.com");
    expect(normalizeWaitlistEmail("nope")).toBeNull();
    expect(normalizeWaitlistEmail("")).toBeNull();
    expect(normalizeWaitlistSource("FAQ")).toBe("faq");
    expect(normalizeWaitlistSource("nope")).toBe("home");
    expect(isHoneypot("https://spam.test")).toBe(true);
    expect(isHoneypot("")).toBe(false);
    expect(isHoneypot(undefined)).toBe(false);
  });

  it("stores a valid signup, treats duplicates as success, and ignores honeypots", async () => {
    const store = memStore();
    const ok = await addWaitlistSignup({ email: "waitlist-test@example.com", source: "faq", ip: "1.2.3.4" }, store);
    expect(ok).toEqual({ ok: true });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].email).toBe("waitlist-test@example.com");
    expect(store.rows[0].source).toBe("faq");
    expect(store.rows[0].ipHash).toHaveLength(32);

    const again = await addWaitlistSignup({ email: "waitlist-test@example.com", source: "home", ip: "1.2.3.4" }, store);
    expect(again).toEqual({ ok: true });
    expect(store.rows).toHaveLength(1);

    const honey = await addWaitlistSignup({ email: "bot@example.com", source: "home", website: "http://spam", ip: "9.9.9.9" }, store);
    expect(honey).toEqual({ ok: true });
    expect(store.rows.some((r) => r.email === "bot@example.com")).toBe(false);
  });

  it("rejects an invalid email and rate-limits an IP", async () => {
    const store = memStore();
    const bad = await addWaitlistSignup({ email: "not-an-email", source: "home", ip: "5.5.5.5" }, store);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("invalid_email");

    const hits = new Map<string, number>();
    const limiter = (key: string, limit = WAITLIST_RATE_LIMIT) => {
      const n = (hits.get(key) ?? 0) + 1;
      hits.set(key, n);
      return n <= limit;
    };
    const ipStore = memStore();
    for (let i = 0; i < WAITLIST_RATE_LIMIT; i++) {
      const r = await addWaitlistSignup({ email: `ok${i}@example.com`, source: "home", ip: "8.8.8.8" }, ipStore, limiter);
      expect(r.ok).toBe(true);
    }
    const blocked = await addWaitlistSignup({ email: "one-more@example.com", source: "home", ip: "8.8.8.8" }, ipStore, limiter);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("rate_limited");
    expect(ipStore.rows).toHaveLength(WAITLIST_RATE_LIMIT);
  });
});
