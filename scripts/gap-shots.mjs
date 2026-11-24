// Local screenshots of Ghost-gap features (desktop 1280 light/dark, mobile 390).
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  try {
    const m = /^DATABASE_URL=(.*)$/m.exec(readFileSync(".env", "utf8"));
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  } catch { /* use default */ }
}

const BASE = process.env.CITAD3L_URL ?? "http://127.0.0.1:3213";
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });

const ownerEmail = (process.env.OWNER_EMAIL || "owner-shots@citad3l.local").trim().toLowerCase();
const paidEmail = `gap-max-${Date.now().toString(36)}@citad3l.local`;

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("citad3l-theme", t);
    const d = document.documentElement;
    d.dataset.theme = t;
    d.style.colorScheme = t === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0b0b0b" : "#ffffff");
  }, theme);
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  console.log("wrote", path);
}

async function visit(page, path, theme) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await setTheme(page, theme);
  await page.waitForTimeout(200);
}

async function openPicker(page) {
  const trigger = page.getByTestId("model-picker-trigger");
  await trigger.waitFor({ state: "visible" });
  const menu = page.locator('[data-testid="model-picker-menu"]');
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.evaluate((el) => el.click());
  }
  try {
    await menu.waitFor({ state: "attached", timeout: 4000 });
  } catch {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.evaluate((el) => el.click());
    }
    await menu.waitFor({ state: "attached", timeout: 8000 });
  }
  await page.waitForTimeout(200);
}

async function waitGreeting(page) {
  await page.waitForFunction(() => {
    const h = document.querySelector(".chat-greeting");
    if (!h) return false;
    const t = (h.textContent || "").trim();
    return t && !t.startsWith("Hello");
  }, { timeout: 8000 }).catch(() => {});
}

async function login(ctx, email) {
  const p = await ctx.newPage();
  await p.goto(BASE + "/login?next=/chat", { waitUntil: "networkidle" });
  const csrf = await (await p.request.get(BASE + "/api/auth/csrf")).json();
  const res = await p.request.post(BASE + "/api/auth/callback/demo", {
    form: { csrfToken: csrf.csrfToken, email, callbackUrl: BASE + "/chat" },
  });
  await p.close();
  if (!res.ok()) throw new Error(`demo login failed ${res.status()} ${await res.text()}`);
}

async function openPalette(page) {
  const meta = process.platform === "darwin";
  await page.keyboard.press(meta ? "Meta+K" : "Control+K");
  await page.waitForSelector('[data-testid="command-palette"]', { timeout: 8000 });
}

const views = [
  { tag: "1280-light", theme: "light", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false },
  { tag: "1280-dark", theme: "dark", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false },
  { tag: "390-light", theme: "light", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true },
];

// --- Public / guest surfaces ---
for (const v of views) {
  const ctx = await b.newContext({
    viewport: v.viewport,
    deviceScaleFactor: v.deviceScaleFactor,
    isMobile: v.isMobile,
    hasTouch: v.isMobile,
    colorScheme: v.theme === "dark" ? "dark" : "light",
  });
  const p = await ctx.newPage();

  await visit(p, "/pricing", v.theme);
  await p.waitForSelector("text=Free");
  await shot(p, `gap-pricing-${v.tag}`);

  await visit(p, "/connect", v.theme);
  await shot(p, `gap-connect-${v.tag}`);

  await visit(p, "/chat", v.theme);
  await p.waitForSelector("#citadel-composer");
  await waitGreeting(p);
  await shot(p, `gap-chat-guest-${v.tag}`);

  await openPicker(p);
  await shot(p, `gap-model-picker-${v.tag}`);
  await p.keyboard.press("Escape");

  await openPalette(p);
  await shot(p, `gap-command-palette-${v.tag}`);
  await p.keyboard.press("Escape");

  await ctx.close();
}

// --- Paid (Max) user: settings, usage, account pages ---
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://citad3l@127.0.0.1:5433/citad3l" });
await db.connect();

for (const v of views) {
  const ctx = await b.newContext({
    viewport: v.viewport,
    deviceScaleFactor: v.deviceScaleFactor,
    isMobile: v.isMobile,
    hasTouch: v.isMobile,
    colorScheme: v.theme === "dark" ? "dark" : "light",
  });
  await login(ctx, paidEmail);
  await db.query(`UPDATE "User" SET name='Jordan' WHERE email=$1`, [paidEmail]);
  const p = await ctx.newPage();
  await visit(p, "/chat", v.theme);
  await p.waitForSelector("#citadel-composer");
  const windowEnd = new Date(Date.now() + 5 * 3600 * 1000);
  const weekEnd = new Date(Date.now() + 7 * 864e5);
  const upd = await db.query(
    `UPDATE "Entitlement" e
       SET plan='max', status='active', "trialUsed"=0, reserved=0,
           "windowUsed"=3, "weekUsed"=12,
           "windowStart"=NOW(), "windowEnd"=$2,
           "weekStart"=NOW(), "weekEnd"=$3,
           "periodEnd"=$2
     FROM "User" u WHERE u.id=e."userId" AND u.email=$1`,
    [paidEmail, windowEnd, weekEnd],
  );
  if (!upd.rowCount) throw new Error("entitlement update matched 0 rows for " + paidEmail);
  await p.reload({ waitUntil: "networkidle" });
  await setTheme(p, v.theme);
  await p.waitForSelector("#citadel-composer");
  await waitGreeting(p);
  await shot(p, `gap-chat-max-${v.tag}`);

  await openPicker(p);
  const settingsBtn = p.getByRole("button", { name: /Model settings/ });
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await p.waitForTimeout(300);
    await shot(p, `gap-model-settings-${v.tag}`);
    await p.keyboard.press("Escape");
  }

  await visit(p, "/account", v.theme);
  await shot(p, `gap-account-profile-${v.tag}`);
  await visit(p, "/account/usage", v.theme);
  await shot(p, `gap-account-usage-${v.tag}`);
  await visit(p, "/account/billing", v.theme);
  await shot(p, `gap-account-billing-${v.tag}`);
  await visit(p, "/account/sessions", v.theme);
  await shot(p, `gap-account-sessions-${v.tag}`);
  await visit(p, "/account/referrals", v.theme);
  await shot(p, `gap-account-referrals-${v.tag}`);

  await ctx.close();
}

// --- Owner admin ---
for (const v of views) {
  const ctx = await b.newContext({
    viewport: v.viewport,
    deviceScaleFactor: v.deviceScaleFactor,
    isMobile: v.isMobile,
    hasTouch: v.isMobile,
    colorScheme: v.theme === "dark" ? "dark" : "light",
  });
  await login(ctx, ownerEmail);
  const p = await ctx.newPage();
  await visit(p, "/admin", v.theme);
  await p.waitForSelector("[data-testid=admin-dashboard]", { timeout: 15000 });
  await shot(p, `gap-admin-${v.tag}`);
  await ctx.close();
}

await db.end();
await b.close();
console.log("done");
