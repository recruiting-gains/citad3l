import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* 2026-11-27 (Karli): the Custom instructions help text had spliced into itself with raw "apos;" fragments. */
const root = new URL("..", import.meta.url).pathname;
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}
const files = [...walk(join(root, "app")), ...walk(join(root, "components"))];

describe("UI copy hygiene", () => {
  it("no broken HTML entities (bare apos; / amp; / quot;) in UI source", () => {
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      if (/(^|[^&])\b(apos|quot|amp);/m.test(s)) bad.push(f.replace(root, ""));
    }
    expect(bad).toEqual([]);
  });
  it("Custom instructions help text reads once, cleanly", () => {
    const s = readFileSync(join(root, "components/account/AccountPages.tsx"), "utf8");
    const line = "Tell Citad3L who you want it to be and how to help you. This is added to every chat on every model, so you don&apos;t have to paste it into each new chat. Site rules still come first.";
    expect(s).toContain(line);
    expect(s.split("added to every chat").length - 1).toBe(1);
    expect(s.split("Site rules still come first").length - 1).toBe(1);
  });
});
