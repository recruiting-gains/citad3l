/**
 * Apply rows from the manual referral log (referrals-manual-log.md) via logManualReferral().
 *
 * Default is a dry run: it prints what it would do and does not write.
 * Live apply: `--apply` (still skips incomplete rows). This script was not run on anyone
 * at ship time; only run it when Cruz has rows to enter.
 *
 * Table columns: Date | Referrer (name / code) | Friend (name / email) | Signed up | First payment | Free month issued
 * A row counts only when it has a referrer email or code, a friend email, and a signup (or Date) inside the promo window.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inPromoWindow, logManualReferral } from "../lib/referrals";
import { prisma } from "../lib/db";

const APPLY = process.argv.includes("--apply");
const fileArg = process.argv.find((a) => !a.startsWith("-") && !a.includes("apply-referral-log"));
const DEFAULT = "/workspace/citad3l/referrals-manual-log.md";

function parseEmail(cell: string): string | null {
  const m = cell.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}
function parseDate(cell: string): Date | null {
  const t = cell.trim();
  if (!t || t === "-" || t.toLowerCase() === "no") return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseCode(cell: string): string | null {
  const m = cell.match(/\b([a-z0-9]{4,16})\b/i);
  return m ? m[1].toLowerCase() : null;
}

function rows(md: string) {
  const out: { date: string; referrer: string; friend: string; signedUp: string; payment: string; issued: string }[] = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) continue;
    if (/^[-:]+$/.test(cells[0].replace(/\s/g, "")) || /^date$/i.test(cells[0])) continue;
    out.push({ date: cells[0], referrer: cells[1], friend: cells[2], signedUp: cells[3], payment: cells[4], issued: cells[5] });
  }
  return out;
}

async function referrerEmail(cell: string): Promise<string | null> {
  const email = parseEmail(cell);
  if (email) return email;
  const code = parseCode(cell);
  if (!code) return null;
  const r = await prisma.referral.findUnique({ where: { code }, select: { user: { select: { email: true } } } });
  return r?.user.email ?? null;
}

async function main() {
  const path = resolve(fileArg || DEFAULT);
  const md = readFileSync(path, "utf8");
  const all = rows(md);
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} ${path}: ${all.length} data row(s)`);
  if (!all.length) {
    console.log("Nothing to apply.");
    return;
  }
  for (const r of all) {
    const friendEmail = parseEmail(r.friend);
    const at = parseDate(r.signedUp) ?? parseDate(r.date);
    const refEmail = await referrerEmail(r.referrer);
    const label = `${r.date} | ${r.referrer} -> ${r.friend}`;
    if (!friendEmail || !refEmail || !at) {
      console.log(`SKIP (need referrer email/code, friend email, and a date): ${label}`);
      continue;
    }
    if (!inPromoWindow(at)) {
      console.log(`SKIP (outside promo window): ${label}`);
      continue;
    }
    if (!APPLY) {
      console.log(`WOULD apply ${refEmail} -> ${friendEmail} at ${at.toISOString()}`);
      continue;
    }
    const result = await logManualReferral({ referrerEmail: refEmail, friendEmail, at });
    console.log(`APPLIED ${refEmail} -> ${friendEmail}: ${result}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "error");
  process.exit(1);
});
