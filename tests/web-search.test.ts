import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { availableSkills, resolveSkills } from "@/lib/skills";
import { getPublicModel } from "@/lib/models";

/* 2026-11-19 6:47 PM CT: "Web search won't turn on" in the model picker. */
describe("model picker skills follow the selected model, not the hovered row", () => {
  const src = readFileSync(new URL("../components/chat/ModelPicker.tsx", import.meta.url), "utf8");
  it("avail and the hint come from `selected`; the list clears hover on leave", () => {
    expect(src).toContain("const avail = availableSkills(selected);");
    expect(src).not.toMatch(/availableSkills\(preview\)/);
    expect(src).toMatch(/className="mp-list" role="menu" onMouseLeave=\{\(\) => setHovered\(null\)\}/);
    expect(src).toMatch(/const skillHint = !selected/);
    expect(src).not.toMatch(/preview\.requiresClientE2EE \|\| preview\.comingSoon/);
  });
  it("V1 and Fast offer Web search; Private/Image/Video don't (so hovering them used to disable the toggle)", () => {
    expect(availableSkills(getPublicModel("citad3l-v1")).webSearch).toBe(true);
    expect(availableSkills(getPublicModel("citad3l-fast")).webSearch).toBe(true);
    for (const id of ["citad3l-private", "citad3l-image", "citad3l-video"]) expect(availableSkills(getPublicModel(id)).webSearch, id).toBe(false);
  });
  it("server keeps Web search for signed-in V1/Fast, drops it for guests and Swarm", () => {
    for (const id of ["citad3l-v1", "citad3l-fast"]) {
      expect(resolveSkills(getPublicModel(id), { webSearch: true }).webSearch, id).toBe(true);
      expect(resolveSkills(getPublicModel(id), { webSearch: true }, { guest: true }).webSearch, id).toBe(false);
      expect(resolveSkills(getPublicModel(id), { webSearch: true }, { swarm: true }).webSearch, id).toBe(false);
    }
  });
});

describe("Web search reaches the provider as web_search=on", () => {
  it("V1 and Fast requests carry provider_parameters.web_search only when asked", async () => {
    const saved = { key: process.env.PROVIDER_API_KEY, prov: process.env.INFERENCE_PROVIDER };
    process.env.PROVIDER_API_KEY = "test-key-not-real";
    delete process.env.INFERENCE_PROVIDER;
    const bodies: any[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_u: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      const sse = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
      return new Response(sse, { headers: { "content-type": "text/event-stream" } });
    }) as any;
    try {
      const { getProvider } = await import("@/lib/inference");
      for (const [modelId, webSearch] of [["citad3l-v1", true], ["citad3l-fast", true], ["citad3l-v1", false]] as const) {
        let t = "";
        for await (const x of getProvider({ modelId, webSearch }).stream([{ role: "user", content: "hi" }] as any, new AbortController().signal)) t += x;
        expect(t).toBe("ok");
      }
    } finally {
      globalThis.fetch = orig;
      if (saved.key === undefined) delete process.env.PROVIDER_API_KEY; else process.env.PROVIDER_API_KEY = saved.key;
      if (saved.prov === undefined) delete process.env.INFERENCE_PROVIDER; else process.env.INFERENCE_PROVIDER = saved.prov;
    }
    expect(bodies[0]).toMatchObject({ model: "test-v1-model", provider_parameters: { web_search: "on" } });
    expect(bodies[1]).toMatchObject({ model: "test-fast-model", provider_parameters: { web_search: "on" } });
    expect(bodies[2].provider_parameters.web_search).toBeUndefined();
  });
  it("chat route passes the resolved skill to the provider", () => {
    const route = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
    expect(route).toMatch(/const swarmWebSearch = swarm && canUseSwarmWebSearch\(await userEmail\(userId\)\);/);
    expect(route).toMatch(/const skills = resolveSkills\(pub, body\.skills, \{ swarm, swarmWebSearch \}\);/);
    expect(route).toMatch(/webSearch: swarmWebSearch,/);
    expect(route).toMatch(/webSearch: skills\.webSearch,/);
  });
});

describe("Swarm web search is allowlisted, not site-wide", () => {
  it("allows only emails listed in SWARM_WEB_SEARCH_EMAILS (case-insensitive, trimmed)", async () => {
    const saved = process.env.SWARM_WEB_SEARCH_EMAILS;
    const { canUseSwarmWebSearch, swarmWebSearchEmails } = await import("@/lib/config");
    try {
      delete process.env.SWARM_WEB_SEARCH_EMAILS;
      expect(swarmWebSearchEmails()).toEqual([]);
      expect(canUseSwarmWebSearch("media@example.test")).toBe(false);
      expect(canUseSwarmWebSearch(null)).toBe(false);

      process.env.SWARM_WEB_SEARCH_EMAILS = " media@example.test , other@example.test ";
      expect(canUseSwarmWebSearch("media@example.test")).toBe(true);
      expect(canUseSwarmWebSearch("Media@Example.Test")).toBe(true);
      expect(canUseSwarmWebSearch("cruz@example.test")).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.SWARM_WEB_SEARCH_EMAILS;
      else process.env.SWARM_WEB_SEARCH_EMAILS = saved;
    }
  });

  it("turns Swarm web search on only when the allowlist flag is set, and never for guests", () => {
    const v1 = getPublicModel("citad3l-v1");
    expect(resolveSkills(v1, { webSearch: true }, { swarm: true }).webSearch).toBe(false);
    expect(resolveSkills(v1, {}, { swarm: true, swarmWebSearch: true }).webSearch).toBe(true);
    expect(resolveSkills(v1, { thinking: true }, { swarm: true, swarmWebSearch: true }).thinking).toBe(false);
    expect(resolveSkills(v1, {}, { guest: true, swarm: true, swarmWebSearch: true }).webSearch).toBe(false);
  });

  it("runSwarm keeps planning offline and only enables search on workers/synthesis when asked", () => {
    const src = readFileSync(new URL("../lib/inference/swarm.ts", import.meta.url), "utf8");
    expect(src).toMatch(/webSearch\?: boolean;/);
    expect(src).toMatch(/const useSearch = opts\.webSearch === true;/);
    expect(src).toMatch(/getProvider\(\{ modelId: "citad3l-v1", maxTokens: SWARM_PLAN_TOKENS, temperature: 0\.3, thinking: false, webSearch: false \}\)/);
    expect(src).toMatch(/getProvider\(\{ modelId: "citad3l-v1", maxTokens: SWARM_SYNTH_TOKENS, thinking: false, webSearch: useSearch \}\)/);
    expect(src).toMatch(/getProvider\(\{ modelId: "citad3l-fast", maxTokens: SWARM_WORKER_TOKENS, thinking: false, webSearch: useSearch \}\)/);
  });

  it("does not add the Media bot or any email to the admin/owner allowlists", () => {
    const cfg = readFileSync(new URL("../lib/config.ts", import.meta.url), "utf8");
    expect(cfg).toMatch(/process\.env\.SWARM_WEB_SEARCH_EMAILS/);
    expect(cfg).not.toMatch(/adminEmails\(\)\.concat|\.\.\.swarmWebSearchEmails/);
  });
});
