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
| `screenshots/side-by-side/` | Reference (left) vs Citad3L (right): home, pricing (top + full), chat, phone home/pricing. |
| `screenshots/round1`, `round2` | Earlier design iterations sent back to Opus for review. |
