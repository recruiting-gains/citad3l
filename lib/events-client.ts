export type FunnelEventName =
  | "utm_landing"
  | "guest_message_sent"
  | "soft_save_shown"
  | "soft_save_clicked"
  | "image_upgrade_shown"
  | "image_upgrade_clicked"
  | "referral_public_viewed";

/** Fire-and-forget, privacy-friendly funnel event (never throws, sends no prompt text or PII). */
export function trackFunnelEvent(event: FunnelEventName, path?: string): void {
  try {
    const cleanPath = (path ?? window.location.pathname ?? "/").replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 80) || "/";
    const body = JSON.stringify({ event, path: cleanPath });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
    void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}
