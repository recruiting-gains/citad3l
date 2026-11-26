"use client";
import { useEffect } from "react";
import {
  encodeFirstTouchCookieValue,
  externalReferrerHost,
  makeVisitorId,
  parseUtmFromSearch,
  UTM_COOKIE,
  UTM_COOKIE_MAX_AGE_SEC,
} from "@/lib/utm";
import { trackFunnelEvent } from "@/lib/events-client";

/**
 * Keeps `?ref=CODE` (`c3_ref`) and the first touch (`c3_utm`: `?utm_*` tags, referring site's host name, random id)
 * in first-party cookies for 30 days. First touch wins: an existing cookie is never replaced. Plain direct visits
 * set no cookie. Logs one anonymous "landing" per browser session (plus one per new tagged link).
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
      const refHost = externalReferrerHost(document.referrer, window.location.hostname);
      if ((utm || refHost) && !document.cookie.split("; ").some((c) => c.startsWith(`${UTM_COOKIE}=`))) {
        const val = encodeURIComponent(encodeFirstTouchCookieValue({ tags: utm, referrerHost: refHost, visitorId: makeVisitorId() }));
        document.cookie = `${UTM_COOKIE}=${val}; Max-Age=${UTM_COOKIE_MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}`;
      }

      // One landing per browser session, plus one for each new tagged link opened in it.
      const key = utm ? `c3_land:${utm.source ?? ""}:${utm.campaign ?? ""}:${utm.content ?? ""}` : "c3_land";
      if (!window.sessionStorage.getItem(key) && !(utm === null && window.sessionStorage.getItem("c3_land_any"))) {
        window.sessionStorage.setItem(key, "1");
        window.sessionStorage.setItem("c3_land_any", "1");
        trackFunnelEvent("landing", window.location.pathname, {
          src: utm?.source,
          med: utm?.medium,
          cmp: utm?.campaign,
          cnt: utm?.content,
          ref: refHost,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
