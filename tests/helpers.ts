export const BASE = process.env.BASE_URL ?? "http://localhost:3210";

export class Client {
  cookies = new Map<string, string>();
  private store(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  async fetch(path: string, init: RequestInit = {}) {
    const res = await fetch(BASE + path, { ...init, redirect: "manual", headers: { ...(init.headers ?? {}), cookie: this.header() } });
    this.store(res);
    return res;
  }
  async json(path: string, method = "GET", body?: unknown) {
    const res = await this.fetch(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data: any = null; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  async login(email: string) {
    const csrf = await this.json("/api/auth/csrf");
    const form = new URLSearchParams({ csrfToken: csrf.data.csrfToken, email, callbackUrl: BASE + "/chat" });
    const res = await this.fetch("/api/auth/callback/demo", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
    const s = await this.json("/api/auth/session");
    if (!s.data?.user?.id) throw new Error("login failed " + res.status);
    return s.data.user.id as string;
  }
}

export interface SSEResult { status: number; events: { event: string; data: any }[]; text: string; json?: any }
export async function chat(c: Client, body: Record<string, unknown>, opts: { abortAfterDeltas?: number } = {}): Promise<SSEResult> {
  const ac = new AbortController();
  const res = await c.fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
  if (!res.headers.get("content-type")?.includes("event-stream")) {
    return { status: res.status, events: [], text: "", json: await res.json().catch(() => null) };
  }
  const events: { event: string; data: any }[] = [];
  let text = "", buf = "", deltas = 0;
  const reader = res.body!.getReader(); const dec = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = /event: (.*)/.exec(block)?.[1] ?? "message";
        const data = JSON.parse(/data: (.*)/.exec(block)?.[1] ?? "null");
        events.push({ event: ev, data });
        if (ev === "delta") { text += data.text; deltas++; if (opts.abortAfterDeltas && deltas >= opts.abortAfterDeltas) { ac.abort(); throw new Error("aborted"); } }
      }
    }
  } catch (e) { if (!opts.abortAfterDeltas) throw e; }
  return { status: res.status, events, text };
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
