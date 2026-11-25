import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  buildAnswerZip,
  buildZip,
  extractCodeBlocks,
  sanitizeRelPath,
  slugFromTitle,
  stripExportFooter,
  type ZipEntryInput,
} from "./downloads";
import { buildChatPdf } from "./pdf-export";
import { LIMITS, limitDurable, rateLimit, rule } from "./ratelimit";

export const EXPORT_KEY_PREFIX = "exports/";
export const EXPORT_LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (matches R2 lifecycle)
export const MAX_EXPORT_SOURCE_BYTES = 512 * 1024; // 512 KB raw text / project files per export
export const MAX_EXPORT_ARTIFACT_BYTES = 5 * 1024 * 1024; // 5 MB per zip/PDF artifact
export const MAX_EXPORT_FILES = 50; // max code/project files inside one zip
export const MAX_USER_ACTIVE_EXPORT_BYTES = 50 * 1024 * 1024; // 50 MB active 24h storage per user
export const MAX_USER_ACTIVE_EXPORTS = 100; // max active 24h objects per user

export type ExportKind = "zip" | "pdf";
export type ExportMode = "zip" | "pdf" | "both";

export interface ExportR2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  size?: number;
}

export interface ExportR2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    opts?: {
      httpMetadata?: { contentType: string; contentDisposition?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<ExportR2Object | null>;
  head?(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string | string[]): Promise<void>;
  list?(opts: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string; size?: number }[];
    truncated: boolean;
    cursor?: string;
  }>;
}

export interface ExportArtifact {
  exportId: string;
  kind: ExportKind;
  filename: string;
  bytes: number;
  url: string;
  expiresAt: string;
  fileCount?: number;
  codeCount?: number;
}

export interface ExportBundleResult {
  zip?: ExportArtifact;
  pdf?: ExportArtifact;
  expiresAt: string;
}

export class ExportError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

type CfCtx = { env: Record<string, unknown> };

function cfContext(): CfCtx | undefined {
  try {
    return getCloudflareContext() as unknown as CfCtx;
  } catch {
    return undefined;
  }
}

export function exportsBucket(override?: ExportR2Bucket | null): ExportR2Bucket | null {
  if (override !== undefined) return override;
  const b = cfContext()?.env?.EXPORTS as ExportR2Bucket | undefined;
  return b && typeof b.put === "function" && typeof b.get === "function" ? b : null;
}

function signingSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.GUEST_COOKIE_SECRET || "";
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required to sign export links.");
  }
  return "dev-export-signing-secret-not-for-production";
}

export function newExportId(): string {
  return `exp_${randomBytes(12).toString("hex")}`;
}

export function isValidExportId(id: string): boolean {
  return /^exp_[a-f0-9]{24}$/.test(id);
}

export function exportObjectKey(userId: string, exportId: string, kind: ExportKind): string {
  if (!userId || userId.includes("/") || userId.includes("..") || !isValidExportId(exportId)) {
    throw new Error("Invalid export object key parts");
  }
  return `${EXPORT_KEY_PREFIX}${userId}/${exportId}.${kind}`;
}

export function safeDownloadFilename(raw: string | null | undefined, kind: ExportKind, fallbackBase = "citad3l-export"): string {
  const cleaned = String(raw ?? "")
    .replace(/[\r\n\0"';\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const ext = `.${kind}`;
  let base = cleaned || `${fallbackBase}${ext}`;
  if (!base.toLowerCase().endsWith(ext)) {
    base = base.replace(/\.(zip|pdf)$/i, "");
    base = `${base || fallbackBase}${ext}`;
  }
  if (base.length > 80) {
    base = `${base.slice(0, 80 - ext.length)}${ext}`;
  }
  return base;
}

function signPayload(payload: string): string {
  return createHmac("sha256", signingSecret()).update(`citad3l-export-v1:${payload}`).digest("hex");
}

export function signExportLink(opts: {
  exportId: string;
  userId: string;
  kind: ExportKind;
  filename: string;
  expMs: number;
}): string {
  const filename = safeDownloadFilename(opts.filename, opts.kind);
  const payload = `${opts.exportId}:${opts.userId}:${opts.kind}:${opts.expMs}:${filename}`;
  const sig = signPayload(payload);
  const q = new URLSearchParams({
    kind: opts.kind,
    exp: String(opts.expMs),
    name: filename,
    sig,
  });
  return `/api/exports/${opts.exportId}?${q.toString()}`;
}

export function verifyExportSignature(opts: {
  exportId: string;
  userId: string;
  kind: ExportKind;
  filename: string;
  expMs: number;
  sig: string;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: "invalid" | "expired" } {
  if (!isValidExportId(opts.exportId) || !opts.userId || !Number.isFinite(opts.expMs)) {
    return { ok: false, reason: "invalid" };
  }
  if (!/^[a-f0-9]{64}$/i.test(opts.sig)) {
    return { ok: false, reason: "invalid" };
  }
  const filename = safeDownloadFilename(opts.filename, opts.kind);
  const payload = `${opts.exportId}:${opts.userId}:${opts.kind}:${opts.expMs}:${filename}`;
  const expected = signPayload(payload);
  const a = Buffer.from(opts.sig.toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }
  const now = opts.nowMs ?? Date.now();
  if (now > opts.expMs) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export async function checkExportRateLimits(userId: string): Promise<void> {
  if (!rateLimit(`export:${userId}`, LIMITS.exportUserMin.limit, LIMITS.exportUserMin.windowMs)) {
    throw new ExportError(429, "rate_limited", "Too many export requests this minute. Wait a moment and try again.", 60);
  }
  const lim = await limitDurable(
    [
      rule(LIMITS.exportUserMin, userId),
      rule(LIMITS.exportUserHour, userId),
      rule(LIMITS.exportUserDay, userId),
    ],
    { onDbError: "closed" },
  );
  if (!lim.ok) {
    const msg = lim.rule.endsWith(":unavailable")
      ? "Couldn't verify your export limit right now. Try again in a moment."
      : "Export rate limit reached. Try again later.";
    throw new ExportError(429, "rate_limited", msg, lim.retryAfterSec);
  }
}

async function checkUserActiveStorage(bucket: ExportR2Bucket, userId: string, incomingBytes: number): Promise<void> {
  if (!bucket.list) return;
  const prefix = `${EXPORT_KEY_PREFIX}${userId}/`;
  let cursor: string | undefined;
  let totalBytes = 0;
  let totalObjects = 0;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 200 });
    for (const obj of page.objects) {
      totalObjects += 1;
      totalBytes += Number(obj.size ?? 0);
      if (totalObjects >= MAX_USER_ACTIVE_EXPORTS) {
        throw new ExportError(429, "storage_limit", "You reached the active 24-hour export file cap (100 files). Old exports expire automatically after 24 hours.");
      }
      if (totalBytes + incomingBytes > MAX_USER_ACTIVE_EXPORT_BYTES) {
        throw new ExportError(413, "storage_limit", "You reached the active 24-hour export storage cap (50 MB). Old exports expire automatically after 24 hours.");
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export interface CreateExportInput {
  userId: string;
  kind: ExportMode;
  title?: string | null;
  markdown?: string | null;
  files?: { path: string; content: string }[];
  createdAt?: string;
  bucket?: ExportR2Bucket | null;
  nowMs?: number;
}

export async function createSignedExport(opts: CreateExportInput): Promise<ExportBundleResult> {
  if (!opts.userId) throw new ExportError(401, "unauthorized", "Sign in to create downloadable exports.");
  const bucket = exportsBucket(opts.bucket);
  if (!bucket) throw new ExportError(503, "storage_unavailable", "Server export storage is not configured.");

  const cleanMd = stripExportFooter(opts.markdown ?? "").trim();
  const explicitFiles = opts.files ?? [];
  if (!cleanMd && !explicitFiles.length) {
    throw new ExportError(400, "bad_request", "Nothing to export.");
  }
  if (explicitFiles.length > MAX_EXPORT_FILES) {
    throw new ExportError(413, "too_large", `Projects are limited to ${MAX_EXPORT_FILES} files per export.`);
  }

  const enc = new TextEncoder();
  let sourceBytes = enc.encode(cleanMd).byteLength;
  const validatedFiles: ZipEntryInput[] = [];
  const usedNames = new Set<string>(cleanMd ? ["answer.md"] : []);
  for (const f of explicitFiles) {
    const safePath = sanitizeRelPath(f.path);
    if (!safePath) {
      throw new ExportError(400, "bad_request", `Invalid file path: ${String(f.path).slice(0, 60)}`);
    }
    const lower = safePath.toLowerCase();
    if (usedNames.has(lower)) {
      throw new ExportError(400, "bad_request", `Duplicate file path: ${safePath}`);
    }
    usedNames.add(lower);
    sourceBytes += enc.encode(f.content).byteLength;
    if (sourceBytes > MAX_EXPORT_SOURCE_BYTES) {
      throw new ExportError(413, "too_large", "Export input exceeds the 512 KB per-export limit.");
    }
    validatedFiles.push({ name: safePath, content: f.content.replace(/\r?\n$/, "") + "\n" });
  }
  if (sourceBytes > MAX_EXPORT_SOURCE_BYTES) {
    throw new ExportError(413, "too_large", "Export input exceeds the 512 KB per-export limit.");
  }

  await checkExportRateLimits(opts.userId);

  const nowMs = opts.nowMs ?? Date.now();
  const expMs = nowMs + EXPORT_LINK_TTL_MS;
  const expiresAt = new Date(expMs).toISOString();
  const slug = slugFromTitle(opts.title, "citad3l-project");

  const artifactsToStore: Array<{
    kind: ExportKind;
    filename: string;
    mime: string;
    bytes: Uint8Array;
    fileCount?: number;
    codeCount?: number;
  }> = [];

  if (opts.kind === "zip" || opts.kind === "both") {
    let zipBytes: Uint8Array;
    let fileCount: number;
    let codeCount: number;
    if (validatedFiles.length > 0) {
      const entries: ZipEntryInput[] = cleanMd
        ? [{ name: "answer.md", content: cleanMd + "\n" }, ...validatedFiles]
        : validatedFiles;
      zipBytes = buildZip(entries, new Date(nowMs));
      fileCount = entries.length;
      codeCount = validatedFiles.length;
    } else {
      const blocks = extractCodeBlocks(cleanMd);
      if (blocks.length > MAX_EXPORT_FILES) {
        throw new ExportError(413, "too_large", `Exports are limited to ${MAX_EXPORT_FILES} code files.`);
      }
      const built = buildAnswerZip(cleanMd);
      zipBytes = built.bytes;
      fileCount = built.fileCount;
      codeCount = built.codeCount;
    }
    if (zipBytes.byteLength > MAX_EXPORT_ARTIFACT_BYTES) {
      throw new ExportError(413, "too_large", "Generated zip exceeds the 5 MB per-export limit.");
    }
    artifactsToStore.push({
      kind: "zip",
      filename: safeDownloadFilename(`${slug}.zip`, "zip"),
      mime: "application/zip",
      bytes: zipBytes,
      fileCount,
      codeCount,
    });
  }

  if (opts.kind === "pdf" || opts.kind === "both") {
    const pdfSource = cleanMd
      || validatedFiles
        .map((f) => `### ${f.name}\n\n\`\`\`\n${typeof f.content === "string" ? f.content : ""}\n\`\`\``)
        .join("\n\n");
    const pdfBytes = buildChatPdf(pdfSource, {
      title: opts.title && opts.title !== "New chat" ? opts.title : "Citad3L Answer",
      createdAt: opts.createdAt ?? new Date(nowMs).toISOString(),
    });
    if (pdfBytes.byteLength > MAX_EXPORT_ARTIFACT_BYTES) {
      throw new ExportError(413, "too_large", "Generated PDF exceeds the 5 MB per-export limit.");
    }
    artifactsToStore.push({
      kind: "pdf",
      filename: safeDownloadFilename(`${slug}.pdf`, "pdf"),
      mime: "application/pdf",
      bytes: pdfBytes,
    });
  }

  const incomingBytes = artifactsToStore.reduce((s, a) => s + a.bytes.byteLength, 0);
  await checkUserActiveStorage(bucket, opts.userId, incomingBytes);

  const result: ExportBundleResult = { expiresAt };
  for (const item of artifactsToStore) {
    const exportId = newExportId();
    const key = exportObjectKey(opts.userId, exportId, item.kind);
    const copy = Uint8Array.from(item.bytes);
    await bucket.put(key, copy, {
      httpMetadata: {
        contentType: item.mime,
        contentDisposition: `attachment; filename="${item.filename}"`,
      },
      customMetadata: {
        userId: opts.userId,
        kind: item.kind,
        filename: item.filename,
        expiresAt,
      },
    });
    const url = signExportLink({
      exportId,
      userId: opts.userId,
      kind: item.kind,
      filename: item.filename,
      expMs,
    });
    const artifact: ExportArtifact = {
      exportId,
      kind: item.kind,
      filename: item.filename,
      bytes: copy.byteLength,
      url,
      expiresAt,
      ...(item.fileCount !== undefined ? { fileCount: item.fileCount } : {}),
      ...(item.codeCount !== undefined ? { codeCount: item.codeCount } : {}),
    };
    if (item.kind === "zip") result.zip = artifact;
    else result.pdf = artifact;
  }

  return result;
}

export async function loadSignedExport(opts: {
  userId: string;
  exportId: string;
  kind: ExportKind;
  filename: string;
  expMs: number;
  sig: string;
  bucket?: ExportR2Bucket | null;
  nowMs?: number;
}): Promise<
  | { body: Uint8Array; mime: string; filename: string }
  | { error: "unauthorized" | "forbidden" | "expired" | "not_found" | "storage_unavailable" }
> {
  if (!opts.userId) return { error: "unauthorized" };
  const sigCheck = verifyExportSignature({
    exportId: opts.exportId,
    userId: opts.userId,
    kind: opts.kind,
    filename: opts.filename,
    expMs: opts.expMs,
    sig: opts.sig,
    nowMs: opts.nowMs,
  });
  if (!sigCheck.ok) {
    return { error: sigCheck.reason === "expired" ? "expired" : "forbidden" };
  }
  const bucket = exportsBucket(opts.bucket);
  if (!bucket) return { error: "storage_unavailable" };

  const key = exportObjectKey(opts.userId, opts.exportId, opts.kind);
  const obj = await bucket.get(key);
  if (!obj) return { error: "expired" };
  const body = new Uint8Array(await obj.arrayBuffer());
  const mime = opts.kind === "zip" ? "application/zip" : "application/pdf";
  return {
    body,
    mime,
    filename: safeDownloadFilename(opts.filename, opts.kind),
  };
}

const ASK_EXPORT_RE = /\b(zip|archive|tarball|pdf|download(?:able)?|export|multi-?file|project\s+(?:files|structure|bundle|kit))\b/i;
const ASK_PDF_RE = /\bpdf\b/i;

export function shouldAutoExport(opts: {
  swarm: boolean;
  userMessage: string;
  assistantText: string;
}): { create: boolean; kind: ExportMode } {
  const blocks = extractCodeBlocks(opts.assistantText);
  const asked = ASK_EXPORT_RE.test(opts.userMessage);
  const askedPdf = ASK_PDF_RE.test(opts.userMessage);
  const hasProject = blocks.length >= 2 || (opts.swarm && blocks.length >= 1);
  const shouldCreate = hasProject || (asked && (blocks.length >= 1 || opts.assistantText.length >= 1200));
  if (!shouldCreate) return { create: false, kind: "zip" };

  const wantsZip = blocks.length >= 1;
  const wantsPdf = askedPdf || opts.swarm || opts.assistantText.length >= 2500;
  if (wantsZip && wantsPdf) return { create: true, kind: "both" };
  if (wantsPdf) return { create: true, kind: "pdf" };
  return { create: true, kind: "zip" };
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatExportFooter(bundle: ExportBundleResult): string {
  const links: string[] = [];
  if (bundle.zip) {
    const filesNote = bundle.zip.fileCount ? `${bundle.zip.fileCount} files, ` : "";
    links.push(`[${bundle.zip.filename}](${bundle.zip.url}) (${filesNote}${fmtSize(bundle.zip.bytes)})`);
  }
  if (bundle.pdf) {
    links.push(`[${bundle.pdf.filename}](${bundle.pdf.url}) (${fmtSize(bundle.pdf.bytes)})`);
  }
  if (!links.length) return "";
  return `\n\n---\n**Downloads (signed, 24h):** ${links.join(" · ")}`;
}

/**
 * Best-effort automatic R2 export after a signed-in chat reply completes.
 * Never throws or fails the chat reply if storage is absent or user limits are reached.
 */
export async function maybeCreateAutoExports(opts: {
  userId: string;
  swarm: boolean;
  title?: string | null;
  userMessage: string;
  assistantText: string;
  bucket?: ExportR2Bucket | null;
}): Promise<{ bundle: ExportBundleResult; footer: string } | null> {
  const bucket = exportsBucket(opts.bucket);
  if (!bucket || !opts.userId) return null;
  const decision = shouldAutoExport({
    swarm: opts.swarm,
    userMessage: opts.userMessage,
    assistantText: opts.assistantText,
  });
  if (!decision.create) return null;

  try {
    const bundle = await createSignedExport({
      userId: opts.userId,
      kind: decision.kind,
      title: opts.title,
      markdown: opts.assistantText,
      bucket,
    });
    const footer = formatExportFooter(bundle);
    return footer ? { bundle, footer } : null;
  } catch {
    return null;
  }
}
