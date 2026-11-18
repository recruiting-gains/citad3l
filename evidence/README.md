# Citad3L evidence (generated 2026-11-17, America/Chicago)

| File | What it shows |
|---|---|
| `test-run-final.txt` | Vitest: 25/25 passing — 6 unit (prod guards, live-key refusal, 2.5× Max, OpenAI-compatible adapter vs local stub) + 19 integration against the running dev server and real Postgres (auth required, mock label, 8k input limit, streaming meta→delta→done, stop mid-stream = not charged + retry, provider failure not charged, projects, cross-user isolation on every resource incl. chat into others' conversation/project, export, delete, 20-parallel trial & Pro limit with exactly 1 success, Max = 2.5×, Stripe signature rejection, checkout.session.completed + duplicate replay idempotent, cancel_at_period_end, payment_failed → blocked, invoice.paid new period → reset, subscription.deleted → trial, checkout w/o keys → billing_not_configured, success/cancel return pages, account deletion cascade). |
| `test-run-1.txt` | First full green run. |
| `keyboard-nav.txt` | Real-browser keyboard checks: skip link, nav tab order, focus ring, Shift+Enter, Enter sends, Esc stops, phone menu open/close by keyboard. |
| `theme-check.txt` | Theme: OS dark respected on first visit before hydration (no flash), OS light, toggle persists (localStorage), keyboard toggle, no errors. |
| `prod-guard-smoke.txt` | `NODE_ENV=production` build with `INFERENCE_PROVIDER=mock` + `DEMO_LOGIN_ENABLED=true` deliberately set: mock refused ("Inference not configured"), demo provider absent and callback refused, no session, chat 401, security headers. |
| `prod-pageerrors.txt` | Production build: 30 public page loads (desktop+phone), 0 uncaught errors. |
| `prod-build.txt` | `next build` output (production). |
| `screenshot-run.txt` | Screenshot run log (the dev server occasionally throws a transient "Invalid or unexpected token" chunk error on first load; the script reloads and reports it — not reproducible on the production build). |
| `screenshots/` | Final light-mode desktop (1440) + phone (390): home, pricing, models, model, login, chat empty/streaming/answer, projects, account, limit-reached, account at limit. |
| `screenshots/dark/` | Dark mode: home, pricing, model, chat empty/answer, account — desktop + phone. |
| `screenshots/round1`, `round2` | Earlier design iterations sent back to Opus for review. |

## Cinematic media (round 5)
- **Live screenshots (authoritative):** `screenshots/live/{home,engine,models,model,pricing}_{light,dark}_{desktop,phone}.png` plus `home_reduced-motion_desktop.png`.
  - Playback state for each one is in `live-media-shots.json`: every in-view clip playing, 0 page errors, and reduced motion mounting 0 videos with 5 posters.
- **Local dev screenshots:** `screenshots/media/`. The Next dev server's known transient chunk errors sometimes stop hydration, so a few of these show posters instead of playing video. The production build has no such errors.
- **Live verification:** `live-media-verify.txt` covers route status, noindex, media MIME types and sizes, Range 206 after the fix, and the client JS secret scan.
- **Demo:** `live_demo.mp4` is a 25.6 s screen recording of the live homepage: scroll, card hover, engine strip, then dark-theme toggle. The H.264 MP4 path was also checked playing in Chrome.
- **Tests:** `test-run-media.txt` (25/25).

## iOS / Safari fix (deploy 718332f0, 2026-11-17 ~21:35 CST)
- `device-check-before.txt` and `device-check-after.txt` are live checks in WebKit (iPhone 13 profile), Chrome desktop and Chrome Pixel 7, light and dark, on home, pricing and model. They record page errors, console errors, failed requests, 4xx/5xx, TTFB, FCP, load time, CLS, overflow and video playback. Raw data is in `device-check-*.json`; screenshots are in `screenshots/device/{before,after}_*`.
- `fallback-check.txt`: WebKit with all video requests blocked keeps the poster with no errors; reduced motion shows the poster only.
- `mp4-probe.txt`: every MP4 is H.264 Main@4.0, yuv420p, moov before mdat (faststart), no audio.
- `live-ios-fix-verify.txt`: routes, noindex, Range 206 and the served MP4 profile.
- WebKit on Linux needed extra libraries that apt couldn't fetch (the proxy blocks the Debian mirror). They were extracted from Debian .debs into the Playwright WebKit bundle. Run with `GIO_EXTRA_MODULES=/home/box/.cache/wkgio GST_PLUGIN_PATH=/home/box/.cache/wkgst/usr/lib/x86_64-linux-gnu/gstreamer-1.0`.
