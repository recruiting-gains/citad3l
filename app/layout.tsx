import "./globals.css";
import type { Metadata, Viewport } from "next";
import TopNav from "@/components/TopNav";
import CommandPalette from "@/components/CommandPalette";
import { isAdminEmail } from "@/lib/config";
import { referralProgramVisible } from "@/lib/referrals";
import { fontSans, fontMono } from "./fonts";
import { visibleModels } from "@/lib/models";
import { currentUser, labelFor } from "@/lib/session";
import SessionKeepAlive from "@/components/auth/SessionKeepAlive";
import RefCapture from "@/components/RefCapture";

export const metadata: Metadata = {
  title: "Citad3L — Private AI. Fast answers.",
  description: "Private AI with fast answers. No ads, no training on your chats. Try Citad3L V1 Fast free with no signup, or sign in for Private mode.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Citad3L",
    statusBarStyle: "black",
  },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#000000" };

// Runs before first paint: applies saved theme (localStorage) or the OS preference, so there is no flash.
const THEME_BOOT = `(function(){try{var k="citad3l-theme",s=localStorage.getItem(k),t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser().catch(() => null);
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${fontSans.variable} ${fontMono?.variable ?? ""}`}>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Citad3L" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <TopNav signedIn={!!u} userLabel={u ? labelFor(u) : undefined} isOwner={!!u && isAdminEmail(u.email)} showReferral={referralProgramVisible()} />
        <CommandPalette signedIn={!!u} isOwner={!!u && isAdminEmail(u.email)} models={visibleModels()} />
        <SessionKeepAlive signedIn={!!u} />
        <RefCapture />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
