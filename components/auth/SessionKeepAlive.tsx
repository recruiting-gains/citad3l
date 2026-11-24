"use client";

import { useEffect } from "react";

const KEY = "citad3l-session-touch";
/** Re-issue the session cookie about once a day while the tab is open. */
const TOUCH_EVERY_MS = 20 * 60 * 60 * 1000;

/**
 * Auth.js in Server Components drops Set-Cookie, so a Safari web-app cookie
 * would never get a fresh Max-Age. Hitting GET /api/auth/session once a day
 * re-signs the JWT and lets the auth route set the role's Max-Age.
 */
export default function SessionKeepAlive({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    if (!signedIn) return;
    try {
      const last = Number(localStorage.getItem(KEY) || "0");
      if (Number.isFinite(last) && Date.now() - last < TOUCH_EVERY_MS) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* private mode: still try once this mount */
    }
    void fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  }, [signedIn]);
  return null;
}
