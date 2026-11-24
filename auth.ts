import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { demoLoginEnabled, isAdminEmail, isProd } from "@/lib/config";
import { checkVerifyLimits, verifyEmailCode } from "@/lib/auth/email-code";
import { clientIpFrom } from "@/lib/client-ip";
import { ADMIN_SESSION_MAX_AGE_SEC, checkAndRollSession, createLoginSession } from "@/lib/sessions";

class EmailCodeSigninError extends CredentialsSignin {
  constructor(code: "invalid_code" | "expired_code" | "locked" | "invalid_email") {
    super(code);
    this.code = code;
  }
}

const providers: Provider[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

// 6-digit email code. Always registered (demo login is the only dev-only provider).
providers.push(
  Credentials({
    id: "email-code",
    name: "Email code",
    credentials: {
      email: { label: "Email", type: "email" },
      code: { label: "Code", type: "text" },
    },
    async authorize(raw, request) {
      const ip = request instanceof Request ? clientIpFrom(request.headers) : null;
      if (!(await checkVerifyLimits(raw?.email, ip))) throw new EmailCodeSigninError("locked");
      const result = await verifyEmailCode({ email: raw?.email, code: raw?.code });
      if (!result.ok) throw new EmailCodeSigninError(result.error);
      return { id: result.user.id, email: result.user.email, name: result.user.name };
    },
  }),
);

if (isProd() && process.env.DEMO_LOGIN_ENABLED === "true") {
  console.error("[auth] DEMO_LOGIN_ENABLED=true ignored: demo login is refused when NODE_ENV=production");
}

// DEV-ONLY demo login. Not registered at all in production; authorize() re-checks as a second guard.
if (demoLoginEnabled()) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo (development only)",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(raw) {
        if (!demoLoginEnabled()) return null;
        const email = String(raw?.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]{1,64}@[^\s@]{1,190}$/.test(email)) return null;
        const user = await prisma.user.upsert({
          where: { email },
          create: { email, name: email.split("@")[0] },
          update: {},
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  // 365-day ceiling so admin cookies can last a year. LoginSession + the jwt
  // callback enforce 30 days (regular) vs 365 days (ADMIN_EMAILS). The auth
  // route rewrites Set-Cookie Max-Age to the role's length.
  session: { strategy: "jwt", maxAge: ADMIN_SESSION_MAX_AGE_SEC },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        if (user.email) token.email = user.email;
        try {
          const s = await createLoginSession(user.id, { email: user.email, isAdmin: isAdminEmail(user.email) });
          token.sid = s.id;
          delete token.unverified;
        } catch {
          // Fail closed: a sign-in without a tracked LoginSession could never be revoked ("log out other devices"),
          // so it is refused instead. The user can try again in a moment.
          delete token.uid;
          delete token.sid;
        }
      } else if (typeof token.sid === "string") {
        try {
          const email = typeof token.email === "string" ? token.email : null;
          const userId = typeof token.uid === "string" ? token.uid : undefined;
          const check = await checkAndRollSession(token.sid, { email, userId });
          if (!check.active) {
            delete token.uid;
            delete token.sid;
          }
          delete token.unverified;
        } catch {
          // Fail closed for THIS request only: the session can't be checked (database hiccup), so the request is
          // treated as signed out. The token is kept and re-checked next time, so a short blip doesn't force a re-login.
          token.unverified = true;
        }
      } else if (token.uid) {
        // Signed-in token with no session id (issued while the session table was unreachable): not revocable → drop.
        delete token.uid;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid && !token.unverified && session.user) session.user.id = token.uid as string;
      if (typeof token.sid === "string" && !token.unverified) (session as { sid?: string }).sid = token.sid;
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/** Auth.js keeps Credentials id/name on `options`; OAuth providers use the top-level fields. */
function providerMeta(p: Provider) {
  const resolved = (typeof p === "function" ? p() : p) as { id?: string; name?: string; type?: string; options?: { id?: string; name?: string } };
  return {
    id: resolved.options?.id ?? resolved.id,
    name: resolved.options?.name ?? resolved.name,
    type: resolved.type,
  };
}

export const providerList: { id: string; name: string }[] = providers
  .map(providerMeta)
  .filter((p) => !!p.id && !!p.name && p.type !== "credentials" && p.id !== "demo" && p.id !== "email-code")
  .map((p) => ({ id: p.id as string, name: p.name as string }));

/** Returns the signed-in user's id, verifying the user row still exists (deleted accounts are logged out). */
export async function requireUserId(): Promise<string | null> {
  try {
    const s = await auth();
    const id = s?.user?.id;
    if (!id) return null;
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null; // database/auth unavailable → APIs answer 401 instead of crashing
  }
}
