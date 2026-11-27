import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldNoIndex } from "@/security/edge.mjs";

describe("noindex for auth-only routes", () => {
  it("keeps public pages indexable, including the bare paths that used to slip through", () => {
    for (const path of ["/", "/pricing", "/privacy", "/about", "/contact", "/faq", "/models", "/models/citad3l-v1", "/terms"]) {
      expect(shouldNoIndex(path), path).toBe(false);
    }
    for (const path of ["/chat", "/chat/", "/chat/abc", "/account", "/account/billing", "/projects", "/projects/", "/login", "/login/", "/admin", "/admin/x", "/api/chat", "/media/hero.mp4"]) {
      expect(shouldNoIndex(path), path).toBe(true);
    }
  });

  it("robots.txt is one rule block and disallows bare /chat", () => {
    const txt = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8").trim();
    expect(txt).not.toMatch(/\n\s*\n/);
    expect(txt.startsWith("User-agent: *")).toBe(true);
    expect(txt).toContain("Disallow: /chat");
    expect(txt).not.toContain("Disallow: /chat/");
    expect(txt).toContain("Disallow: /account");
    expect(txt).toContain("Disallow: /projects");
    expect(txt).toContain("Disallow: /login");
    expect(txt).toContain("Allow: /");
  });

  it("the worker and Next headers use the same auth-only paths", () => {
    const worker = readFileSync(new URL("../custom-worker.js", import.meta.url), "utf8");
    const next = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(worker).toContain("shouldNoIndex");
    for (const path of ["/chat", "/account", "/projects", "/login"]) {
      expect(next).toContain(`source: "${path}"`);
    }
    expect(readFileSync(new URL("../app/chat/layout.tsx", import.meta.url), "utf8")).toMatch(/index: false/);
    expect(readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8")).toMatch(/index: false/);
  });
});
