import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { demoLoginEnabled, isProd } from "@/lib/config";

const providers: Provider[] = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);
if (process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM) providers.push(Resend({ from: process.env.AUTH_EMAIL_FROM }));

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
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export const providerList = providers
  .map((p) => (typeof p === "function" ? p() : p))
  .filter((p) => p.id !== "demo")
  .map((p) => ({ id: p.id, name: p.name }));

/** Returns the signed-in user's id, verifying the user row still exists (deleted accounts are logged out). */
export async function requireUserId(): Promise<string | null> {
  const s = await auth();
  const id = s?.user?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return u?.id ?? null;
}
