// Records a short demo of the live homepage → evidence/live_demo.mp4 (via ffmpeg). Also checks the H.264 MP4 path plays.
import { chromium } from "playwright-core";
import { readdirSync, renameSync, mkdirSync } from "node:fs";
const BASE = process.env.BASE ?? "https://citad3l.recruiting-gains.workers.dev";
mkdirSync("/tmp/demo", { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: "/tmp/demo", size: { width: 1440, height: 900 } } });
await ctx.addInitScript(() => localStorage.setItem("citad3l-theme", "light"));
const p = await ctx.newPage();
await p.goto(BASE + "/", { waitUntil: "load" });
await p.waitForTimeout(2500);
const smooth = async (to, ms) => { await p.evaluate(([to, ms]) => new Promise((r) => { const s = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, s + (to - s) * (0.5 - Math.cos(Math.PI * k) / 2)); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [to, ms]); };
await smooth(520, 1800); await p.waitForTimeout(3500);
await p.hover(".media-card >> nth=1"); await p.waitForTimeout(1500);
await smooth(1250, 1800); await p.waitForTimeout(4000);
await p.click('button[aria-label*="theme" i], button[aria-label*="dark" i]').catch(() => {});
await p.waitForTimeout(3000);
await smooth(450, 1800); await p.waitForTimeout(3000);
// H.264 path check
const mp4 = await p.evaluate(async () => { const v = document.createElement("video"); v.muted = true; v.src = "/media/ai.mp4"; document.body.appendChild(v); try { await v.play(); await new Promise((r) => setTimeout(r, 1200)); return { canPlay: v.canPlayType("video/mp4; codecs=avc1.640028"), playing: !v.paused, t: v.currentTime, w: v.videoWidth }; } catch (e) { return { error: String(e) }; } finally { v.remove(); } });
console.log(JSON.stringify({ mp4 }));
await ctx.close(); await b.close();
const f = readdirSync("/tmp/demo").filter((x) => x.endsWith(".webm")).map((x) => "/tmp/demo/" + x).pop();
renameSync(f, "/tmp/demo/raw.webm");
