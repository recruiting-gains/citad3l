// Screenshots with cinematic media playing. BASE (default local dev) and OUT dir via env.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3210";
const OUT = process.env.OUT ?? "evidence/screenshots/media";
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const report = { pageErrors: [], media: {} };
const pages = (process.env.PAGES ?? "home:/,engine:/#engine,models:/models,model:/models/citad3l-v1,pricing:/pricing").split(",").map((s) => s.split(/:(.+)/));
for (const theme of ["light", "dark"]) for (const [w, h, tag, mob] of [[1440, 900, "desktop", false], [390, 844, "phone", true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  await ctx.addInitScript((t) => localStorage.setItem("citad3l-theme", t), theme);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => report.pageErrors.push(`${theme}/${tag} ${p.url()} ${e.message}`));
  for (const [n, u] of pages) {
    await p.goto(BASE + u.replace("#engine", ""), { waitUntil: "load" });
    if (u.includes("#engine")) { await p.locator(".model-strip-art").scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -120)); }
    else if (n === "home") { await p.evaluate(() => scrollTo(0, 0)); }
    await p.waitForTimeout(800);
    await p.waitForFunction(() => { const vs = [...document.querySelectorAll(".loop-media")].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }); return vs.every((el) => el.querySelector("video.is-playing")); }, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const st = await p.evaluate(() => [...document.querySelectorAll(".loop-media")].map((el) => { const v = el.querySelector("video"); return { label: el.getAttribute("aria-label")?.slice(0, 30), mounted: !!v, playing: !!v && !v.paused, src: v?.currentSrc?.split("/").pop() ?? null }; }));
    report.media[`${n}_${theme}_${tag}`] = st;
    await p.screenshot({ path: `${OUT}/${n}_${theme}_${tag}.png` });
  }
  await ctx.close();
}
// reduced motion check
const rctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const rp = await rctx.newPage(); await rp.goto(BASE + "/", { waitUntil: "load" }); await rp.waitForTimeout(2500);
report.reducedMotion = await rp.evaluate(() => ({ cards: document.querySelectorAll(".loop-media").length, videosMounted: document.querySelectorAll(".loop-media video").length, postersLoaded: [...document.querySelectorAll(".loop-media img")].filter((i) => i.complete && i.naturalWidth > 0).length }));
await rp.screenshot({ path: `${OUT}/home_reduced-motion_desktop.png` });
await b.close();
console.log(JSON.stringify(report, null, 1));
