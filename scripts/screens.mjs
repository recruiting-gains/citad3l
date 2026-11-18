// Screenshots of the local build (desktop 1440 + phone 390). Usage: node scripts/screens.mjs [outDir] [prefix]
import { chromium } from "playwright-core";
import pg from "pg";
const BASE = process.env.CITAD3L_URL ?? "http://localhost:3210";
const out = process.argv[2] ?? "evidence/screenshots";
const pre = process.argv[3] ?? "";
const email = `review-${Date.now().toString(36)}@citad3l.local`;
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errs = [];
async function login(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE + "/login?next=/chat");
  const csrf = await (await p.request.get(BASE + "/api/auth/csrf")).json();
  await p.request.post(BASE + "/api/auth/callback/demo", { form: { csrfToken: csrf.csrfToken, email, callbackUrl: BASE + "/chat" } });
  await p.close();
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://citad3l@127.0.0.1:5433/citad3l" });
await db.connect();
for (const [w, h, tag, mob] of [[1440, 900, "desktop", false], [390, 844, "phone", true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  const shot = async (p, name, full = false) => { await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${pre}${name}_${tag}.png`, fullPage: full }); };
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${tag} PAGEERR ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errs.push(`${tag} console ${m.text()}`); });
  for (const [n, u] of [["home", "/"], ["pricing", "/pricing"], ["model", "/models/citad3l-v1"], ["models", "/models"], ["login", "/login"]]) {
    await p.goto(BASE + u, { waitUntil: "networkidle" });
    await shot(p, n); await shot(p, n + "_full", true);
  }
  await login(ctx);
  await p.goto(BASE + "/chat", { waitUntil: "networkidle" });
  await shot(p, "chat_empty");
  // create a project
  await p.request.post(BASE + "/api/projects", { data: { name: "AI security brief", instructions: "Act as a defensive security analyst. Be concise." } });
  await p.request.post(BASE + "/api/projects", { data: { name: "Robotics watch", instructions: "Track humanoid robotics progress." } });
  await p.goto(BASE + "/chat", { waitUntil: "networkidle" });
  const box = p.locator("textarea").first();
  await box.fill("Give me a 3-step plan to harden a home network against AI-assisted attacks.");
  await box.press("Enter");
  await p.waitForTimeout(700);
  await shot(p, "chat_streaming");
  await p.waitForTimeout(4000);
  await shot(p, "chat_answer");
  await p.goto(BASE + "/projects", { waitUntil: "networkidle" });
  await shot(p, "projects");
  await p.goto(BASE + "/account", { waitUntil: "networkidle" });
  await shot(p, "account");
  // limit reached state: exhaust trial for this user
  await db.query(`UPDATE "Entitlement" e SET "trialUsed"=5 FROM "User" u WHERE u.id=e."userId" AND u.email=$1`, [email]);
  await p.goto(BASE + "/chat", { waitUntil: "networkidle" });
  await p.locator("textarea").first().fill("One more question?").catch(() => {});
  await p.locator("textarea").first().press("Enter").catch(() => {});
  await p.waitForTimeout(1500);
  await shot(p, "limit_reached");
  await p.goto(BASE + "/account", { waitUntil: "networkidle" });
  await shot(p, "account_limit");
  await db.query(`UPDATE "Entitlement" e SET "trialUsed"=0 FROM "User" u WHERE u.id=e."userId" AND u.email=$1`, [email]);
  await ctx.close();
}
await db.end(); await b.close();
console.log(JSON.stringify({ email, errors: errs.slice(0, 30) }, null, 1));
