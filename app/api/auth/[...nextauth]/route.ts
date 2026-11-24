import { handlers } from "@/auth";
import { isAdminEmail } from "@/lib/config";
import { applySessionCookieMaxAge, sessionMaxAgeSeconds } from "@/lib/sessions";

/**
 * Auth.js issues the session cookie with session.maxAge (the 365-day ceiling).
 * After the handler runs, rewrite Max-Age to 30 days for regular users and
 * 365 days for admins, leaving HttpOnly / Secure / SameSite / Path as they are.
 */
async function withRoleCookieMaxAge(res: Response): Promise<Response> {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (!setCookies.some((c) => /authjs\.session-token/i.test(c))) return res;

  let isAdmin = false;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await res.clone().json()) as { user?: { email?: unknown } };
      isAdmin = isAdminEmail(typeof body?.user?.email === "string" ? body.user.email : null);
    } catch {
      return res;
    }
  } else {
    // Login redirects have no session JSON. Leave Auth.js's 365-day ceiling;
    // the next /api/auth/session call (SessionKeepAlive) rewrites Max-Age.
    return res;
  }

  const rewritten = applySessionCookieMaxAge(setCookies, sessionMaxAgeSeconds(isAdmin));
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  for (const c of rewritten) headers.append("set-cookie", c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function GET(...args: Parameters<typeof handlers.GET>) {
  return withRoleCookieMaxAge(await handlers.GET(...args));
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  return withRoleCookieMaxAge(await handlers.POST(...args));
}
