# Role
You are the creative lead and senior frontend engineer for **Citad3L**, a new product. You have full creative authority over the frontend: composition, type scale, spacing, palette, motion, component styling. I (the integrating engineer) own the backend and will wire your components in exactly as you write them. Write production-quality React/TypeScript.

# Product
Citad3L is a general-purpose AI assistant with a **Strategic AI** identity — curious about AI advancement, robotics and AI cybersecurity — while still serving everyday questions, writing, coding, learning and research. Exactly ONE engine: **Citad3L V1**, which is the open-weights model *Huihui-Qwen3.8-27B-abliterated-GGUF* by huihui-ai (Hugging Face: https://huggingface.co/huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF), base model Qwen/Qwen3.8-27B (Apache-2.0). Facts you may display: ~27.8B parameters, context 262,144 tokens, GGUF quantizations served via llama.cpp, inputs: text. HF stats as of today: 4.29M downloads, 2.28K likes (label them "Hugging Face, Nov 2026"). Attribution must be accurate: Citad3L V1 = product name for that model as served by Citad3L; not affiliated with huihui-ai or Qwen.
Brand mark: a **rook** (chess castle piece). The owner's original rook PNG will be dropped in at `/brand/rook.png` later; for now create `components/Rook.tsx`, an original crisp SVG rook mark (props: size, className) that reads well at 18px in the nav and at 64px as a hero/empty-state emblem. Wordmark: "Citad3L" (keep the 3).
Plans: **Trial** $0 once — 5 successful replies, no card. **Pro** $20/month — monthly allowance (units configurable). **Max** $50/month — 2.5× Pro allowance. Same engine and same features on every plan; Max only adds allowance. Failed replies are never charged. Allowance resets monthly on the billing date.

# Visual reference (primary): the attached screenshots
The owner wants **near 1:1 visual likeness** to the attached reference site in layout, proportions, whitespace, typography feel, navigation, light/dark treatment, composer and pricing presentation. Measured from the reference: body 14px/20.3px, text rgb(20,20,20) on #fff, display H1 80px weight 500 letter-spacing -0.03em (≈-2.4px), chat greeting 44px, model title 24–28px, pill buttons (black primary, light-grey secondary), hairline borders, 8–12px radii cards, tiny secondary text, grid of 6 small feature tiles under the hero, "Featured" carousel cards with dark media, black "Most popular" Pro card in a 3-column pricing grid, chat page with left sidebar (search, New chat, Projects, Recents) and centered greeting + rounded grey composer with send button, model detail page with left info column (stats cards) and right panel.
HARD RULES: write **original** code and copy. Do NOT reproduce their name, logo, emblem, images, video, or wording; do not use the words "Ghost" or "Sapient" anywhere; no implied affiliation. Their font (PP Neue Montreal) is commercial — pick a free near-equivalent via `next/font/google` (e.g. Inter Tight, Geist, Manrope — your call). Where they use photographic media cards, use original CSS/SVG art (gradients, grids, wireframe rook, circuit/radar motifs fitting "strategic AI, robotics, cybersecurity") — no stock images.
The owner also had two of their own concept mockups (homepage, chat workspace) but they are not available to me right now; the live reference takes priority anyway.

# Tech + contracts (must follow exactly so I can integrate)
Next.js 15 App Router, React 19, TypeScript strict. Styling: write ONE global stylesheet `app/globals.css` with CSS custom properties + semantic class names (Tailwind v4 is installed via `@import "tailwindcss";` — you may use utility classes too, but the core design system should live in globals.css). Path alias `@/` = project root. Available packages: next, react, next-auth@5 (`next-auth/react` signIn/signOut), react-markdown, remark-gfm, rehype-highlight. No other UI libraries. Icons: inline SVG you write (put them in `components/icons.tsx`).

Shared types — put them in `lib/types.ts` exactly like this (you may add, not remove):
```ts
export type PlanId = "trial" | "pro" | "max";
export interface UsageSummary { plan: PlanId; status: "active"|"trialing"|"past_due"|"canceled"|"none"; used: number; limit: number; remaining: number; resetAt: string | null; cancelAtPeriodEnd: boolean; unitLabel: string; }
export interface ProviderInfo { mock: boolean; label: string; model: string; }
export interface PlanCard { id: PlanId; name: string; priceUsd: number; blurb: string; allowance: string; features: string[]; cta: string; highlight?: boolean; }
export interface ConversationListItem { id: string; title: string; projectId: string | null; updatedAt: string; }
export interface ChatMessage { id: string; role: "user"|"assistant"; content: string; status: "complete"|"streaming"|"error"|"stopped"; createdAt: string; }
export interface Project { id: string; name: string; instructions: string; updatedAt: string; conversationCount: number; }
```
Backend API (already built by me; call with fetch, same-origin, JSON):
- `POST /api/chat` body `{ conversationId?: string, projectId?: string, message: string, retryAssistantMessageId?: string }` → `text/event-stream`. Events are lines `event: <name>\ndata: <json>\n\n`: `meta` `{conversationId, userMessageId, assistantMessageId, title}`; `delta` `{text}`; `done` `{usage: UsageSummary}`; `error` `{code: "limit_reached"|"unauthorized"|"too_large"|"rate_limited"|"busy"|"provider_unavailable"|"internal", message, usage?: UsageSummary}`. Non-2xx JSON responses `{error:{code,message}}` can also happen before streaming starts (401, 402 limit_reached, 413, 429). Aborting the fetch (AbortController) stops generation; the server marks the message "stopped" and does not charge. Retry = send `retryAssistantMessageId` of a failed/stopped/complete assistant message with the same conversationId (message may be empty string) — server regenerates that turn.
- `GET /api/conversations?projectId=<id>` → `{conversations: ConversationListItem[]}`; `GET /api/conversations/:id` → `{conversation:{id,title,projectId}, messages: ChatMessage[]}`; `PATCH /api/conversations/:id` `{title?, projectId?}`; `DELETE /api/conversations/:id`.
- `GET /api/projects` → `{projects: Project[]}`; `POST /api/projects` `{name, instructions}` → `{project}`; `PATCH /api/projects/:id`; `DELETE /api/projects/:id`.
- `GET /api/usage` → `{usage: UsageSummary}`; `GET /api/provider` → `{provider: ProviderInfo}`.
- `POST /api/billing/checkout` `{plan:"pro"|"max"}` → `{url}` (or `{error}` with code `billing_not_configured`); `POST /api/billing/portal` → `{url}` / `{error}`.
- `GET /api/account/export` → JSON download; `DELETE /api/account` → deletes account (confirm first, then `signOut({callbackUrl:"/"})`).
- Auth: `signIn("demo", { email, callbackUrl })` for the dev-only demo login (only render when `demoEnabled`), `signIn("github"|"google"|"resend", ...)` for real providers listed in `providers` prop. `signOut()`.
Input limit: 8,000 characters per message (show a counter near the limit, block send above it).

# THIS CALL (part A of 2)
The owner has confirmed the reference site's owner is OK with close visual likeness: aim for near 1:1 likeness (original code, Citad3L name/rook/copy).
In this call write: DESIGN NOTES, `app/globals.css` (the COMPLETE design system covering ALL screens listed below, including chat workspace, markdown/code, projects, account, login classes, so part B can just use your classes), `app/fonts.ts`, `lib/types.ts`, `components/icons.tsx`, `components/Rook.tsx`, `components/TopNav.tsx`, `components/MockBadge.tsx`, `components/LimitReached.tsx`, `components/marketing/HomeView.tsx`, `components/marketing/PricingView.tsx`, `components/model/ModelView.tsx`, `components/model/ModelsIndexView.tsx`, `components/Footer.tsx`. Append at the end a section `CLASS MAP FOR PART B` listing the class names (with one-line purpose) part B must use for chat/projects/account/login.
In part B (a later call) you will write ChatWorkspace, Markdown, ProjectsView, AccountView, LoginView.

# Full screen inventory (for reference)
 (presentational/client components; I write the thin server page wrappers that fetch data and pass props)
1. `app/globals.css` — full design system (tokens, typography scale, buttons, pills, cards, nav, hero, tile grid, featured cards, pricing grid, chat layout/sidebar/composer/messages/markdown/code blocks, model page, projects, account, usage meter, toasts, badges, states, skeletons, focus-visible rings, reduced-motion, responsive breakpoints for 390px phones).
2. `app/fonts.ts` — next/font/google setup exporting `fontSans` (and optional `fontMono`) with `.variable`.
3. `lib/types.ts` (as above).
4. `components/icons.tsx`, `components/Rook.tsx`.
5. `components/TopNav.tsx` — client; props `{ signedIn: boolean; userLabel?: string; }`; uses `usePathname()` for active pill; desktop links: Explore (/), Chat (/chat), Models (/models), Projects (/projects), Pricing; right: search icon (links /chat), projects icon, Log in / Get started (or account avatar → /account when signed in). Phone: wordmark + search + hamburger opening a sheet menu. Keyboard accessible.
6. `components/MockBadge.tsx` — props `{ provider: ProviderInfo }`; when `provider.mock` render a clearly visible amber pill "Mock provider – not live inference" (exact text, en dash) with a tooltip/title explaining canned output; render nothing when not mock.
7. `components/marketing/HomeView.tsx` — props `{ signedIn: boolean; provider: ProviderInfo }`. Hero (rook chip cluster in place of their logo chips — e.g. small rounded tiles with original glyphs for the three interests: AI, robotics, security — your design), sub-copy, two pill CTAs (Start chatting → /chat, See plans → /pricing), 6 feature tiles (Chat, Model, Projects, Usage, Account, Workflows "Coming soon"), a "Featured" row of 3 dark media cards made with original CSS/SVG art (e.g. "Strategic briefings", "Robotics", "AI security"), a "Citad3L V1" model strip, a short "How it works / Plans" teaser, and a footer. Original copy in a confident, strategic voice. No fake user counts (do not invent "416 online" style numbers).
8. `components/marketing/PricingView.tsx` — props `{ plans: PlanCard[]; signedIn: boolean; currentPlan?: PlanId | null; billingConfigured: boolean }`. Hero, "All plans" header row, 3 cards (Pro highlighted black, "Most popular"), CTA buttons: trial → /chat (or /login), pro/max → POST checkout then `window.location = url`; if not signed in go to `/login?next=/pricing`; if billing not configured show an inline note "Test-mode billing not configured yet". Feature rows with check marks, usage dots, FAQ / fine print about resets and failures not counting.
9. `components/model/ModelView.tsx` — props `{ provider: ProviderInfo; signedIn: boolean }` — the single engine page modelled on the reference model detail layout: left column (art header, title "Citad3L V1", "Huihui-Qwen3.8-27B-abliterated · by huihui-ai", tag pills, description, stats cards, model facts table, attribution box with links to the HF repo and base model, license Apache-2.0, "Not affiliated" note), right panel with CTA to chat. Also `components/model/ModelsIndexView.tsx` (props same) — /models page listing the single model card linking to /models/citad3l-v1.
10. `components/chat/ChatWorkspace.tsx` — client; props `{ initialConversationId?: string | null; initialProjectId?: string | null; userLabel: string; provider: ProviderInfo; initialUsage: UsageSummary }`. Left sidebar (search filter, New chat, Projects list with New project, Recents list grouped, delete), collapsible on desktop, off-canvas on phone. Empty state: rook emblem + time-of-day greeting ("Good evening, <name>") + big composer + suggestion chips leaning into the identity (AI advancement, robotics, AI cybersecurity, plus everyday). Conversation view: messages (user bubbles right, assistant full-width markdown with code highlighting + copy-code button), copy message, retry on assistant messages (and on error/stopped), Stop button while streaming, auto-scroll w/ "jump to latest", composer at bottom (Enter sends, Shift+Enter newline, Esc stops), usage meter chip ("3 of 5 trial replies left"), MockBadge near composer, project chip. States: loading skeleton, empty, error banner with retry, disconnected (navigator offline + stream network failure → "Connection lost" with retry), limit reached (inline upgrade card linking /pricing, composer disabled), rate limited/busy toast. Update URL to `/chat/<id>` with `history.replaceState` after `meta`. Parse SSE incrementally from `res.body.getReader()`.
11. `components/chat/Markdown.tsx` — react-markdown + remark-gfm + rehype-highlight with code block header (language + copy button). Include a highlight.js-style token theme in globals.css (original colors).
12. `components/projects/ProjectsView.tsx` — client; list/create/edit (name + instructions textarea)/delete projects, each card shows conversation count and opens `/chat?project=<id>`; empty state. Props `{ initialProjects: Project[] }`.
13. `components/account/AccountView.tsx` — client; props `{ userLabel: string; email: string; usage: UsageSummary; billingConfigured: boolean; provider: ProviderInfo }`: plan card, usage meter with reset date, cancel-at-period-end / past_due notices, Manage billing (portal) / Upgrade buttons, Export data, Delete account (typed confirmation), Sign out.
14. `components/auth/LoginView.tsx` — client; props `{ demoEnabled: boolean; providers: {id:string; name:string}[]; next?: string }` — centered card in the reference's style; demo login form (email) clearly labeled "Development demo login — disabled in production".
15. `components/LimitReached.tsx` — reusable upgrade card (props `{ usage: UsageSummary }`).

# Output format (strict)
First a short `DESIGN NOTES` section (≤40 lines): your decisions on composition, type scale, spacing scale, palette, motion, and the identity changes you made versus the reference. Then every file as:
=== FILE: <relative/path> ===
<full file contents>
=== END FILE ===
No ellipses, no placeholders like "rest unchanged" — complete files only. Keep it tight: prefer shared classes in globals.css over repetition.


# THIS CALL (part A3): components only
Your DESIGN NOTES and the `app/globals.css` you already wrote are below (the chat/markdown/projects/account section is being finished separately — do NOT write CSS now; use the classes that exist; if you truly need a tiny extra rule, put it in a `=== FILE: app/extra-a3.css ===` file which I will append).
<<<NOTES
## DESIGN NOTES

**Composition.** I kept the reference's skeleton nearly 1:1:
- 60px sticky hairline nav with pill-highlighted active link.
- Centered display hero with an inline logo-chip cluster.
- Two pill CTAs (black primary, light-grey secondary).
- A 6-up tile row, a "Featured" carousel of dark 1.6:1 media cards, a model strip, steps, a plans teaser, and a column footer with a giant clipped wordmark.
- Pricing uses three cards with the middle (Pro) inverted to ink.
- Model detail is a 360px left info column plus a centered right panel.
- Chat is a 272px sidebar plus a centered greeting and grey rounded composer.

**Type.** Inter Tight (free, close in proportion to the reference's grotesk) is the sans and JetBrains Mono is the mono.
- `fonts.ts` exposes `--font-citadel-sans` and `--font-citadel-mono`. Put `${fontSans.variable} ${fontMono.variable}` on `<html>`.
- Scale: 11 / 12 / 13 / 14 (body, 1.45 ≈ 20.3px) / 15 / 17 / 20 / 24 / 32 / 44.
- Display is `clamp(44px, 4.2vw + 20px, 80px)`, weight 500, tracking −0.03em.
- Greeting is 44px (32px on phones); model title 26px; section titles 32px.

**Spacing.** 4-pt scale (4 8 12 16 20 24 32 40 48 64 96). Page gutter is 32px, or 16px at ≤640px. Container is 1376px plus gutters. Radii: 8 / 12 / 16 / 20, and pills are 999.

**Palette.** Monochrome like the reference:
- Ink `rgb(20,20,20)` on `#fff`.
- Secondary text `#5e5e5e`, tertiary `#8b8b8b`.
- Hairlines `#eee` / `#e4e4e4`; surfaces `#f2f2f2` / `#e9e9e9`.
- Status: green live dot, amber for the mock and limit warnings, red for errors.

Identity colour lives only in the art and chip glyphs: deep navy `#05070b`, signal cyan `#5ee6d0`, violet `#8d7cff`, amber `#ffb547`. That's my "strategic console" layer.

**Motion.** 120 / 200 / 320ms with ease `cubic-bezier(.2,.7,.2,1)`. Buttons press to 0.98, cards lift subtly, and the sheet and dialogs fade or slide. The art has a slow radar sweep, blinking blips, flowing circuit dashes and a scan line. Everything collapses under `prefers-reduced-motion`.

**Identity changes vs. the reference.**
- **Rook mark** replaces their logo, with a solid silhouette and arrow-slit cut-out that stays crisp at 18px.
- **Hero chips** are original glyph tiles for AI, robotics, security and the rook.
- **Media art** is original SVG: radar, robot arm, circuit shield, terminal and a wireframe rook. No photography is used.
- **No presence counts.** Media tags are topic labels, and the model's Hugging Face stats carry a source label.
- **Pricing** has no ✕ rows, since every plan has the same features. Dots encode relative allowance: Trial 1, Pro 2, Max 5, which is exactly 2.5× Pro.
- **Max** shows a static "2.5× Pro" chip instead of a multiplier toggle.

**Integration notes.**
- **Two small extra files:** `components/Art.tsx` holds the shared SVG art and chips. `lib/engine.ts` holds the model facts, the 8,000-character limit and a date formatter.
- **Export style:** every component has both a named and a default export.
- **Footer legal links:** the footer links to `/terms` and `/privacy`.
- **Utility overrides:** tokens live in `@layer base` and classes in `@layer components`, so Tailwind utilities can still override them.


NOTES>>>
<<<CSS
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-citadel-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: var(--font-citadel-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* =========================================================
   1. TOKENS + BASE
   ========================================================= */
@layer base {
  :root {
    --bg: #ffffff;
    --fg: rgb(20 20 20);
    --fg-2: #5e5e5e;
    --fg-3: #8b8b8b;
    --fg-4: #b8b8b8;
    --line: #eeeeee;
    --line-2: #e4e4e4;
    --line-3: #d4d4d4;
    --surface: #f2f2f2;
    --surface-2: #e9e9e9;
    --surface-3: #f8f8f8;
    --ink: #141414;
    --ink-2: #262626;
    --ink-3: #333333;
    --ink-line: #2c2c2c;
    --on-ink: #ffffff;
    --on-ink-2: #a3a3a3;

    --live: #22c55e;
    --ok-fg: #15803d;
    --ok-bg: #ecfaf1;
    --amber-fg: #8a5300;
    --amber-bg: #fff4dc;
    --amber-line: #f2d08a;
    --amber-solid: #d48806;
    --danger: #c2341b;
    --danger-fg: #7a2112;
    --danger-bg: #fdf0ed;
    --danger-line: #f3c7bd;

    --art-0: #05070b;
    --art-1: #0e1520;
    --art-cyan: #5ee6d0;
    --art-violet: #8d7cff;
    --art-amber: #ffb547;

    --t-xs: 11px;
    --t-sm: 12px;
    --t-13: 13px;
    --t-base: 14px;
    --t-md: 15px;
    --t-lg: 17px;
    --t-xl: 20px;
    --t-2xl: 24px;
    --t-3xl: 32px;
    --t-4xl: 44px;
    --t-display: clamp(44px, 4.2vw + 20px, 80px);

    --r-xs: 6px;
    --r-sm: 8px;
    --r-md: 12px;
    --r-lg: 16px;
    --r-xl: 20px;
    --r-pill: 999px;

    --shadow-chip: 0 1px 2px rgba(0, 0, 0, 0.06), 0 6px 16px rgba(0, 0, 0, 0.08);
    --shadow-pop: 0 16px 48px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06);
    --shadow-soft: 0 2px 12px rgba(0, 0, 0, 0.05);

    --nav-h: 60px;
    --container: 1376px;
    --gutter: 32px;
    --sidebar-w: 272px;
    --thread-w: 760px;

    --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
    --dur-1: 120ms;
    --dur-2: 200ms;
    --dur-3: 320ms;
  }

  html {
    color-scheme: light;
    font-family: var(--font-sans);
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    scroll-padding-top: calc(var(--nav-h) + 16px);
  }

  body {
    margin: 0;
    min-height: 100dvh;
    background: var(--bg);
    color: var(--fg);
    font-size: var(--t-base);
    line-height: 1.45;
    letter-spacing: -0.003em;
  }

  ::selection { background: rgba(20, 20, 20, 0.12); }
  a { color: inherit; text-decoration: none; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; }

  :focus-visible {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
    border-radius: 6px;
  }

  @media (max-width: 640px) {
    :root { --gutter: 16px; }
  }
}

/* =========================================================
   2. COMPONENTS
   ========================================================= */
@layer components {

  /* ---------- Layout ---------- */
  .container {
    width: 100%;
    max-width: calc(var(--container) + var(--gutter) * 2);
    margin-inline: auto;
    padding-inline: var(--gutter);
  }
  .container-narrow { max-width: calc(1144px + var(--gutter) * 2); }
  .page-main { min-height: calc(100dvh - var(--nav-h)); }
  .section { padding-block: 48px; }
  .section-lg { padding-block: 72px; }
  .stack { display: flex; flex-direction: column; gap: 12px; }
  .row { display: flex; align-items: center; gap: 8px; }
  .spacer { flex: 1; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .hairline { border: 0; border-top: 1px solid var(--line); margin: 0; }

  /* ---------- Typography ---------- */
  .display {
    font-size: var(--t-display);
    line-height: 1.04;
    font-weight: 500;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }
  .h1 { font-size: var(--t-4xl); line-height: 1.05; font-weight: 500; letter-spacing: -0.035em; }
  .h2 { font-size: var(--t-3xl); line-height: 1.1; font-weight: 500; letter-spacing: -0.035em; }
  .h3 { font-size: var(--t-xl); line-height: 1.2; font-weight: 500; letter-spacing: -0.02em; }
  .h4 { font-size: var(--t-md); line-height: 1.3; font-weight: 500; letter-spacing: -0.01em; }
  .lead { font-size: 18px; line-height: 1.5; color: var(--fg-2); letter-spacing: -0.01em; }
  .text-2 { color: var(--fg-2); }
  .text-3 { color: var(--fg-3); }
  .tiny { font-size: var(--t-sm); line-height: 16px; color: var(--fg-3); }
  .micro { font-size: var(--t-xs); line-height: 14px; color: var(--fg-3); }
  .mono { font-family: var(--font-mono); }
  .tnum { font-variant-numeric: tabular-nums; }
  .link { text-decoration: underline; text-decoration-color: var(--line-3); text-underline-offset: 3px; transition: text-decoration-color var(--dur-1); }
  .link:hover { text-decoration-color: currentColor; }
  .kbd {
    font-family: var(--font-mono); font-size: 11px; line-height: 1;
    padding: 2px 5px; border: 1px solid var(--line-2); border-radius: 5px;
    background: var(--surface-3); color: var(--fg-2);
  }

  /* ---------- Buttons ---------- */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 40px; padding: 0 18px;
    border-radius: var(--r-pill); border: 1px solid transparent;
    font-size: var(--t-base); font-weight: 500; line-height: 1; white-space: nowrap;
    user-select: none; cursor: pointer;
    transition: background-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease),
      border-color var(--dur-1) var(--ease), transform var(--dur-1) var(--ease), opacity var(--dur-1);
  }
  .btn:active:not(:disabled):not([aria-disabled="true"]) { transform: scale(0.98); }
  .btn:disabled, .btn[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: var(--ink); color: var(--on-ink); }
  .btn-primary:hover:not(:disabled) { background: var(--ink-3); }
  .btn-secondary { background: var(--surface); color: var(--fg); }
  .btn-secondary:hover:not(:disabled) { background: var(--surface-2); }
  .btn-quiet { background: transparent; color: var(--fg-2); }
  .btn-quiet:hover:not(:disabled) { background: var(--surface); color: var(--fg); }
  .btn-outline { background: var(--bg); color: var(--fg); border-color: var(--line-2); }
  .btn-outline:hover:not(:disabled) { background: var(--surface-3); border-color: var(--line-3); }
  .btn-inverse { background: #fff; color: var(--ink); }
  .btn-inverse:hover:not(:disabled) { background: #ececec; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-danger:hover:not(:disabled) { background: #a82b15; }
  .btn-danger-quiet { background: transparent; color: var(--danger); }
  .btn-danger-quiet:hover:not(:disabled) { background: var(--danger-bg); }
  .btn-lg { height: 48px; padding: 0 24px; font-size: 16px; }
  .btn-sm { height: 32px; padding: 0 12px; font-size: 13px; gap: 6px; }
  .btn-xs { height: 28px; padding: 0 10px; font-size: 12px; gap: 6px; }
  .btn-block { width: 100%; }

  .icon-btn {
    display: inline-grid; place-items: center;
    width: 36px; height: 36px; border-radius: var(--r-pill);
    color: var(--fg-2); background: transparent; border: 0;
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .icon-btn:hover:not(:disabled) { background: var(--surface); color: var(--fg); }
  .icon-btn:disabled { opacity: 0.4; }
  .icon-btn-sm { width: 28px; height: 28px; border-radius: var(--r-sm); }
  .round-btn {
    display: inline-grid; place-items: center;
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--surface); color: var(--fg); border: 0;
    transition: background-color var(--dur-1), opacity var(--dur-1);
  }
  .round-btn:hover:not(:disabled) { background: var(--surface-2); }
  .round-btn:disabled { opacity: 0.4; }

  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid currentColor; border-right-color: transparent;
    animation: spin 0.7s linear infinite; flex: none;
  }

  /* ---------- Pills / badges ---------- */
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    height: 26px; padding: 0 10px; border-radius: var(--r-pill);
    background: var(--surface); color: var(--fg-2);
    font-size: var(--t-sm); font-weight: 450; white-space: nowrap;
  }
  .pill-outline { background: transparent; border: 1px solid var(--line-2); }
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    height: 22px; padding: 0 9px; border-radius: var(--r-pill);
    font-size: var(--t-sm); font-weight: 500; white-space: nowrap;
  }
  .badge-new { background: var(--ink); color: #fff; }
  .badge-soon { height: 20px; padding: 0 8px; font-size: var(--t-xs); font-weight: 450; color: var(--fg-3); border: 1px solid var(--line-3); background: var(--bg); }
  .badge-dark { background: #3a3a3a; color: #fff; }
  .badge-ok { background: var(--ok-bg); color: var(--ok-fg); }
  .badge-warn { background: var(--amber-bg); color: var(--amber-fg); }
  .badge-danger { background: var(--danger-bg); color: var(--danger); }
  .badge-mock {
    display: inline-flex; align-items: center; gap: 6px;
    height: 24px; padding: 0 10px; border-radius: var(--r-pill);
    background: var(--amber-bg); color: var(--amber-fg); border: 1px solid var(--amber-line);
    font-size: var(--t-sm); font-weight: 500; white-space: nowrap; cursor: help;
  }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--live); box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18); flex: none; }
  .amber-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--amber-solid); flex: none; }

  .usage-dots { display: inline-flex; align-items: center; gap: 3px; }
  .usage-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--line-3); }
  .usage-dots i.on { background: var(--ink); }

  /* ---------- Cards ---------- */
  .card { background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-md); }
  .card-lg { border-radius: var(--r-lg); }
  .card-pad { padding: 16px; }
  .card-pad-lg { padding: 24px; }
  .card-muted { background: var(--surface-3); }

  /* ---------- Top nav ---------- */
  .nav {
    position: sticky; top: 0; z-index: 50; height: var(--nav-h);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .nav-inner { height: 100%; display: flex; align-items: center; gap: 18px; padding: 0 24px; }
  .nav-brand {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 18px; font-weight: 600; letter-spacing: -0.035em; color: var(--fg);
    border-radius: 8px;
  }
  .nav-links { display: flex; align-items: center; gap: 2px; }
  .nav-link {
    display: inline-flex; align-items: center; gap: 6px;
    height: 34px; padding: 0 11px; border-radius: var(--r-pill);
    color: var(--fg-2); font-size: var(--t-base);
    transition: color var(--dur-1), background-color var(--dur-1);
  }
  .nav-link:hover { color: var(--fg); }
  .nav-link[aria-current="page"] { background: var(--surface); color: var(--fg); }
  .nav-link[aria-disabled="true"] { cursor: default; }
  .nav-link[aria-disabled="true"]:hover { color: var(--fg-2); }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .nav-desktop { display: flex; align-items: center; gap: 6px; }
  .nav-icon { color: var(--fg); }
  .nav-text { display: inline-flex; align-items: center; height: 34px; padding: 0 10px; color: var(--fg-2); border-radius: var(--r-pill); }
  .nav-text:hover, .nav-text[aria-current="page"] { color: var(--fg); }
  .nav-avatar {
    display: inline-grid; place-items: center;
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--ink); color: #fff; font-size: 12px; font-weight: 600; letter-spacing: 0;
  }
  .nav-burger { display: none; color: var(--fg); }

  .sheet-backdrop {
    position: fixed; inset: var(--nav-h) 0 0 0; z-index: 48;
    background: rgba(0, 0, 0, 0.18); animation: fade-in var(--dur-2) var(--ease);
  }
  .sheet {
    position: fixed; top: var(--nav-h); left: 0; right: 0; z-index: 49;
    background: var(--bg); border-bottom: 1px solid var(--line);
    padding: 10px 16px 20px; display: flex; flex-direction: column; gap: 2px;
    max-height: calc(100dvh - var(--nav-h)); overflow-y: auto;
    animation: sheet-in var(--dur-2) var(--ease);
  }
  .sheet-link {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    height: 50px; padding: 0 12px; border-radius: var(--r-md);
    font-size: var(--t-lg); color: var(--fg);
  }
  .sheet-link:hover, .sheet-link[aria-current="page"] { background: var(--surface); }
  .sheet-link[aria-disabled="true"] { color: var(--fg-3); }
  .sheet-link[aria-disabled="true"]:hover { background: transparent; }
  .sheet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }

  /* ---------- Hero ---------- */
  .hero { padding: 96px 0 72px; text-align: center; }
  .hero-title { max-width: 1040px; margin: 0 auto; }
  .hero-sub { margin: 26px auto 0; max-width: 600px; font-size: 18px; line-height: 1.5; color: var(--fg-2); letter-spacing: -0.01em; text-wrap: balance; }
  .hero-ctas { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 36px; }
  .hero-note { display: flex; justify-content: center; margin-top: 18px; }

  .chip-cluster { display: inline-flex; align-items: center; vertical-align: middle; margin: 0 0.2em 0 0.14em; transform: translateY(-0.06em); }
  .chip-tile {
    display: inline-grid; place-items: center; position: relative;
    width: 0.8em; height: 0.8em; margin-left: -0.22em;
    border-radius: 0.2em; background: #fff; border: 1px solid var(--line);
    box-shadow: var(--shadow-chip); color: var(--ink);
  }
  .chip-tile:first-child { margin-left: 0; }
  .chip-tile:last-child { width: 0.88em; height: 0.88em; z-index: 2; }
  .chip-tile svg { width: 58%; height: 58%; }

  /* ---------- Feature tiles ---------- */
  .tile-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .tile {
    position: relative; display: flex; flex-direction: column;
    min-height: 128px; padding: 16px 16px 18px;
    border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg);
    transition: border-color var(--dur-2) var(--ease), box-shadow var(--dur-2) var(--ease);
  }
  a.tile:hover { border-color: var(--line-3); box-shadow: var(--shadow-soft); }
  .tile-icon { color: var(--fg); }
  .tile-badge { position: absolute; top: 14px; right: 14px; }
  .tile-title { margin-top: auto; padding-top: 28px; font-size: var(--t-md); font-weight: 500; letter-spacing: -0.01em; }
  .tile-sub { margin-top: 10px; font-size: var(--t-13); color: var(--fg-3); }
  .tile.is-muted .tile-icon, .tile.is-muted .tile-title { color: var(--fg-3); }

  /* ---------- Section head ---------- */
  .section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
  .section-title { font-size: var(--t-3xl); line-height: 1.1; font-weight: 500; letter-spacing: -0.035em; }
  .section-sub { margin-top: 6px; font-size: var(--t-md); color: var(--fg-2); }
  .carousel-ctrls { display: flex; gap: 8px; }

  /* ---------- Carousel + media cards ---------- */
  .carousel {
    display: grid; grid-auto-flow: column;
    grid-auto-columns: calc((100% - 40px) / 3); gap: 20px;
    overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain;
    scrollbar-width: none; padding-bottom: 4px;
  }
  .carousel::-webkit-scrollbar { display: none; }
  .carousel > * { scroll-snap-align: start; }

  .media-card { display: flex; flex-direction: column; gap: 14px; color: inherit; border-radius: var(--r-md); }
  .media {
    position: relative; aspect-ratio: 1.6; border-radius: var(--r-md);
    overflow: hidden; background: var(--art-0); isolation: isolate;
  }
  .media > svg, .art-fill { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .media > svg { transition: transform var(--dur-3) var(--ease); }
  .media-card:hover .media > svg { transform: scale(1.025); }
  .media-tag {
    position: absolute; top: 12px; left: 12px; z-index: 1;
    display: inline-flex; align-items: center; gap: 6px;
    height: 24px; padding: 0 10px; border-radius: var(--r-pill);
    background: rgba(20, 20, 20, 0.6); color: #fff;
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    font-size: var(--t-sm); font-weight: 500;
  }
  .media-meta { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 12px; align-items: start; }
  .media-icon {
    display: grid; place-items: center; width: 36px; height: 36px;
    border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink);
  }
  .media-title { font-size: 15.5px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.3; }
  .media-desc { margin-top: 4px; font-size: var(--t-13); line-height: 1.45; color: var(--fg-2); }
  .media-aside { display: inline-flex; align-items: center; gap: 4px; padding-top: 3px; font-size: var(--t-sm); color: var(--fg-3); white-space: nowrap; }
  .media-card:hover .media-aside { color: var(--fg); }

  /* ---------- Model strip ---------- */
  .model-strip {
    display: grid; grid-template-columns: 1.15fr 1fr;
    border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; background: var(--bg);
  }
  .model-strip-art { position: relative; min-height: 360px; background: var(--art-0); }
  .model-strip-body { padding: 32px; display: flex; flex-direction: column; gap: 18px; justify-content: center; }
  .model-id { display: flex; align-items: center; gap: 12px; }
  .model-mark {
    display: grid; place-items: center; flex: none;
    width: 44px; height: 44px; border-radius: var(--r-md);
    border: 1px solid var(--line); background: var(--bg); color: var(--ink);
  }
  .model-name { font-size: var(--t-2xl); font-weight: 500; letter-spacing: -0.03em; line-height: 1.15; }
  .model-by { font-size: var(--t-13); color: var(--fg-3); }
  .mini-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: var(--r-md); }
  .mini-stat { padding: 12px 14px; }
  .mini-stat + .mini-stat { border-left: 1px solid var(--line); }
  .mini-stat-label { font-size: var(--t-sm); color: var(--fg-3); }
  .mini-stat-value { margin-top: 4px; font-size: var(--t-xl); font-weight: 500; letter-spacing: -0.02em; }
  .mini-stat-note { margin-top: 2px; font-size: var(--t-xs); color: var(--fg-3); }

  /* ---------- Steps + plan teaser ---------- */
  .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .step { padding: 20px; border: 1px solid var(--line); border-radius: var(--r-md); }
  .step-num { font-family: var(--font-mono); font-size: var(--t-sm); color: var(--fg-3); }
  .step-title { margin-top: 32px; font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.015em; }
  .step-body { margin-top: 8px; font-size: var(--t-13); color: var(--fg-2); line-height: 1.5; }
  .plan-teaser { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
  .plan-mini { display: flex; flex-direction: column; gap: 6px; padding: 20px; border: 1px solid var(--line); border-radius: var(--r-md); }
  .plan-mini.is-highlight { background: var(--ink); color: var(--on-ink); border-color: var(--ink); }
  .plan-mini.is-highlight .text-3 { color: var(--on-ink-2); }
  .plan-mini-price { font-size: 28px; font-weight: 500; letter-spacing: -0.035em; line-height: 1.1; margin-top: 8px; }

  /* ---------- Pricing ---------- */
  .pricing-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
  .pricing-head-title { font-size: 18px; font-weight: 500; letter-spacing: -0.02em; }
  .pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
  .plan-card { display: flex; flex-direction: column; padding: 24px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg); }
  .plan-card.is-highlight { background: var(--ink); color: var(--on-ink); border-color: var(--ink); }
  .plan-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 28px; }
  .plan-name { font-size: 18px; font-weight: 500; letter-spacing: -0.02em; }
  .plan-blurb { margin-top: 14px; font-size: var(--t-13); color: var(--fg-3); }
  .plan-price { display: flex; align-items: baseline; gap: 6px; margin-top: 18px; }
  .plan-amount { font-size: var(--t-4xl); line-height: 1; font-weight: 500; letter-spacing: -0.04em; }
  .plan-period { font-size: var(--t-13); color: var(--fg-3); }
  .plan-cta { margin-top: 22px; }
  .plan-note {
    margin-top: 10px; padding: 8px 10px; border-radius: var(--r-sm);
    font-size: var(--t-sm); color: var(--amber-fg); background: var(--amber-bg); border: 1px solid var(--amber-line);
  }
  .plan-section { margin-top: 26px; }
  .plan-section-label { padding-bottom: 10px; border-bottom: 1px solid var(--line); font-size: var(--t-sm); color: var(--fg-3); }
  .plan-row {
    display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 10px; align-items: center;
    padding: 11px 0; border-bottom: 1px solid var(--line); font-size: var(--t-13);
  }
  .plan-row:last-child { border-bottom: 0; }
  .plan-row-value { color: var(--fg); font-variant-numeric: tabular-nums; text-align: right; }
  .plan-check { color: var(--fg-2); }
  .plan-card.is-highlight .plan-blurb,
  .plan-card.is-highlight .plan-period,
  .plan-card.is-highlight .plan-section-label { color: var(--on-ink-2); }
  .plan-card.is-highlight .plan-section-label,
  .plan-card.is-highlight .plan-row { border-color: var(--ink-line); }
  .plan-card.is-highlight .plan-row-value { color: var(--on-ink); }
  .plan-card.is-highlight .plan-check { color: var(--on-ink-2); }
  .plan-card.is-highlight .usage-dots i { background: #4a4a4a; }
  .plan-card.is-highlight .usage-dots i.on { background: #fff; }
  .plan-card.is-highlight .plan-note { background: #2a2208; color: #ffd28a; border-color: #4a3a10; }
  .plan-mult { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border-radius: var(--r-pill); background: var(--surface); font-size: var(--t-13); font-weight: 500; }
  .pricing-legend { margin-top: 36px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
  .pricing-legend-line { display: inline-flex; align-items: center; gap: 10px; font-size: var(--t-13); }
  .pricing-fine { max-width: 760px; font-size: var(--t-sm); line-height: 1.55; color: var(--fg-3); }

  /* ---------- FAQ ---------- */
  .faq { max-width: 760px; margin: 0 auto; border-top: 1px solid var(--line); }
  .faq details { border-bottom: 1px solid var(--line); }
  .faq summary {
    list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 18px 2px; font-size: 16px; font-weight: 500; letter-spacing: -0.01em; cursor: pointer;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary svg { flex: none; color: var(--fg-3); transition: transform var(--dur-2) var(--ease); }
  .faq details[open] summary svg { transform: rotate(45deg); }
  .faq-body { padding: 0 2px 20px; max-width: 640px; font-size: var(--t-base); line-height: 1.6; color: var(--fg-2); }

  /* ---------- Footer ---------- */
  .footer { margin-top: 96px; border-top: 1px solid var(--line); overflow: hidden; }
  .footer-grid { display: grid; grid-template-columns: 1.6fr repeat(4, minmax(0, 1fr)); gap: 32px; padding: 64px 0 48px; }
  .footer-brand-line { margin-top: 20px; font-size: var(--t-2xl); line-height: 1.15; font-weight: 500; letter-spacing: -0.03em; }
  .footer-tag { margin-top: 10px; font-size: var(--t-13); color: var(--fg-2); }
  .footer-note { margin-top: 16px; max-width: 420px; font-size: var(--t-sm); line-height: 1.55; color: var(--fg-3); }
  .footer-col-title { margin-bottom: 18px; font-size: var(--t-base); font-weight: 500; }
  .footer-links { display: flex; flex-direction: column; gap: 14px; }
  .footer-links a { display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-base); color: var(--fg-2); transition: color var(--dur-1); width: fit-content; }
  .footer-links a:hover { color: var(--fg); }
  .footer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 0; border-top: 1px solid var(--line); font-size: var(--t-13); color: var(--fg-2); }
  .footer-bottom nav { display: flex; gap: 20px; }
  .footer-bottom a:hover { color: var(--fg); }
  .footer-giant {
    height: 0.5em; overflow: hidden; margin-top: 24px;
    font-size: clamp(96px, 22vw, 340px); line-height: 0.82; font-weight: 500; letter-spacing: -0.055em;
    color: #ececec; text-align: center; white-space: nowrap; user-select: none; pointer-events: none;
  }

  /* ---------- Page head (index pages) ---------- */
  .page-head { padding: 56px 0 28px; }
  .page-title { font-size: var(--t-4xl); line-height: 1.05; font-weight: 500; letter-spacing: -0.035em; }
  .page-sub { margin-top: 10px; font-size: var(--t-md); color: var(--fg-2); max-width: 620px; }
  .page-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }

  /* ---------- Models index ---------- */
  .models-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  .placeholder-card {
    display: flex; flex-direction: column; justify-content: center; gap: 8px;
    min-height: 220px; padding: 24px; border: 1px dashed var(--line-3); border-radius: var(--r-md);
    color: var(--fg-2); font-size: var(--t-13); line-height: 1.5;
  }
  .placeholder-card .h4 { color: var(--fg); }

  /* ---------- Model detail ---------- */
  .model-layout {
    display: grid; grid-template-columns: 360px minmax(0, 1fr);
    min-height: calc(100dvh - var(--nav-h));
    transition: grid-template-columns var(--dur-3) var(--ease);
  }
  .model-layout[data-collapsed="true"] { grid-template-columns: 0 minmax(0, 1fr); }
  .model-side {
    position: sticky; top: var(--nav-h); height: calc(100dvh - var(--nav-h));
    overflow-y: auto; overflow-x: hidden; border-right: 1px solid var(--line);
  }
  .model-layout[data-collapsed="true"] .model-side { border-right-color: transparent; }
  .model-side-inner { width: 360px; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .model-art { position: relative; aspect-ratio: 311 / 175; border-radius: var(--r-md); overflow: hidden; background: var(--art-0); }
  .model-head { display: flex; align-items: center; gap: 12px; }
  .model-title { font-size: 26px; line-height: 1.1; font-weight: 500; letter-spacing: -0.035em; }
  .model-desc { font-size: var(--t-base); line-height: 1.5; color: var(--fg-2); }
  .stat-card { border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .stat { padding: 16px; border-bottom: 1px solid var(--line); min-width: 0; }
  .stat-grid > .stat:nth-child(2n) { border-left: 1px solid var(--line); }
  .stat-grid > .stat.span-2 { grid-column: span 2; border-left: 0; }
  .stat-grid > .stat:last-child { border-bottom: 0; }
  .stat-label { font-size: var(--t-13); color: var(--fg-2); }
  .stat-value { display: inline-flex; align-items: center; gap: 8px; margin-top: 6px; font-size: var(--t-xl); font-weight: 500; letter-spacing: -0.02em; }
  .stat-value-sm { font-size: var(--t-md); }
  .stat-note { margin-top: 6px; font-size: var(--t-sm); line-height: 1.45; color: var(--fg-3); }
  .facts { border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px; }
  .facts-title { margin-bottom: 6px; font-size: var(--t-13); color: var(--fg-2); }
  .fact-row { display: flex; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: var(--t-13); }
  .fact-row:last-child { border-bottom: 0; padding-bottom: 2px; }
  .fact-row dt { color: var(--fg-2); flex: none; }
  .fact-row dd { margin: 0; text-align: right; color: var(--fg); overflow-wrap: anywhere; }
  .attribution { padding: 16px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface-3); font-size: var(--t-13); line-height: 1.55; color: var(--fg-2); }
  .attribution-title { margin-bottom: 6px; font-weight: 500; color: var(--fg); }
  .attribution a { color: var(--fg); }
  .link-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .model-panel { position: relative; display: grid; place-items: center; padding: 64px 24px; min-width: 0; }
  .model-panel-toggle { position: absolute; top: 16px; left: 24px; }
  .model-cta { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 480px; text-align: center; }
  .model-cta-mark { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--r-lg); border: 1px solid var(--line); box-shadow: var(--shadow-chip); color: var(--ink); background: #fff; }
  .model-cta-title { font-size: 28px; line-height: 1.15; font-weight: 500; letter-spacing: -0.035em; text-wrap: balance; }
  .model-cta-sub { font-size: var(--t-md); color: var(--fg-2); text-wrap: balance; }
  .model-cta-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px; }

  /* ---------- Limit reached ---------- */
  .limit-card {
    display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 14px;
    padding: 20px; border: 1px solid var(--line-2); border-radius: var(--r-lg);
    background: var(--bg); box-shadow: var(--shadow-soft);
  }
  .limit-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: var(--r-md); background: var(--surface); color: var(--fg); }
  .limit-title { font-size: 16px; font-weight: 500; letter-spacing: -0.01em; }
  .limit-body { margin-top: 4px; font-size: var(--t-13); line-height: 1.5; color: var(--fg-2); }
  .limit-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }

  /* ---------- Chat shell + sidebar ---------- */
  .chat-shell {
    display: grid; grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    height: calc(100dvh - var(--nav-h)); overflow: hidden;
    transition: grid-template-columns var(--dur-3) var(--ease);
  }
  .chat-shell[data-sidebar="closed"] { grid-template-columns: 0 minmax(0, 1fr); }
  .chat-sidebar { min-width: 0; overflow: hidden; border-right: 1px solid var(--line); background: var(--bg); }
  .chat-shell[data-sidebar="closed"] .chat-sidebar { border-right-color: transparent; }
  .chat-scrim { display: none; }
  .side-inner { width: var(--sidebar-w); height: 100%; display: flex; flex-direction: column; padding: 14px 12px 12px; }
  .side-top { display: flex; align-items: center; gap: 8px; }
  .side-search { position: relative; flex: 1; }
  .side-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--fg-3); pointer-events: none; }
  .side-search input {
    width: 100%; height: 40px; padding: 0 12px 0 34px;
    border-radius: var(--r-md); border: 1px solid transparent; background: var(--surface);
    font-size: var(--t-base); color: var(--fg); outline: none;
    transition: border-color var(--dur-1), background-color var(--dur-1);
  }
  .side-search input::placeholder { color: var(--fg-3); }
  .side-search input:focus { border-color: var(--line-3); background: var(--bg); }
  .side-action {
    display: flex; align-items: center; gap: 10px; width: 100%;
    height: 38px; padding: 0 10px; margin-top: 20px; border-radius: 10px;
    font-size: var(--t-base); color: var(--fg); text-align: left;
    transition: background-color var(--dur-1);
  }
  .side-action:hover { background: var(--surface); }
  .side-action + .side-action { margin-top: 2px; }
  .side-scroll { flex: 1; min-height: 0; overflow-y: auto; margin: 0 -12px; padding: 0 12px 8px; }
  .side-section { margin-top: 18px; }
  .side-section-head {
    display: flex; align-items: center; justify-content: space-between; width: 100%;
    height: 30px; padding: 0 10px; border-radius: 8px; font-size: var(--t-13); color: var(--fg-3);
  }
  button.side-section-head:hover { color: var(--fg); }
  .side-section-head svg { transition: transform var(--dur-2) var(--ease); }
  .side-section-head[aria-expanded="false"] svg { transform: rotate(-90deg); }
  .side-list { display: flex; flex-direction: column; gap: 1px; margin-top: 2px; }
  .side-item {
    position: relative; display: flex; align-items: center; gap: 6px;
    height: 34px; padding: 0 4px 0 0; border-radius: 10px;
    font-size: 13.5px; color: var(--fg-2);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .side-item:hover, .side-item:focus-within { background: var(--surface-3); color: var(--fg); }
  .side-item[aria-current="page"], .side-item.is-active { background: var(--surface); color: var(--fg); }
  .side-item-link {
    flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; gap: 8px;
    padding-left: 10px; border-radius: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .side-item-link span { overflow: hidden; text-overflow: ellipsis; }
  .side-item-link:focus-visible { outline-offset: -2px; }
  .side-item-actions { display: flex; gap: 2px; opacity: 0; transition: opacity var(--dur-1); }
  .side-item:hover .side-item-actions, .side-item:focus-within .side-item-actions { opacity: 1; }
  .side-item-btn { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: var(--fg-3); }
  .side-item-btn:hover { background: var(--surface-2); color: var(--fg); }
  .side-item-btn.is-danger:hover { color: var(--danger); background: var(--danger-bg); }
  .side-rename { flex: 1; padding: 0 4px; }
  .side-rename input { width: 100%; height: 28px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--line-3); font-size: var(--t-13); outline: none; background: var(--bg); }
  .side-rename input:focus { border-color: var(--fg); }
  .side-group-label { padding: 14px 10px 6px; font-size: var(--t-sm); color: var(--fg-3); }
  .side-empty { padding: 6px 10px; font-size: var(--t-13); color: var(--fg-3); }
  .side-foot { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
  .side-user { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 10px; min-width: 0; }
  .side-user:hover { background: var(--surface); }
  .side-user-name { font-size: var(--t-13); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ---------- Chat main ---------- */
  .chat-main { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; height: 100%; }
  .chat-topbar { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 10px 16px 0; }
  .chats-btn { border-radius: 10px; border: 1px solid var(--line-2); }

CSS>>>
Write these complete files now (same output format: === FILE: path === ... === END FILE ===):
`app/fonts.ts`, `lib/types.ts`, `lib/engine.ts`, `components/icons.tsx`, `components/Rook.tsx`, `components/Art.tsx`, `components/TopNav.tsx`, `components/MockBadge.tsx`, `components/LimitReached.tsx`, `components/Footer.tsx`, `components/marketing/HomeView.tsx`, `components/marketing/PricingView.tsx` (also handle `?checkout=canceled` with a small notice via useSearchParams wrapped safely, or accept it gracefully), `components/model/ModelView.tsx`, `components/model/ModelsIndexView.tsx`.
Notes: TopNav is rendered by the root layout on every page (including chat). Pages are server components passing the documented props. Default + named exports. No prose outside the files.