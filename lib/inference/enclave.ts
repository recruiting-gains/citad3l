/**
 * Provider E2EE (TEE) client, run inside the Citad3L Worker. Provider-specific header prefix and request field
 * names come from the PROVIDER_WIRE secret (passed in as `wire`), never from this repo.
 *
 * Flow per request: fresh 32-byte nonce → GET <attestation path> → require verified=true, matching nonce and model,
 * no debug mode, and a model public key → fresh secp256k1 client key → each user/system message encrypted to the
 * model key (ECDH → HKDF-SHA256(<label>) → AES-256-GCM; ephemeral pub 65B ‖ nonce 12B ‖ ct) → stream
 * → each hex chunk decrypted with the client private key.
 *
 * What this protects: the provider's API gateway, logs and hosts only see ciphertext; plaintext exists only in the TEE
 * enclave and in the Citad3L Worker. The Citad3L Worker DOES see plaintext (that is what lets the hard-line filter
 * still run on Private). Full client-side hardware quote verification is not done here; we rely on the provider's
 * server-side verification plus nonce/model/key checks.
 */
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { providerWire, type ProviderWire } from "./wire";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function fromHex(h: string): Uint8Array {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  if (s.length % 2 || !/^[0-9a-fA-F]*$/.test(s)) throw new Error("bad_hex");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export const isHexCipher = (s: string) => s.length >= 186 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s);

function normalizePub(h: string): Uint8Array {
  let k = h.startsWith("0x") ? h.slice(2) : h;
  if (k.length === 128) k = "04" + k;
  const bytes = fromHex(k);
  secp256k1.Point.fromBytes(bytes); // throws if not on the curve
  return bytes;
}

async function aesKey(shared: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", shared as BufferSource, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(providerWire().hkdfInfo) },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}
/** x-coordinate of the ECDH point (what elliptic's derive() returns). */
const ecdhX = (priv: Uint8Array, pub: Uint8Array) => secp256k1.getSharedSecret(priv, pub, true).slice(1);

export async function encryptFor(modelPubHex: string, plaintext: string): Promise<string> {
  const pub = normalizePub(modelPubHex);
  const eph = secp256k1.utils.randomSecretKey();
  const ephPub = secp256k1.getPublicKey(eph, false);
  const key = await aesKey(ecdhX(eph, pub), "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  eph.fill(0);
  const out = new Uint8Array(65 + 12 + ct.length);
  out.set(ephPub, 0); out.set(iv, 65); out.set(ct, 77);
  return hex(out);
}

export async function decryptWith(clientPriv: Uint8Array, cipherHex: string): Promise<string> {
  const raw = fromHex(cipherHex);
  const key = await aesKey(ecdhX(clientPriv, raw.slice(0, 65)), "decrypt");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(65, 77) }, key, raw.slice(77));
  return new TextDecoder().decode(pt);
}

export class E2EEError extends Error {}

export type Attested = { modelPubHex: string; teeProvider?: string };

export async function attest(baseUrl: string, apiKey: string, model: string, signal?: AbortSignal): Promise<Attested> {
  const nonce = hex(crypto.getRandomValues(new Uint8Array(32)));
  const res = await fetch(`${baseUrl}${providerWire().attestPath}?model=${encodeURIComponent(model)}&nonce=${nonce}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!res.ok) throw new E2EEError(`attestation_http_${res.status}`);
  const a = (await res.json()) as Record<string, unknown>;
  if (a.verified !== true) throw new E2EEError("attestation_not_verified");
  if (a.nonce !== nonce) throw new E2EEError("attestation_nonce_mismatch");
  if (typeof a.model === "string" && a.model !== model) throw new E2EEError("attestation_model_mismatch");
  const sv = (a.server_verification ?? {}) as { tdx?: { valid?: boolean; reportData?: string; measurements?: { tdAttributes?: string } }; signingAddressBinding?: { bound?: boolean } };
  if (sv.tdx && sv.tdx.valid !== true) throw new E2EEError("attestation_tdx_invalid");
  // TDATTRIBUTES bit 0 = DEBUG. A debug TD can be inspected by the host, so refuse it.
  const tdAttr = sv.tdx?.measurements?.tdAttributes;
  if (a.debug === true || (typeof tdAttr === "string" && /^[0-9a-f]{2}/i.test(tdAttr) && (parseInt(tdAttr.slice(0, 2), 16) & 1) === 1)) throw new E2EEError("attestation_debug");
  if (sv.signingAddressBinding && sv.signingAddressBinding.bound === false) throw new E2EEError("attestation_key_unbound");
  const k = (a.signing_key || a.signing_public_key) as string | undefined;
  if (typeof k !== "string" || !k) throw new E2EEError("attestation_no_key");
  let pub: Uint8Array;
  try { pub = normalizePub(k); } catch { throw new E2EEError("attestation_bad_key"); }
  // Key binding: the key's Ethereum address must equal signing_address, which the TDX quote's report_data carries.
  const addr = hex(keccak_256(pub.slice(1)).slice(-20));
  if (typeof a.signing_address === "string" && a.signing_address.toLowerCase().replace(/^0x/, "") !== addr) throw new E2EEError("attestation_address_mismatch");
  if (typeof sv.tdx?.reportData === "string" && !sv.tdx.reportData.toLowerCase().startsWith(addr)) throw new E2EEError("attestation_report_data_mismatch");
  return { modelPubHex: k, teeProvider: typeof a.tee_provider === "string" ? a.tee_provider : undefined };
}

export type PlainTurn = { role: "system" | "user" | "assistant"; content: string };

/**
 * The provider only encrypts user/system roles, and plaintext assistant turns would leak the conversation, so earlier
 * assistant replies are folded into an encrypted system message. Nothing readable leaves the Worker.
 */
export function foldForE2EE(turns: PlainTurn[]): { role: "system" | "user"; content: string }[] {
  const sys = turns.filter((t) => t.role === "system").map((t) => t.content);
  const convo = turns.filter((t) => t.role !== "system");
  const last = convo.at(-1);
  const lastUser = last?.role === "user" ? last.content : "";
  const earlier = last?.role === "user" ? convo.slice(0, -1) : convo;
  const out: { role: "system" | "user"; content: string }[] = [];
  const history = earlier.length
    ? "Conversation so far (oldest first):\n\n" + earlier.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n\n")
    : "";
  const system = [sys.join("\n\n"), history].filter(Boolean).join("\n\n---\n\n");
  if (system) out.push({ role: "system", content: system });
  out.push({ role: "user", content: lastUser || "(continue)" });
  return out;
}

export async function e2eeRequest(opts: {
  baseUrl: string; apiKey: string; model: string; turns: PlainTurn[]; stream: boolean; signal?: AbortSignal;
  temperature?: number; maxTokens?: number;
  wire?: ProviderWire;
}): Promise<{ res: Response; decrypt: (c: string) => Promise<string> }> {
  const wire = opts.wire ?? providerWire();
  const { modelPubHex } = await attest(opts.baseUrl, opts.apiKey, opts.model, opts.signal);
  const priv = secp256k1.utils.randomSecretKey();
  const clientPub = hex(secp256k1.getPublicKey(priv, false));
  const messages = await Promise.all(foldForE2EE(opts.turns).map(async (m) => ({ role: m.role, content: await encryptFor(modelPubHex, m.content) })));
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
      [`${wire.teeHeaderPrefix}-Client-Pub-Key`]: clientPub,
      [`${wire.teeHeaderPrefix}-Model-Pub-Key`]: modelPubHex,
      [`${wire.teeHeaderPrefix}-Signing-Algo`]: "ecdsa",
    },
    body: JSON.stringify({
      model: opts.model, messages, stream: opts.stream,
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
      ...(typeof opts.maxTokens === "number" ? { max_tokens: opts.maxTokens } : {}),
      [wire.params]: { [wire.e2ee]: true, [wire.noSystemPrompt]: false },
    }),
  });
  // Encrypted content only ever decrypts with this request's key; anything not hex-ciphertext is refused, so a
  // downgrade to plaintext is detected rather than shown as if it were private.
  const decrypt = async (c: string) => {
    if (!isHexCipher(c)) throw new E2EEError("plaintext_chunk");
    return decryptWith(priv, c);
  };
  return { res, decrypt };
}
