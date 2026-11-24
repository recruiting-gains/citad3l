/**
 * Provider wire settings from the PROVIDER_WIRE Worker secret (JSON). Neutral defaults only; the real field names,
 * enclave header prefix, attestation path, key-derivation label and media host are never written in this repo.
 * No "server-only" import so the enclave client (and its tests) can use it; it reads only process.env.
 */
export type ProviderWire = {
  params: string; noSystemPrompt: string; webSearch: string; noThinking: string; stripThinking: string;
  e2ee: string; teeHeaderPrefix: string; attestPath: string; hkdfInfo: string; mediaHost: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

export function providerWire(): ProviderWire {
  let w: Record<string, unknown> = {};
  try {
    const v = JSON.parse(process.env.PROVIDER_WIRE || "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) w = v as Record<string, unknown>;
  } catch { /* defaults */ }
  return {
    params: str(w.params) || "provider_parameters",
    noSystemPrompt: str(w.noSystemPrompt) || "include_provider_system_prompt",
    webSearch: str(w.webSearch) || "web_search",
    noThinking: str(w.noThinking) || "no_thinking",
    stripThinking: str(w.stripThinking) || "strip_thinking",
    e2ee: str(w.e2ee) || "e2ee",
    teeHeaderPrefix: str(w.teeHeaderPrefix) || "X-TEE",
    attestPath: str(w.attestPath) || "/attestation",
    hkdfInfo: str(w.hkdfInfo) || "tee_encryption",
    mediaHost: str(w.mediaHost).toLowerCase(),
  };
}
