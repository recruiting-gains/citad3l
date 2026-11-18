/** Unit tests for production guards (no server needed). */
import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("production guards", () => {
  it("mock provider is refused when NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INFERENCE_PROVIDER", "mock");
    const { getProvider, providerInfo } = await import("@/lib/inference");
    expect(() => getProvider()).toThrow(/disabled in production/);
    expect(providerInfo().mock).toBe(false);
  });
  it("mock is used in development only when no endpoint / explicitly requested", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("INFERENCE_PROVIDER", "mock");
    const { getProvider } = await import("@/lib/inference");
    expect(getProvider().info.mock).toBe(true);
  });
  it("demo login is refused when NODE_ENV=production even if DEMO_LOGIN_ENABLED=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
    const { demoLoginEnabled } = await import("@/lib/config");
    expect(demoLoginEnabled()).toBe(false);
  });
  it("Stripe live keys are refused", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_" + "x".repeat(20));
    const { getStripe } = await import("@/lib/stripe");
    expect(getStripe()).toBeNull();
  });
  it("Max allowance = 2.5x Pro and configurable", async () => {
    vi.stubEnv("PRO_MONTHLY_UNITS", "400");
    const c = await import("@/lib/config");
    expect(c.planLimit("pro")).toBe(400);
    expect(c.planLimit("max")).toBe(1000);
    expect(c.planLimit("trial")).toBe(5);
  });
});

describe("OpenAI-compatible adapter against local stub", () => {
  it("streams tokens from INFERENCE_BASE_URL with bearer key", async () => {
    const { spawn } = await import("node:child_process");
    const p = spawn("node", ["scripts/stub-openai.mjs"], { env: { ...process.env, STUB_PORT: "8099", STUB_KEY: "stub-key" } });
    await new Promise((r) => p.stdout.once("data", r));
    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("INFERENCE_PROVIDER", "openai");
      vi.stubEnv("INFERENCE_BASE_URL", "http://127.0.0.1:8099/v1");
      vi.stubEnv("INFERENCE_MODEL", "citad3l-v1");
      vi.stubEnv("INFERENCE_API_KEY", "stub-key");
      const { getProvider } = await import("@/lib/inference");
      const prov = getProvider();
      expect(prov.info.mock).toBe(false);
      let out = "";
      for await (const t of prov.stream([{ role: "system", content: "s" }, { role: "user", content: "hi" }], new AbortController().signal)) out += t;
      expect(out).toContain("[stub] adapter OK for model=citad3l-v1");
      expect(out).toContain("system prompt present=true");
    } finally { p.kill(); }
  });
});
