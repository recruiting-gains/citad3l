import { Inter_Tight, JetBrains_Mono } from "next/font/google";

export const fontSans = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-citadel-sans",
});

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-citadel-mono",
});
