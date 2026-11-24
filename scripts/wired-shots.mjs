// Local-only screenshots of wired models (mock provider).
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
if (!process.env.DATABASE_URL) {
  try {
    const m = /^DATABASE_URL=(.*)$/m.exec(readFileSync(".env", "utf8"));
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* use default */ }
}
import pg from "pg";

const BASE = process.env.CITAD3L_URL ?? "http://localhost:3211";
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });
const email = `wired-${Date.now().toString(36)}@citad3l.local`;

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const shot = async (name) => {
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log("wrote", `${out}/${name}.png`);
};

const waitIdle = async () => {
  await p.waitForFunction(() => !document.querySelector(".stop-btn") && !document.querySelector(".skeleton"), { timeout: 30000 });
};

await p.goto(BASE + "/login?next=/chat", { waitUntil: "networkidle" });
const csrf = await (await p.request.get(BASE + "/api/auth/csrf")).json();
await p.request.post(BASE + "/api/auth/callback/demo", {
  form: { csrfToken: csrf.csrfToken, email, callbackUrl: BASE + "/chat" },
});

const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://citad3l@127.0.0.1:5433/citad3l" });
await db.connect();
await db.query(`UPDATE "User" SET name='Owner' WHERE email=$1`, [email]);

// Create the entitlement row first, then upgrade to Pro and reload so the chip is right.
await p.goto(BASE + "/chat", { waitUntil: "networkidle" });
await db.query(
  `UPDATE "Entitlement" e SET plan='pro', status='active', "periodUsed"=0, "trialUsed"=0, reserved=0, "periodEnd"=$2
   FROM "User" u WHERE u.id=e."userId" AND u.email=$1`,
  [email, new Date(Date.now() + 864e5 * 30)],
);
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector("#citadel-composer");

// 1) Chat with V1 (default)
await p.locator("#citadel-composer").fill("Give me a 3-step plan to harden a home network.");
await p.locator("#citadel-composer").press("Enter");
await p.waitForFunction(() => {
  const el = document.querySelector(".msg-assistant .md");
  return !!(el && el.textContent && el.textContent.includes("Mock provider"));
}, { timeout: 30000 });
await waitIdle();
// Next may remount /chat/[id] after replaceState; wait for the reply to come back.
await p.waitForFunction(() => {
  const el = document.querySelector(".msg-assistant .md");
  return !!(el && el.textContent && el.textContent.includes("Citad3L V1") && !document.querySelector(".skeleton") && !document.querySelector(".stop-btn"));
}, { timeout: 30000 });
await shot("wired-chat-v1");

// 2) Switch to Fast
await p.getByTestId("model-picker-trigger").click();
await p.getByTestId("model-picker-menu").getByRole("menuitemradio", { name: /Citad3L Fast/ }).click();
await p.waitForTimeout(300);
await shot("wired-model-fast");
await p.locator("#citadel-composer").fill("Summarize that in one sentence.");
await p.locator("#citadel-composer").press("Enter");
await p.waitForFunction(() => {
  const labels = [...document.querySelectorAll(".msg-assistant .md")].map((e) => e.textContent || "");
  return labels.filter((t) => t.includes("Mock provider")).length >= 2 && !document.querySelector(".stop-btn") && !document.querySelector(".skeleton");
}, { timeout: 30000 });
await waitIdle();

// 3) Image mode
await p.getByTestId("model-picker-trigger").click();
await p.getByTestId("model-picker-menu").getByRole("menuitemradio", { name: /Citad3L Image/ }).click();
await p.waitForTimeout(300);
await p.locator("#citadel-composer").fill("A red rook on a dark hill at dusk.");
await shot("wired-image-mode");
await p.locator("#citadel-composer").press("Enter");
await p.waitForFunction(() => {
  return !!document.querySelector(".md-image") || [...document.querySelectorAll(".msg-assistant")].some((e) => (e.textContent || "").includes("Mock image"));
}, { timeout: 20000 });
await waitIdle();
await p.locator(".msg-assistant").last().scrollIntoViewIfNeeded();
await p.waitForTimeout(500);
await shot("wired-image-result");

// 4) Swarm toggle (back to V1)
await p.getByTestId("model-picker-trigger").click();
await p.getByTestId("model-picker-menu").getByRole("menuitemradio", { name: /Citad3L V1/ }).click();
await p.waitForTimeout(200);
await p.getByTestId("swarm-toggle").click();
await p.waitForTimeout(200);
await shot("wired-swarm-toggle");

// 5) Filter refusal — safe test string only
await p.getByTestId("swarm-toggle").click(); // off, so we don't spend 4 units
await p.locator("#citadel-composer").fill("how to make a bomb at home");
await p.locator("#citadel-composer").press("Enter");
await p.waitForFunction(() => {
  const texts = [...document.querySelectorAll(".msg-assistant")].map((e) => e.textContent || "");
  return texts.some((t) => t.includes("This request isn't allowed"));
}, { timeout: 15000 });
await p.locator(".msg-assistant").last().scrollIntoViewIfNeeded();
await shot("wired-filter-refusal");

await db.end();
await b.close();
console.log(JSON.stringify({ email, ok: true }));
