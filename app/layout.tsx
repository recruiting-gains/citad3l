import "./globals.css";
import type { Metadata, Viewport } from "next";
import TopNav from "@/components/TopNav";
import { fontSans, fontMono } from "./fonts";
import { currentUser, labelFor } from "@/lib/session";

export const metadata: Metadata = {
  title: "Citad3L — Strategic AI",
  description: "Citad3L is a strategic AI assistant for everyday questions, writing, code and research — with a sharp interest in AI advancement, robotics and AI security.",
  icons: { icon: "/brand/rook-mark.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Runs before first paint: applies saved theme (localStorage) or the OS preference, so there is no flash.
const THEME_BOOT = `(function(){try{var k="citad3l-theme",s=localStorage.getItem(k),t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0b0b0b":"#ffffff");}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser().catch(() => null);
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${fontSans.variable} ${fontMono?.variable ?? ""}`}>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <TopNav signedIn={!!u} userLabel={u ? labelFor(u) : undefined} />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
