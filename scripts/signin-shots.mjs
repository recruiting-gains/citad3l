// Local screenshots of the email OTP login steps.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.CITAD3L_URL ?? "http://127.0.0.1:3210";
const out = process.argv[2] ?? "shots";
mkdirSync(out, { recursive: true });

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });

async function prepare(page, { hideDemo = true } = {}) {
  if (!hideDemo) return;
  await page.evaluate(() => {
    document.querySelectorAll(".demo-box").forEach((el) => {
      const prev = el.previousElementSibling;
      if (prev && prev.classList.contains("auth-divider")) prev.remove();
      el.remove();
    });
  });
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("citad3l-theme", t);
    const d = document.documentElement;
    d.dataset.theme = t;
    d.style.colorScheme = t;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#0b0b0b" : "#ffffff");
  }, theme);
}

async function shot(page, name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("wrote", `${out}/${name}.png`);
}

// Desktop light — email step
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.waitForSelector("#login-email");
  await setTheme(p, "light");
  await prepare(p);
  await p.locator("#login-email").fill("jordan@example.com");
  await shot(p, "signin-email");

  const [res] = await Promise.all([
    p.waitForResponse((r) => r.url().includes("/api/auth/request-code") && r.request().method() === "POST"),
    p.getByRole("button", { name: /email me a code/i }).click(),
  ]);
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`request-code failed ${res.status()} ${body}`);
  }
  await p.waitForSelector("#login-code");
  await prepare(p);
  await shot(p, "signin-code");
  await ctx.close();
}

// Desktop dark — both steps (navigate back + reuse a new session for email, then code)
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.waitForSelector("#login-email");
  await setTheme(p, "dark");
  await prepare(p);
  await p.locator("#login-email").fill("alex@example.com");
  await shot(p, "signin-email-dark");
  const [res] = await Promise.all([
    p.waitForResponse((r) => r.url().includes("/api/auth/request-code") && r.request().method() === "POST"),
    p.getByRole("button", { name: /email me a code/i }).click(),
  ]);
  if (!res.ok()) throw new Error(`request-code failed ${res.status()} ${await res.text()}`);
  await p.waitForSelector("#login-code");
  await prepare(p);
  await shot(p, "signin-code-dark");
  await ctx.close();
}

// Mobile light — both steps
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.waitForSelector("#login-email");
  await setTheme(p, "light");
  await prepare(p);
  await p.locator("#login-email").fill("sam@example.com");
  await shot(p, "signin-email-390");
  const [res] = await Promise.all([
    p.waitForResponse((r) => r.url().includes("/api/auth/request-code") && r.request().method() === "POST"),
    p.getByRole("button", { name: /email me a code/i }).click(),
  ]);
  if (!res.ok()) throw new Error(`request-code failed ${res.status()} ${await res.text()}`);
  await p.waitForSelector("#login-code");
  await prepare(p);
  await shot(p, "signin-code-390");
  await ctx.close();
}

await b.close();
console.log("done");
