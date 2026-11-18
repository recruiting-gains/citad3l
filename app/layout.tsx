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
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser().catch(() => null);
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono?.variable ?? ""}`}>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <TopNav signedIn={!!u} userLabel={u ? labelFor(u) : undefined} />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
