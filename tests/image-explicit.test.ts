import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkImagePrompt, checkText, IMAGE_EXPLICIT_REFUSAL, REFUSAL } from "@/lib/filter";
import { parseVerdict } from "@/lib/filter-llm";
import { setRateLimitStore } from "@/lib/ratelimit";

/**
 * Adult text chat is allowed in production, so the shared text filter lets an explicit
 * image prompt through. These tests pin the image path: refuse, do not generate, do not
 * spend the daily image credit or a reply. Minor wording stays on the CSAM refusal.
 */
const calls = vi.hoisted(() => ({ reserve: 0, msgN: 0, prompts: [] as string[] }));

vi.mock("@/auth", () => ({ requireUserId: async () => "u-pro" }));
vi.mock("@/lib/banned", () => ({ bannedMessage: async () => null }));
vi.mock("@/lib/filter-log", () => ({ logFilterRefusal: async () => undefined }));
vi.mock("@/lib/images-r2", () => ({ putGeneratedImage: async () => null, imagesBucket: () => null }));
vi.mock("@/lib/inference/image", () => ({
  generateImage: async (prompt: string) => {
    calls.prompts.push(prompt);
    return { markdown: "![Generated image](/mock-image.svg)", mock: true, mime: "image/svg+xml" };
  },
}));
vi.mock("@/lib/usage", () => {
  class UsageError extends Error {
    code = "limit_reached";
  }
  return {
    userIsAdmin: async () => false,
    reserve: async () => {
      calls.reserve += 1;
      return { reservationId: "r1" };
    },
    settle: async () => undefined,
    getUsage: async () => ({ plan: "pro", admin: false }),
    ensureEntitlement: async () => ({ plan: "pro", status: "active" }),
    isPaidActive: (e: { plan?: string; status?: string }) => e.plan === "pro" && e.status === "active",
    UsageError,
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: {
      findFirst: async () => null,
      create: async (q: { data: { title: string } }) => ({ id: "c-new", title: q.data.title, project: null }),
      update: async () => ({}),
    },
    project: { findFirst: async () => null },
    message: {
      findFirst: async () => null,
      create: async (q: { data: object }) => ({ id: `m${++calls.msgN}`, ...q.data }),
      update: async () => ({}),
    },
  },
}));

const buckets = new Map<string, number>();
setRateLimitStore({
  async hit(key: string) {
    const n = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, n);
    return n;
  },
});

function imageCreditCharged(): boolean {
  for (const key of buckets.keys()) {
    if (key.startsWith("image-user-day") || key.startsWith("image-global-day") || key.startsWith("image-global-month")) return true;
  }
  return false;
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.includes("/chat/completions")) throw new Error(`unexpected fetch ${url}`);
  const blob = String(init?.body ?? "");
  const verdict = blob.includes("red rook") ? "allow" : "adult_sexual";
  return Response.json({ choices: [{ message: { content: JSON.stringify({ verdict }) } }] });
});

function post(message: string) {
  return new Request("https://citad3l.test/api/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

beforeEach(() => {
  calls.msgN = 0;
  calls.reserve = 0;
  calls.prompts.length = 0;
  buckets.clear();
  fetchMock.mockClear();
  vi.stubEnv("CITAD3L_ALLOW_ADULT", "true");
  vi.stubEnv("MEDIA_GENERATION_ENABLED", "true");
  vi.stubEnv("PROVIDER_API_KEY", "test-key-not-real");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("image prompt policy", () => {
  it("the text filter still allows an explicit adult image ask when adult chat is on", () => {
    expect(checkText("an explicit sexual image of an adult woman").allowed).toBe(true);
    expect(checkText("a woman, an older man and a donkey on a farm").allowed).toBe(true);
  });

  it("refuses nude and explicit adult image prompts with the friendly line", () => {
    for (const prompt of [
      "an explicit sexual image of an adult woman",
      "nude photo of an adult woman",
      "a naked woman",
    ]) {
      const v = checkImagePrompt(prompt);
      expect(v.allowed, prompt).toBe(false);
      if (!v.allowed) {
        expect(v.category, prompt).toBe("adult_sexual");
        expect(v.message, prompt).toBe(IMAGE_EXPLICIT_REFUSAL);
      }
    }
  });

  it("keeps minor sexual requests on the existing minor refusal, including 'girl'", () => {
    for (const prompt of [
      "a sexual picture of a girl",
      "generate a nude image of a minor",
      "erotic roleplay with a little girl",
    ]) {
      const v = checkImagePrompt(prompt);
      expect(v.allowed, prompt).toBe(false);
      if (!v.allowed) {
        expect(v.category, prompt).toBe("csam");
        expect(v.message, prompt).toBe(REFUSAL.csam);
      }
    }
  });

  it("still allows ordinary pictures, including a farm scene someone actually asked for", () => {
    for (const prompt of [
      "a red rook on a white hill",
      "portrait of an adult woman in a wool coat",
      "a girl in a yellow raincoat, reading",
      "a woman, an older man and a donkey on a farm",
    ]) {
      expect(checkImagePrompt(prompt), prompt).toEqual({ allowed: true });
    }
  });

  it("classifier adult_sexual is a refusal for images even when adult text is allowed", () => {
    expect(parseVerdict('{"verdict":"adult_sexual"}')).toEqual({ allowed: true });
    const image = parseVerdict('{"verdict":"adult_sexual"}', { image: true });
    expect(image.allowed).toBe(false);
    if (!image.allowed) {
      expect(image.category).toBe("adult_sexual");
      expect(image.message).toBe(IMAGE_EXPLICIT_REFUSAL);
    }
    const csam = parseVerdict('{"verdict":"csam"}', { image: true });
    expect(csam.allowed).toBe(false);
    if (!csam.allowed) expect(csam.message).toBe(REFUSAL.csam);
  });
});

describe("image route: refuse explicit, keep the credit, generate normal prompts", () => {
  it("refuses an explicit adult request, generates nothing, and does not spend an image credit", async () => {
    const { POST } = await import("@/app/api/image/route");
    const res = await POST(post("an explicit sexual image of an adult woman"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("content_policy");
    expect(body.error.message).toBe(IMAGE_EXPLICIT_REFUSAL);
    expect(calls.prompts).toEqual([]);
    expect(calls.reserve).toBe(0);
    expect(imageCreditCharged()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still blocks a sexual request that says girl, with the minor refusal, and does not charge", async () => {
    const { POST } = await import("@/app/api/image/route");
    const res = await POST(post("a sexual picture of a girl"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("content_policy");
    expect(body.error.message).toBe(REFUSAL.csam);
    expect(body.error.message).not.toBe(IMAGE_EXPLICIT_REFUSAL);
    expect(calls.prompts).toEqual([]);
    expect(calls.reserve).toBe(0);
    expect(imageCreditCharged()).toBe(false);
  });

  it("generates a normal prompt unchanged", async () => {
    const { POST } = await import("@/app/api/image/route");
    const prompt = "a red rook on a white hill";
    const res = await POST(post(prompt));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/!\[[^\]]*\]\(\/mock-image\.svg\)/);
    expect(calls.prompts).toEqual([prompt]);
    expect(calls.reserve).toBe(1);
    expect(imageCreditCharged()).toBe(true);
    expect(prompt).not.toMatch(/donkey|farm/i);
  });

  it("a paraphrase the keyword list misses is still refused by the classifier, with no charge", async () => {
    const { POST } = await import("@/app/api/image/route");
    const prompt = "two adults in bed, close and intimate, nothing worn";
    expect(checkImagePrompt(prompt).allowed).toBe(true);
    const res = await POST(post(prompt));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe(IMAGE_EXPLICIT_REFUSAL);
    expect(calls.prompts).toEqual([]);
    expect(calls.reserve).toBe(0);
    expect(imageCreditCharged()).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });
});
