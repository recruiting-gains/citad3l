// Test-only Worker: the real ComputerHub + the real WebSocket route, plus /internal/<userId>/* standing in for the
// COMPUTER_HUB binding calls that the admin-gated Next routes make in production (one hub per user, tagged X-Hub-User).
// /raw/<hubUser>/<headerUser>/* reaches <hubUser>'s hub while CLAIMING to be <headerUser> (isolation tests only).
import { ComputerHub, computerSocket, hubNameForUser } from "../../worker/computer-hub.js";
export { ComputerHub };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/computer/ws") return computerSocket(request, env);
    let m = /^\/internal\/([^/]+)(\/.*)$/.exec(url.pathname);
    let hubUser, headerUser, rest;
    if (m) { hubUser = headerUser = m[1]; rest = m[2]; }
    else if ((m = /^\/raw\/([^/]+)\/([^/]*)(\/.*)$/.exec(url.pathname))) { hubUser = m[1]; headerUser = m[2]; rest = m[3]; }
    else return new Response("not found", { status: 404 });
    const stub = env.COMPUTER_HUB.get(env.COMPUTER_HUB.idFromName(hubNameForUser(hubUser)));
    const body = request.method === "GET" ? undefined : await request.text();
    const headers = { "content-type": "application/json" };
    if (headerUser) headers["x-hub-user"] = headerUser;
    return stub.fetch(new Request("https://hub.internal" + rest, { method: request.method, body, headers }));
  },
};
