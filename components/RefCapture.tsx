"use client";
import { useEffect } from "react";
import { encodeUtmCookieValue, parseUtmFromSearch, UTM_COOKIE, UTM_COOKIE_MAX_AGE_SEC } from "@/lib/utm";
import { trackFunnelEvent } from "@/lib/events-client";

/**
 * Keeps `?ref=CODE` (`c3_ref`) and `?utm_*` (`c3_utm`) from any landing page in first-party cookies for 30 days.
 * First touch wins: an existing cookie is never replaced.
 */
export default function RefCapture() {
  useEffect(() => {
    try {
      const search = window.location.search;
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      const rawRef = new URLSearchParams(search).get("ref");
      const code = rawRef?.trim().toLowerCase();
      if (code && /^[a-z0-9]{4,16}$/.test(code) && !document.cookie.split("; ").some((c) => c.startsWith("c3_ref="))) {
        document.cookie = `c3_ref=${code}; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
      }

      const utm = parseUtmFromSearch(search);
      if (utm) {
        if (!document.cookie.split("; ").some((c) => c.startsWith(`${UTM_COOKIE}=`))) {
          const val = encodeURIComponent(encodeUtmCookieValue(utm));
          document.cookie = `${UTM_COOKIE}=${val}; Max-Age=${UTM_COOKIE_MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}`;
        }
        const key = `c3_utm_ping:${window.location.pathname}:${utm.source ?? ""}:${utm.campaign ?? ""}`;
        if (!window.sessionStorage.getItem(key)) {
          window.sessionStorage.setItem(key, "1");
          trackFunnelEvent("utm_landing", window.location.pathname);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
