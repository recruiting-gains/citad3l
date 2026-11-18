# Citad3L — Strategic AI assistant

Full-stack Next.js app: marketing site, streaming chat, saved conversations, projects, single-engine model page,
pricing, account/usage and Stripe TEST-mode billing. Engine: **Citad3L V1** = `huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF`
(base Qwen/Qwen3.8-27B, Apache-2.0), served by llama.cpp on a separate GPU host. Not affiliated with huihui-ai or Qwen.

> **Status:** local/private preview only. No live inference endpoint, Stripe keys, auth-provider keys, hosted Postgres or
> Fly app exist yet. The chat currently runs on an explicitly labelled **MOCK provider** ("Mock provider – not live inference"
> badge in the UI). The mock is refused when `NODE_ENV=production`.

## Architecture (plain words)
- **Web/API (Fly.io target):** one Next.js 15 (App Router, React 19, TypeScript) service. Pages render on the server;
  chat streams over a server route (`POST /api/chat`, Server-Sent Events). All secrets stay server-side.
- **Inference (separate GPU host):** OpenAI-compatible endpoint (llama.cpp `llama-server`). The server adapter
  (`lib/inference/index.ts`) calls `INFERENCE_BASE_URL/chat/completions` with `INFERENCE_API_KEY`; the browser never sees it.
- **Database:** Postgres via Prisma with migrations (`prisma/migrations`). Every query is scoped by the signed-in user's id.
- **Auth:** Auth.js (NextAuth v5) with Prisma adapter; GitHub / Google / Resend email providers switch on when their env
  keys exist. A **dev-only demo login** (email only) exists for local review and is never registered in production.
  (Clerk was not used because no Clerk keys exist; Auth.js keeps auth self-hosted.)
- **Usage limits:** each reply first *reserves* one unit inside a DB transaction that locks the user's entitlement row
  (`SELECT … FOR UPDATE`), so parallel requests can't overspend. Success → charged; error/stop → released (never charged).
  Trial = 5 successful replies once. Pro = `PRO_MONTHLY_UNITS` replies/month (default 600, **configurable — load-test before
  sale**). Max = 2.5× Pro. Per-user concurrency (2 streams) and rate limits (20/min) apply.
- **Billing:** Stripe Checkout + Customer Portal + signature-verified, idempotent webhooks (`StripeEvent` ledger).
  Handles checkout completion, subscription updates (incl. cancel-at-period-end), payment failure (→ past_due, blocked),
  invoice paid (new period → usage reset) and deletion (→ back to trial pool). Live keys (`sk_live_`) are refused.

## Run locally
```bash
cd /workspace/citad3l
npm install
# Postgres: any local Postgres works. On this box we use the project-local embedded binary:
P=node_modules/@embedded-postgres/linux-x64/native/bin
[ -d .local/pgdata ] || $P/initdb -D .local/pgdata -U citad3l --auth=trust -E UTF8
$P/pg_ctl -D .local/pgdata -o "-p 5433 -k /tmp -c listen_addresses=127.0.0.1" -l .local/pg.log start
createdb -h 127.0.0.1 -p 5433 -U citad3l citad3l 2>/dev/null || true
cp .env.example .env   # then set DATABASE_URL=postgresql://citad3l@127.0.0.1:5433/citad3l, AUTH_SECRET, DEMO_LOGIN_ENABLED=true, INFERENCE_PROVIDER=mock
npx prisma migrate deploy
npm run dev            # http://localhost:3210  → Log in → "Development demo login"
```

## Tests
```bash
npx vitest run tests/guards.test.ts                       # unit: prod guards, Stripe live-key refusal, adapter vs local stub
npm run dev &                                             # integration tests need the dev server + Postgres
npx vitest run tests/integration.test.ts                  # isolation, streaming, stop/retry, concurrency, webhooks, deletion
node scripts/screens.mjs                                  # screenshots → evidence/screenshots
node scripts/keyboard.mjs && node scripts/theme-check.mjs # keyboard + theme checks (dark screenshots)
```

## Connect real services
| Need | Variables |
|---|---|
| Inference (GPU host, see `inference/README.md`) | `INFERENCE_PROVIDER=openai`, `INFERENCE_BASE_URL`, `INFERENCE_MODEL`, `INFERENCE_API_KEY` |
| Stripe TEST | `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO` ($20/mo), `STRIPE_PRICE_MAX` ($50/mo); webhook URL `/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` |
| Auth | `AUTH_SECRET` + at least one of GitHub / Google / Resend keys |
| Database | `DATABASE_URL` (Fly Postgres, Neon, Supabase…) |

## Deploy to Fly (NOT done — template only)
```bash
fly apps create citad3l-<name>            # edit fly.toml app name first
fly secrets set DATABASE_URL=… AUTH_SECRET=… INFERENCE_BASE_URL=… INFERENCE_API_KEY=… STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… STRIPE_PRICE_PRO=… STRIPE_PRICE_MAX=… APP_URL=…
fly deploy                                # release_command runs prisma migrate deploy
```
Multi-instance note: the per-minute rate limiter is in-process; usage limits/concurrency are enforced in Postgres and are
safe across instances. Move the rate limiter to Postgres/Redis before scaling out.

## Theme
White (default) and black themes on every page. Toggle in the top nav (desktop + phone) and Light/Dark/System in Account → Appearance.
Choice is stored in `localStorage["citad3l-theme"]`; first visit follows `prefers-color-scheme`. An inline script in `app/layout.tsx`
sets `data-theme` before first paint (no flash). Dark palette designed by Opus 5.5 (`app/globals.css`, section `round4-dark`).

## Brand asset
The owner's original rook PNG was not available on the box during this build, so `components/Rook.tsx` is an original SVG rook
drawn by Opus. To use the owned rook: add it as `public/brand/rook.png` and swap the SVG for `<img src="/brand/rook.png">` in `Rook.tsx`.

## Privacy
No prompt or response content is logged by the app. Users can export (`/api/account/export`) or delete their account
(cascades all data; cancels Stripe subscription first when billing is configured).

## Design
Frontend creative direction and component code by **Anthropic Claude Opus 5.5** (`claude-opus-5-5`, called via the
Anthropic Messages API via `design/opus/call_opus.py`; raw prompts/outputs in `design/opus/`, returned model ids in `design/opus/MODEL_LOG.md`). Visual reference screenshots in
`design/reference/`. Code, copy and art are original.

## Cloudflare Workers deployment (public preview)

Live: https://citad3l.recruiting-gains.workers.dev (workers.dev only, no custom domain or DNS; `noindex` set by both the meta tag and the `X-Robots-Tag` header, and robots.txt disallows everything).

Built with `@opennextjs/cloudflare` (`open-next.config.ts`, `wrangler.jsonc`, worker name `citad3l`, free plan features only).

```bash
mv .env /tmp/citad3l.env.aside   # keep dev secrets/flags out of the bundle
npm run cf:build                  # opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
mv /tmp/citad3l.env.aside .env && rm -rf .next   # the build overwrites .next; restart `npm run dev`
```

Secrets are set only with `wrangler secret put` (never in wrangler.jsonc). Currently set: `AUTH_SECRET` (random, never printed).

**Works live:** home, pricing, models, model page, login, terms, privacy, robots.txt, both themes, noindex.
**Gated (by design):** chat, projects and account redirect to `/login`, which says sign-in isn't open yet. APIs return 401. `/api/health` returns 503 `db:false`. Demo login and the mock provider are refused in production.

### Turning chat on
1. **Database:** a hosted Postgres URL (Neon free tier, for example; or Cloudflare Hyperdrive in front of any Postgres). Run `DATABASE_URL=... npx prisma migrate deploy`, then `npx wrangler secret put DATABASE_URL`. The Prisma client uses the `@prisma/adapter-pg` driver adapter (no Rust engine). Under real load on Workers, create a client per request or use Hyperdrive.
2. **Sign-in:** at least one provider. Options are `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, or `AUTH_RESEND_KEY` + `AUTH_EMAIL_FROM`. Set the OAuth callback to `https://citad3l.recruiting-gains.workers.dev/api/auth/callback/<provider>`.
3. **Inference:** an OpenAI-compatible endpoint serving Huihui-Qwen3.8-27B-abliterated-GGUF (see `inference/`). Set `INFERENCE_BASE_URL` and `INFERENCE_MODEL` as secrets, plus `INFERENCE_API_KEY` if the endpoint needs one.
4. **Billing (optional, TEST mode only):** `STRIPE_SECRET_KEY` (sk_test_), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`. On Workers the webhook route must switch to `stripe.webhooks.constructEventAsync` (Web Crypto) before you enable it.
5. Redeploy.

### Rollback / removal
```bash
npx wrangler deployments list --name citad3l
npx wrangler rollback --name citad3l          # previous version
npx wrangler delete citad3l                   # remove the Worker entirely
```
