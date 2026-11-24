"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("turnstile_load_failed")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Cloudflare Turnstile, shown only when the server reports a site key (GET /api/turnstile-config).
 * Tokens are single-use: call reset() after every submit.
 */
export function useTurnstile(action: string) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  // Load Cloudflare's script only once the widget is near the viewport (keeps it off the home page's first load).
  const [nearView, setNearView] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/turnstile-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { siteKey?: string | null } | null) => { if (alive && d?.siteKey) setSiteKey(d.siteKey); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!siteKey || !boxRef.current || nearView) return;
    if (typeof IntersectionObserver === "undefined") { setNearView(true); return; }
    const el = boxRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNearView(true); io.disconnect(); }
    }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [siteKey, nearView]);

  useEffect(() => {
    if (!siteKey || !nearView || !boxRef.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: siteKey,
          action,
          theme: "auto",
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, nearView, action]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  const enabled = !!siteKey;
  const box = enabled ? <div ref={boxRef} className="turnstile-box" data-testid="turnstile" /> : null;
  return { enabled, token, ready: !enabled || !!token, reset, box };
}
