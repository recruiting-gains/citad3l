import { NextResponse } from "next/server";
export function jerr(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message }, ...extra }, { status });
}

export class BodyTooLarge extends Error {}
export class BadJson extends Error {}

/** Default JSON body cap for API routes (64 KB). Chat/image bodies are well under this. */
export const MAX_JSON_BYTES = 64_000;

/**
 * Read a JSON body with a hard byte cap. Checks Content-Length first, then counts bytes while
 * streaming so a chunked body without Content-Length cannot exceed the cap either.
 */
export async function readJsonLimited(req: Request, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const text = await readTextLimited(req, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new BadJson();
  }
}

/** Read the raw body as text with a hard byte cap (exact bytes preserved, e.g. for webhook signatures). */
export async function readTextLimited(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  if (!req.body) throw new BadJson();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(buf);
}

/** Standard 429 with Retry-After. */
export function tooMany(message: string, retryAfterSec = 60) {
  const res = jerr(429, "rate_limited", message, { retryAfterSec });
  res.headers.set("Retry-After", String(retryAfterSec));
  return res;
}
