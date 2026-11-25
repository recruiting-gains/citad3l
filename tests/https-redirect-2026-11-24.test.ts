import { describe, expect, it } from "vitest";
import { csrfBlockReason, httpsRedirect } from "@/security/edge.mjs";

const env = { APP_URL: "https://citad3l.io" };

describe("http -> https redirect (Threads in-app browser 'Request blocked.' bug)", () => {
  it("301s plain-http GET page loads to https, same path and query", () => {
    const res = httpsRedirect(new Request("http://citad3l.io/login?next=/chat"))!;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://citad3l.io/login?next=/chat");
  });
  it("308s plain-http POSTs so method and body are kept", () => {
    const res = httpsRedirect(new Request("http://citad3l.io/api/waitlist", { method: "POST", body: "{}" }))!;
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://citad3l.io/api/waitlist");
  });
  it("leaves https, localhost and websocket handshakes alone", () => {
    expect(httpsRedirect(new Request("http://citad3l.io/api/computer/ws", { headers: { upgrade: "websocket" } }))).toBeNull();
    expect(httpsRedirect(new Request("https://citad3l.io/"))).toBeNull();
    expect(httpsRedirect(new Request("http://localhost:3000/api/waitlist", { method: "POST", body: "{}" }))).toBeNull();
  });
  it("https form posts from the real site still pass the CSRF guard; http origin stays blocked", () => {
    const ok = new Request("https://citad3l.io/api/auth/request-code", { method: "POST", headers: { origin: "https://citad3l.io" }, body: "{}" });
    expect(csrfBlockReason(ok, env)).toBeNull();
    const plain = new Request("https://citad3l.io/api/waitlist", { method: "POST", headers: { origin: "http://citad3l.io" }, body: "{}" });
    expect(csrfBlockReason(plain, env)).toBe("foreign_origin");
  });
});
