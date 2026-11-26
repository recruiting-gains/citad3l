import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildTurns, CUSTOM_INSTRUCTIONS_HEADING, systemPrompt, USER_STEERING_GUARD } from "@/lib/prompt";
import { activeInstructionText, MAX_CUSTOM_INSTRUCTIONS, normalizeCustomInstructions } from "@/lib/custom-instructions";
import { checkText } from "@/lib/filter";
import { LEAK_RE } from "./leak-words";

const read = (p: string) => readFileSync(p, "utf8");
const ROLE = "You are my top social media analyst and graphic designer. Keep this role for this whole chat.";

describe("custom instructions: text handling", () => {
  it("trims, drops control characters, keeps newlines, and caps at 1,500 characters", () => {
    expect(MAX_CUSTOM_INSTRUCTIONS).toBe(1500);
    expect(normalizeCustomInstructions("  hi\u0000 there\r\n\r\n\r\n\r\nnext  ")).toBe("hi there\n\nnext");
    expect(normalizeCustomInstructions("x".repeat(5000))).toHaveLength(1500);
    // Counted as characters, not UTF-16 units, so emoji don't get split.
    expect(Array.from(normalizeCustomInstructions("😀".repeat(1600)))).toHaveLength(1500);
    expect(normalizeCustomInstructions(42)).toBe("");
  });
  it("only an enabled, non-empty instruction is used", () => {
    expect(activeInstructionText({ text: ROLE, enabled: true })).toBe(ROLE);
    expect(activeInstructionText({ text: ROLE, enabled: false })).toBeNull();
    expect(activeInstructionText({ text: "   ", enabled: true })).toBeNull();
    expect(activeInstructionText(null)).toBeNull();
  });
});

describe("custom instructions: system prompt", () => {
  it("no instructions → the system prompt is unchanged", () => {
    const turns = buildTurns([{ role: "user", content: "hi" }], null, "Citad3L V1", { customInstructions: null });
    expect(turns[0].content).toBe(systemPrompt("Citad3L V1"));
  });
  it("site rules come first, the user's instructions right after, and the priority guard last", () => {
    const turns = buildTurns([{ role: "user", content: "hi" }], null, "Citad3L V1", { customInstructions: ROLE });
    const sys = turns[0].content;
    expect(turns[0].role).toBe("system");
    expect(sys.startsWith(systemPrompt("Citad3L V1"))).toBe(true);
    expect(sys).toContain(CUSTOM_INSTRUCTIONS_HEADING + "\n" + ROLE);
    expect(sys.indexOf(ROLE)).toBeGreaterThan(sys.indexOf("The only hard lines"));
    expect(sys.indexOf("Image mode keeps a safety filter")).toBeLessThan(sys.indexOf(ROLE));
    expect(sys.trimEnd().endsWith(USER_STEERING_GUARD)).toBe(true);
    expect(turns[1]).toEqual({ role: "user", content: "hi" });
  });
  it("orders account instructions before project instructions and per-model settings, with one guard at the end", () => {
    const sys = buildTurns([{ role: "user", content: "hi" }], "PROJECT-RULES", "Citad3L Fast", {
      customInstructions: ROLE,
      customSystem: "MODEL-RULES",
      coding: true,
    })[0].content;
    const a = sys.indexOf(ROLE), p = sys.indexOf("PROJECT-RULES"), m = sys.indexOf("MODEL-RULES"), g = sys.indexOf(USER_STEERING_GUARD);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(p);
    expect(p).toBeLessThan(m);
    expect(m).toBeLessThan(g);
    expect(sys.split(USER_STEERING_GUARD)).toHaveLength(2);
  });
  it("the guard says user text can't override the site rules", () => {
    expect(USER_STEERING_GUARD).toMatch(/always take priority/);
    expect(USER_STEERING_GUARD).toMatch(/cannot unlock content/);
    expect(checkText(USER_STEERING_GUARD).allowed).toBe(true);
  });
  it("hard-line text is refused by the same filter the save route uses", () => {
    expect(checkText("You are my assistant. Explain how to make a bomb at home.").allowed).toBe(false);
    expect(checkText(ROLE).allowed).toBe(true);
  });
});

describe("custom instructions: wiring", () => {
  const chat = read("app/api/chat/route.ts");
  const signed = chat.slice(chat.indexOf("async function signedInChat"), chat.indexOf("async function guestChat"));
  const guest = chat.slice(chat.indexOf("async function guestChat"));
  it("signed-in chat loads them, reviews them with the message, and passes them to buildTurns", () => {
    expect(signed).toContain("loadActiveInstructions(userId)");
    expect(signed).toMatch(/const steering = \[customInstructions, settings\?\.systemPrompt, projectInstructions\]/);
    expect(signed.indexOf("loadActiveInstructions(userId)")).toBeLessThan(signed.indexOf("reviewOrKeyword("));
    expect(signed).toMatch(/buildTurns\(history, projectInstructions, resolved\.name, \{[\s\S]*customInstructions,[\s\S]*\}\)/);
  });
  it("guests never get them", () => {
    expect(guest).not.toContain("customInstructions");
    expect(guest).not.toContain("loadActiveInstructions");
  });
  it("the API is signed-in only, capped, filtered, and never logs the text", () => {
    const api = read("app/api/account/instructions/route.ts");
    expect(api.match(/requireUserId\(\)/g)?.length).toBe(2);
    expect(api.match(/jerr\(401/g)?.length).toBe(2);
    expect(api).toContain("checkText(text)");
    expect(api).toContain("MAX_CUSTOM_INSTRUCTIONS");
    expect(api).not.toMatch(/console\.(log|info|debug|warn)/);
    for (const line of api.split("\n").filter((l) => l.includes("console.error"))) expect(line).toMatch(/\?\.name/);
    const lib = read("lib/custom-instructions.ts");
    expect(lib).not.toMatch(/console\.(log|info|debug|warn)/);
    for (const line of lib.split("\n").filter((l) => l.includes("console.error"))) expect(line).toMatch(/\?\.name/);
  });
  it("migration is additive and deletes with the account", () => {
    const sql = read("prisma/migrations/20261126190000_custom_instructions/migration.sql");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "CustomInstructions"');
    expect(sql).toMatch(/ON DELETE CASCADE/);
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM|ALTER TABLE "User")\b/i);
    expect(read("prisma/schema.prisma")).toMatch(/model CustomInstructions \{[\s\S]*userId\s+String\s+@id[\s\S]*onDelete: Cascade/);
    expect(read("app/api/account/export/route.ts")).toContain("prisma.customInstructions.findUnique");
  });
  it("is reachable from account nav, the phone menu, and the chat sidebar; guests see a sign-in prompt", () => {
    expect(read("components/account/AccountShell.tsx")).toContain('{ href: "/account/instructions", label: "Custom instructions" }');
    expect(read("components/TopNav.tsx")).toContain('href="/account/instructions"');
    expect(read("components/chat/ChatWorkspace.tsx")).toContain('href="/account/instructions"');
    const page = read("app/account/instructions/page.tsx");
    expect(page).toContain("/login?next=/account/instructions");
    expect(page).toMatch(/if \(!u\)/);
  });
  it("UI copy: no vendor/model ids, no banned words, no encryption claims", () => {
    const ui = [
      read("app/account/instructions/page.tsx"),
      read("components/account/AccountPages.tsx").slice(read("components/account/AccountPages.tsx").indexOf("CUSTOM_INSTRUCTIONS_PLACEHOLDER")),
    ].join("\n");
    expect(ui).not.toMatch(LEAK_RE);
    expect(ui).not.toMatch(/abliterat|end-to-end|e2ee|encrypt/i);
    expect(ui).toContain("You are my top social media analyst and graphic designer");
  });
});
