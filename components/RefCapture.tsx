"use client";
import { useEffect } from "react";

/**
 * Keeps a `?ref=CODE` from any landing page in a first-party cookie for 30 days, so the code survives until the
 * visitor signs up. First code wins: an existing cookie is never replaced. The server checks and locks it at signup.
 */
export default function RefCapture() {
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("ref");
      const code = raw?.trim().toLowerCase();
      if (!code || !/^[a-z0-9]{4,16}$/.test(code)) return;
      if (document.cookie.split("; ").some((c) => c.startsWith("c3_ref="))) return;
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `c3_ref=${code}; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
