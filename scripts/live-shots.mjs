// Screenshots of the live Cloudflare deployment → evidence/screenshots/live/
import { chromium } from "playwright-core";
const BASE = process.env.LIVE_URL ?? "https://citad3l.example.workers.dev";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errs = [];
for (const theme of ["light", "dark"]) for (const [w, h, tag, mob] of [[1440, 900, "desktop", false], [390, 844, "phone", true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  await ctx.addInitScript((t) => localStorage.setItem("citad3l-theme", t), theme);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${theme}/${tag} ${p.url()} ${e.message}`));
  for (const [n, u] of [["home", "/"], ["pricing", "/pricing"], ["model", "/models/citad3l-v1"], ["login_from_chat", "/chat"]]) {
    await p.goto(BASE + u, { waitUntil: "load" }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `evidence/screenshots/live/${n}_${theme}_${tag}.png` });
  }
  await ctx.close();
}
await b.close();
console.log(JSON.stringify({ pageErrors: errs }));
