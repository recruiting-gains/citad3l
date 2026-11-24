import "server-only";
import { isProd } from "../config";
import { resolveModel, providerApiKey, providerBaseUrl } from "./provider-models";
import { ProviderUnavailable } from "./index";

export type ImageResult = {
  markdown: string;
  mock: boolean;
  mime: string;
  /** Raw image bytes when the provider returned a base64 payload. Absent for the dev mock. */
  bytes?: Uint8Array;
};

export function mockImageMarkdown(_prompt: string): string {
  return "![Mock image – not live generation](/mock-image.svg)";
}

function toMarkdown(b64: string, mime: string, alt = "Generated image"): string {
  const clean = b64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  // Angle brackets keep long data URIs valid in CommonMark (plus signs, etc.).
  return `![${alt}](<data:${mime};base64,${clean}>)`;
}

function decodeBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

export const IMAGE_SIZE = { aspect_ratio: "1:1", resolution: "1K" } as const;

/** Trust the bytes over the requested format, in case a provider ignores `format`. */
export function sniffMime(bytes: Uint8Array, fallback: string): string {
  const b = bytes;
  if (b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length > 3 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return fallback;
}

function mimeFromFormat(format: string | undefined): string {
  if (format === "png") return "image/png";
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  return "image/webp";
}

/**
 * Generate one image through the provider, or a clearly labelled placeholder when
 * no key is set in development. Refused in production without a key.
 */
export async function generateImage(prompt: string, signal: AbortSignal): Promise<ImageResult> {
  resolveModel("citad3l-image", { admin: true }); // throws if the slug is withdrawn; the route enforces admin-only
  const key = providerApiKey();
  if (!key) {
    if (isProd()) throw new ProviderUnavailable("Image generation is not configured.");
    return { markdown: mockImageMarkdown(prompt), mock: true, mime: "image/svg+xml" };
  }
  const resolved = resolveModel("citad3l-image", { admin: true });
  const url = `${providerBaseUrl()}/image/generate`;
  const format = "webp";
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, accept: "application/json" },
      body: JSON.stringify({
        model: resolved.providerModelId,
        prompt,
        // The image model is resolution-tiered: sized by aspect_ratio + resolution (1K = 1024×1024 at
        // 1:1, $0.10), not width/height. Verified live 2026-11-19: HTTP 200, 1024×1024 WebP.
        ...IMAGE_SIZE,
        format,
        safe_mode: process.env.CITAD3L_IMAGE_SAFE_MODE === "false" ? process.env.CITAD3L_ALLOW_ADULT !== "true" : true,
        variants: 1,
        return_binary: false,
      }),
    });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new ProviderUnavailable("Image host unreachable");
  }
  if (!res.ok) throw new ProviderUnavailable(`Image host returned ${res.status}`);
  const body = (await res.json()) as { images?: unknown };
  const first = Array.isArray(body.images) ? body.images[0] : undefined;
  if (typeof first !== "string" || !first) throw new ProviderUnavailable("Image host returned an empty image.");
  const bytes = decodeBytes(first);
  const mime = sniffMime(bytes, mimeFromFormat(format));
  return { markdown: toMarkdown(first, mime, "Generated image"), mock: false, mime, bytes };
}
