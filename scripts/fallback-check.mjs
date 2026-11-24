// WebKit iPhone 13: (a) all /media/*.mp4|webm requests blocked → posters must remain, no page errors;
// (b) reduced motion → posters only.
import { webkit, devices } from "playwright-core";
const BASE = process.env.BASE ?? "https://citad3l.example.workers.dev";
const b = await webkit.launch();
const out = {};
for (const mode of ["blocked-video", "reduced-motion"]) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference" });
  if (mode === "blocked-video") await ctx.route(/\/media\/.*\.(mp4|webm)/, (r) => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/models/citad3l-v1", { waitUntil: "load" });
  await p.waitForTimeout(12000);
  out[mode] = { pageErrors: errs, ...(await p.evaluate(() => { const el = document.querySelector(".loop-media"); const img = el.querySelector("img"); return { posterVisible: img.complete && img.naturalWidth > 0 && getComputedStyle(img).visibility !== "hidden", videoMounted: !!el.querySelector("video"), failedClass: el.classList.contains("is-failed") }; })) };
  await p.screenshot({ path: `evidence/screenshots/device/fallback_${mode}_webkit-iphone13_model.png` });
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out));
