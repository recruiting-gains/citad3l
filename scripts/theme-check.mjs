// Theme checks + dark screenshots. Output: evidence/theme-check.txt, evidence/screenshots/dark/*
import { chromium } from "playwright-core";
import fs from "node:fs";
import pg from "pg";
const BASE = process.env.CITAD3L_URL ?? "http://localhost:3210";
const out = []; let fails = 0;
const check = (n, ok, x = "") => { out.push(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); if (!ok) fails++; };
fs.mkdirSync("evidence/screenshots/dark", { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errs = [];
// 1) OS preference respected on first visit, before hydration (no flash)
{
  const ctx = await b.newContext({ colorScheme: "dark" });
  const p = await ctx.newPage();
  await p.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { window.__themeAtDCL = document.documentElement.dataset.theme; window.__bgAtDCL = getComputedStyle(document.body).backgroundColor; }); });
  await p.goto(BASE + "/", { waitUntil: "load" });
  const r = await p.evaluate(() => ({ dcl: window.__themeAtDCL, bg: window.__bgAtDCL, ls: localStorage.getItem("citad3l-theme") }));
  check("first visit with OS dark → data-theme=dark already at DOMContentLoaded (pre-hydration, no flash)", r.dcl === "dark", JSON.stringify(r));
  check("body background is dark at DOMContentLoaded", /rgb\((1[0-9]|[0-9]), /.test(r.bg), r.bg);
  await ctx.close();
}
{
  const ctx = await b.newContext({ colorScheme: "light" });
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "load" });
  check("first visit with OS light → light", (await p.evaluate(() => document.documentElement.dataset.theme)) === "light");
  // 2) toggle persists
  const t = p.locator(".nav .theme-toggle").first();
  await t.click(); await p.waitForTimeout(400);
  const after = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, ls: localStorage.getItem("citad3l-theme"), meta: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") }));
  check("nav toggle switches to dark and stores preference", after.theme === "dark" && after.ls === "dark", JSON.stringify(after));
  await p.goto(BASE + "/pricing", { waitUntil: "load" });
  check("preference persists across navigation/reload", (await p.evaluate(() => document.documentElement.dataset.theme)) === "dark");
  await t.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  check("toggle works from keyboard (Enter) back to light", (await p.evaluate(() => document.documentElement.dataset.theme)) === "light");
  await ctx.close();
}
// 3) dark screenshots (home, chat, pricing + model/account) desktop + phone
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const email = `dark-${Date.now().toString(36)}@citad3l.local`;
for (const [w, h, tag, mob] of [[1440, 900, "desktop", false], [390, 844, "phone", true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  await ctx.addInitScript(() => localStorage.setItem("citad3l-theme", "dark"));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${tag} ${p.url()} ${e.message}`));
  const visit = async (u) => { for (let i = 0; i < 3; i++) { const n = errs.length; await p.goto(BASE + u, { waitUntil: "load" }); await p.waitForTimeout(1200); if (errs.length === n) return; } };
  const shot = (n, full = false) => p.screenshot({ path: `evidence/screenshots/dark/${n}_${tag}.png`, fullPage: full });
  for (const [n, u] of [["home", "/"], ["pricing", "/pricing"], ["model", "/models/citad3l-v1"]]) { await visit(u); await shot(n); if (n !== "model") await shot(n + "_full", true); }
  const csrf = await (await p.request.get(BASE + "/api/auth/csrf")).json();
  await p.request.post(BASE + "/api/auth/callback/demo", { form: { csrfToken: csrf.csrfToken, email, callbackUrl: BASE + "/chat" } });
  await db.query(`UPDATE "User" SET name='Cruz' WHERE email=$1`, [email]);
  await visit("/chat"); await shot("chat_empty");
  await p.locator("textarea").first().fill("Give me a 3-step plan to harden a home network against AI-assisted attacks.");
  await p.locator("textarea").first().press("Enter");
  await p.waitForTimeout(5000); await shot("chat_answer");
  await visit("/account"); await shot("account");
  await ctx.close();
}
await db.end(); await b.close();
check("no uncaught page errors during dark screenshots", errs.length === 0, errs.slice(0, 5).join(" | "));
out.push(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${new Date().toISOString()})`);
fs.writeFileSync("evidence/theme-check.txt", out.join("\n") + "\n");
console.log(out.join("\n"));
