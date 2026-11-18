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

## Privacy
No prompt or response content is logged by the app. Users can export (`/api/account/export`) or delete their account
(cascades all data; cancels Stripe subscription first when billing is configured).

## Design
Frontend creative direction and component code by **Anthropic Claude Opus 5.5** (`claude-opus-5-5`, called via the
Anthropic Messages API; see `design/opus/` for raw prompts/outputs and returned model ids). Visual reference screenshots in
`design/reference/`. Code, copy and art are original.
