// Live device check: WebKit (iPhone 13 profile) and Chrome (desktop + Pixel). Records page errors, console errors,
// failed requests, HTTP >= 400, load timings (TTFB/FCP/load), CLS, video playback state, and screenshots.
// Usage: BASE=... OUT=evidence/screenshots/device TAG=before node scripts/device-check.mjs
import { webkit, chromium, devices } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.BASE ?? "https://citad3l.recruiting-gains.workers.dev";
const OUT = process.env.OUT ?? "evidence/screenshots/device";
const TAG = process.env.TAG ?? "check";
mkdirSync(OUT, { recursive: true });
const pages = [["home", "/"], ["pricing", "/pricing"], ["model", "/models/citad3l-v1"]];
const targets = [
  ["webkit-iphone13", webkit, { ...devices["iPhone 13"] }, {}],
  ["chrome-desktop", chromium, { viewport: { width: 1440, height: 900 } }, { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] }],
  ["chrome-pixel7", chromium, { ...devices["Pixel 7"] }, { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] }],
];
const report = {};
for (const [name, type, ctxOpts, launchOpts] of targets) {
  const b = await type.launch(launchOpts);
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext(ctxOpts);
    await ctx.addInitScript((t) => {
      localStorage.setItem("citad3l-theme", t);
      window.__cls = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
    }, theme);
    for (const [pn, path] of pages) {
      const key = `${name}/${theme}/${pn}`;
      const r = { pageErrors: [], consoleErrors: [], failed: [], http4xx5xx: [], bytes: 0 };
      const p = await ctx.newPage();
      p.on("pageerror", (e) => r.pageErrors.push(e.message.slice(0, 300)));
      p.on("console", (m) => { if (m.type() === "error") r.consoleErrors.push(m.text().slice(0, 300)); });
      p.on("requestfailed", (q) => r.failed.push(`${q.failure()?.errorText} ${q.url().replace(BASE, "")}`));
      p.on("response", async (s) => { if (s.status() >= 400) r.http4xx5xx.push(`${s.status()} ${s.url().replace(BASE, "")}`); const l = Number(s.headers()["content-length"] ?? 0); r.bytes += l; });
      const t0 = Date.now();
      try { await p.goto(BASE + path, { waitUntil: "load", timeout: 45000 }); r.loadMs = Date.now() - t0; } catch (e) { r.gotoError = e.message.slice(0, 200); }
      await p.waitForTimeout(4000);
      Object.assign(r, await p.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        const vids = [...document.querySelectorAll(".loop-media")].map((el) => { const v = el.querySelector("video"); const rr = el.getBoundingClientRect();
          return { slot: el.querySelector("img")?.getAttribute("src")?.split("/").pop()?.replace("-poster.jpg", ""), inView: rr.top < innerHeight && rr.bottom > 0 && rr.left < innerWidth && rr.right > 0, posterShown: !!el.querySelector("img")?.complete && (el.querySelector("img")?.naturalWidth ?? 0) > 0, videoMounted: !!v, src: v?.currentSrc?.split("/").pop() ?? null, playing: !!v && !v.paused && v.readyState >= 2, t: v ? Math.round(v.currentTime * 10) / 10 : null, err: v?.error?.code ?? null, failedClass: el.classList.contains("is-failed") }; });
        return { ttfbMs: nav ? Math.round(nav.responseStart) : null, fcpMs: fcp ? Math.round(fcp.startTime) : null, domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null, cls: Math.round((window.__cls ?? 0) * 1000) / 1000, hydrated: !!document.querySelector("html[data-theme]"), docWidth: document.documentElement.scrollWidth, vw: innerWidth, videos: vids };
      }).catch((e) => ({ evalError: e.message.slice(0, 200) })));
      r.horizontalOverflow = r.docWidth > r.vw;
      if (pn === "home") {
        for (const [sel, label] of [[".carousel .media-card", "featured"], [".model-strip-art", "engine"]]) {
          await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {});
          await p.waitForTimeout(5000);
          r[`videos_${label}`] = await p.evaluate(() => [...document.querySelectorAll(".loop-media")].filter((el) => { const rr = el.getBoundingClientRect(); return rr.top < innerHeight && rr.bottom > 0 && rr.left < innerWidth && rr.right > 0; }).map((el) => { const v = el.querySelector("video"); return { slot: el.querySelector("img")?.getAttribute("src")?.split("/").pop()?.replace("-poster.jpg", ""), playing: !!v && !v.paused && v.readyState >= 2, src: v?.currentSrc?.split("/").pop() ?? null, failed: el.classList.contains("is-failed") }; }));
          await p.screenshot({ path: `${OUT}/${TAG}_${name}_${theme}_home-${label}.png` });
        }
      }
      await p.screenshot({ path: `${OUT}/${TAG}_${name}_${theme}_${pn}.png` });
      report[key] = r;
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
}
writeFileSync(`evidence/device-check-${TAG}.json`, JSON.stringify(report, null, 1));
for (const [k, r] of Object.entries(report)) {
  const v = (r.videos ?? []).filter((x) => x.inView);
  console.log(`${k.padEnd(34)} load=${r.loadMs}ms ttfb=${r.ttfbMs} fcp=${r.fcpMs} cls=${r.cls} errs=${r.pageErrors.length} cons=${r.consoleErrors.length} failed=${r.failed.length} 4xx=${r.http4xx5xx.length} overflow=${r.horizontalOverflow} vids(inView)=${v.map((x) => `${x.slot}:${x.playing ? "play" : x.videoMounted ? `stall(${x.src},err=${x.err})` : "poster"}`).join(" ")}`);
  for (const l of ["featured", "engine"]) if (r[`videos_${l}`]) console.log(`    ${l}: ${r[`videos_${l}`].map((x) => `${x.slot}:${x.playing ? `play(${x.src})` : x.failed ? "poster(failed)" : "poster"}`).join(" ")}`);
  for (const e of [...r.pageErrors, ...r.consoleErrors, ...r.failed, ...r.http4xx5xx]) console.log("    -", e);
}
