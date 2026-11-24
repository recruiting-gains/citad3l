/** Citad3L Private: provider E2EE against a FAKE enclave that implements the documented protocol. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { attest, decryptWith, e2eeRequest, encryptFor, foldForE2EE, isHexCipher, E2EEError } from "@/lib/inference/enclave";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const enclavePriv = secp256k1.utils.randomSecretKey();
const enclavePub = hex(secp256k1.getPublicKey(enclavePriv, false));
const enclaveAddr = "0x" + hex(keccak_256(secp256k1.getPublicKey(enclavePriv, false).slice(1)).slice(-20));
const MODEL = "e2ee-test-model";

function attestation(nonce: string, over: Record<string, unknown> = {}) {
  return {
    verified: true, nonce, model: MODEL, signing_key: enclavePub, signing_address: enclaveAddr, tee_provider: "fake",
    server_verification: { tdx: { valid: true, reportData: enclaveAddr.slice(2) + "00".repeat(44), measurements: { tdAttributes: "0000001000000000" } }, signingAddressBinding: { bound: true } },
    ...over,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Provider E2EE", () => {
  it("encrypts to the enclave key and round-trips", async () => {
    const c = await encryptFor(enclavePub, "hello enclave");
    expect(isHexCipher(c)).toBe(true);
    expect(c).not.toContain(Buffer.from("hello").toString("hex"));
    expect(await decryptWith(enclavePriv, c)).toBe("hello enclave");
  });

  it("folds assistant history into an encrypted system turn (no plaintext roles leave the Worker)", () => {
    const f = foldForE2EE([
      { role: "system", content: "SYS" }, { role: "user", content: "u1" }, { role: "assistant", content: "a1" }, { role: "user", content: "u2" },
    ]);
    expect(f.map((m) => m.role)).toEqual(["system", "user"]);
    expect(f[0].content).toContain("SYS");
    expect(f[0].content).toContain("Assistant: a1");
    expect(f[1].content).toBe("u2");
  });

  it("refuses unverified, replayed, wrong-model, debug or key-mismatched attestations", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ verified: false }, "attestation_not_verified"],
      [{ nonce: "00".repeat(32) }, "attestation_nonce_mismatch"],
      [{ model: "other" }, "attestation_model_mismatch"],
      [{ server_verification: { tdx: { valid: true, measurements: { tdAttributes: "0100000000000000" } } } }, "attestation_debug"],
      [{ server_verification: { tdx: { valid: false } } }, "attestation_tdx_invalid"],
      [{ signing_address: "0x" + "11".repeat(20) }, "attestation_address_mismatch"],
      [{ signing_key: undefined }, "attestation_no_key"],
    ];
    for (const [over, code] of cases) {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => {
        const nonce = new URL(String(u)).searchParams.get("nonce")!;
        return new Response(JSON.stringify(attestation(nonce, over)));
      });
      await expect(attest("https://provider.test/api/v1", "k", MODEL), code).rejects.toThrow(new E2EEError(code));
      vi.restoreAllMocks();
    }
  });

  it("full request: only ciphertext goes out, encrypted chunks decrypt, a plaintext chunk is refused", async () => {
    const seen: { headers: Record<string, string>; body: any }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => {
      const url = new URL(String(u));
      if (url.pathname.endsWith("/attestation")) return new Response(JSON.stringify(attestation(url.searchParams.get("nonce")!)));
      const headers = Object.fromEntries(new Headers(init!.headers).entries());
      const body = JSON.parse(String(init!.body));
      seen.push({ headers, body });
      // The fake enclave decrypts the request and answers encrypted to the client key.
      const prompt = await decryptWith(enclavePriv, body.messages.at(-1).content);
      const chunk = await encryptFor(headers["x-tee-client-pub-key"], `echo:${prompt}`);
      return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\ndata: [DONE]\n\n`);
    });
    const r = await e2eeRequest({ baseUrl: "https://provider.test/api/v1", apiKey: "k", model: MODEL, stream: true, turns: [{ role: "user", content: "secret words" }] });
    const sse = await r.res.text();
    const c = JSON.parse(sse.split("\n")[0].slice(6)).choices[0].delta.content;
    expect(await r.decrypt(c)).toBe("echo:secret words");
    expect(JSON.stringify(seen[0].body)).not.toContain("secret words");
    expect(seen[0].headers["x-tee-model-pub-key"]).toBe(enclavePub);
    expect(seen[0].headers["x-tee-signing-algo"]).toBe("ecdsa");
    await expect(r.decrypt("plain text reply")).rejects.toThrow("plaintext_chunk");
  });
});
