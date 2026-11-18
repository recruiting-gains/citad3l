# Citad3L — design review round 2 (you are the creative lead; you wrote all of this frontend in round 1)
Product recap: Citad3L, a strategic AI assistant (AI advancement, robotics, AI cybersecurity + everyday help). One engine "Citad3L V1" = huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF. Plans Trial $0 (5 replies once) / Pro $20 / Max $50 (2.5× Pro). The UI currently runs on an explicitly labelled mock provider; the amber "Mock provider – not live inference" badge must stay visible wherever chat output is produced.
Owner direction (confirmed): NEAR 1:1 visual likeness to the reference site (layout, proportions, container width/gutters, whitespace, type sizes, nav, composer, pricing). The reference owner has OK'd close likeness. Still: original code, Citad3L name, rook mark, original copy and original art; never use the words "Ghost" or "Sapient"; no fake live-user counts.
Attached images are side-by-side comparisons: LEFT = reference, RIGHT = our current build (same viewport). Study the differences carefully (container width & gutters, hero type size and line breaks, tile proportions, card radii, media card aspect ratios, section spacing, nav height/spacing, pricing card proportions, composer size, sidebar widths, phone layout).
Your round-1 design notes:
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
Current app/globals.css:
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
  .chats-btn:hover { background: var(--surface-3); }
  .chat-topbar-title {
    flex: 1; min-width: 0; font-size: var(--t-base); font-weight: 500; color: var(--fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chat-topbar-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .chat-scroll { position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; }
  .thread { width: 100%; max-width: calc(var(--thread-w) + 48px); margin: 0 auto; padding: 24px 24px 32px; display: flex; flex-direction: column; gap: 28px; }

  /* ---------- Chat empty state ---------- */
  .chat-empty {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; align-items: center;
    padding: clamp(32px, 9vh, 96px) 24px 32px;
  }
  .chat-empty-inner { width: 100%; max-width: var(--thread-w); display: flex; flex-direction: column; align-items: center; }
  .chat-emblem { display: grid; place-items: center; width: 72px; height: 72px; color: var(--ink); animation: rise var(--dur-3) var(--ease) both; }
  .chat-greeting {
    margin-top: 18px; font-size: var(--t-4xl); line-height: 1.08; font-weight: 500;
    letter-spacing: -0.04em; text-align: center; text-wrap: balance;
    animation: rise var(--dur-3) var(--ease) 60ms both;
  }
  .chat-greeting-sub { margin-top: 10px; font-size: var(--t-md); color: var(--fg-2); text-align: center; }
  .chat-empty .composer { margin-top: 28px; width: 100%; }
  .chat-empty-meta { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 10px 0; font-size: var(--t-13); color: var(--fg-2); }
  .suggestions-title { width: 100%; margin-top: 40px; margin-bottom: 12px; font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.02em; }
  .suggestions { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .suggestion {
    display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; align-items: start;
    padding: 14px; border: 1px solid var(--line); border-radius: var(--r-md);
    background: var(--bg); text-align: left; color: var(--fg);
    transition: border-color var(--dur-2) var(--ease), background-color var(--dur-2), transform var(--dur-1);
  }
  .suggestion:hover { border-color: var(--line-3); background: var(--surface-3); }
  .suggestion:active { transform: scale(0.99); }
  .suggestion-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--surface); color: var(--ink); }
  .suggestion-kicker { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-3); }
  .suggestion-text { margin-top: 3px; font-size: var(--t-13); line-height: 1.45; color: var(--fg); }
  .chip-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
    border-radius: var(--r-pill); border: 1px solid var(--line-2); background: var(--bg);
    font-size: var(--t-13); color: var(--fg-2); transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-1);
  }
  .chip:hover { background: var(--surface-3); color: var(--fg); border-color: var(--line-3); }

  /* ---------- Messages ---------- */
  .msg { display: flex; flex-direction: column; min-width: 0; animation: rise var(--dur-2) var(--ease) both; }
  .msg-user { align-items: flex-end; }
  .msg-bubble {
    max-width: min(85%, 600px); padding: 10px 16px; border-radius: 20px 20px 6px 20px;
    background: var(--surface); color: var(--fg); font-size: var(--t-md); line-height: 1.55;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }
  .msg-assistant { align-items: stretch; }
  .msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: var(--t-13); font-weight: 500; color: var(--fg); }
  .msg-avatar { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; border: 1px solid var(--line); color: var(--ink); background: var(--bg); }
  .msg-body { font-size: var(--t-md); line-height: 1.65; color: var(--fg); min-width: 0; }
  .msg-actions { display: flex; align-items: center; gap: 2px; margin-top: 8px; opacity: 0.0; transition: opacity var(--dur-1); }
  .msg:hover .msg-actions, .msg:focus-within .msg-actions, .msg.is-last .msg-actions, .msg-actions.is-visible { opacity: 1; }
  .msg-user .msg-actions { justify-content: flex-end; }
  .msg-action {
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border-radius: 8px;
    font-size: var(--t-sm); color: var(--fg-3); transition: background-color var(--dur-1), color var(--dur-1);
  }
  .msg-action:hover:not(:disabled) { background: var(--surface); color: var(--fg); }
  .msg-action:disabled { opacity: 0.4; }
  .msg-action.is-done { color: var(--ok-fg); }
  .msg-status { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: var(--t-sm); color: var(--fg-3); }
  .msg-status.is-error { color: var(--danger); }
  .msg-error {
    margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 12px; border: 1px solid var(--danger-line); border-radius: var(--r-md);
    background: var(--danger-bg); color: var(--danger-fg); font-size: var(--t-13);
  }
  .stream-caret {
    display: inline-block; width: 8px; height: 1.05em; margin-left: 2px; vertical-align: -0.15em;
    background: var(--fg); border-radius: 1px; animation: caret 1s steps(1) infinite;
  }
  .thinking { display: inline-flex; align-items: center; gap: 4px; height: 24px; }
  .thinking i { width: 6px; height: 6px; border-radius: 50%; background: var(--fg-3); animation: bounce 1.2s var(--ease) infinite; }
  .thinking i:nth-child(2) { animation-delay: 0.15s; }
  .thinking i:nth-child(3) { animation-delay: 0.3s; }

  .jump-latest {
    position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 5;
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
    border-radius: var(--r-pill); background: var(--bg); border: 1px solid var(--line-2);
    box-shadow: var(--shadow-chip); font-size: var(--t-13); color: var(--fg);
    animation: fade-in var(--dur-2) var(--ease);
  }
  .jump-latest:hover { background: var(--surface-3); }

  /* ---------- Composer ---------- */
  .composer-dock { position: relative; padding: 0 24px 14px; background: linear-gradient(to bottom, rgba(255,255,255,0), #fff 28px); }
  .composer-dock-inner { max-width: var(--thread-w); margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
  .composer {
    display: flex; flex-direction: column; gap: 10px;
    padding: 16px 16px 12px 20px; border-radius: var(--r-xl);
    background: var(--surface); border: 1px solid var(--line-2);
    transition: border-color var(--dur-1), background-color var(--dur-1), box-shadow var(--dur-2);
  }
  .composer:focus-within { border-color: var(--line-3); background: #efefef; box-shadow: 0 0 0 4px rgba(20, 20, 20, 0.04); }
  .composer.is-disabled { opacity: 0.6; }
  .composer.is-over { border-color: var(--danger-line); }
  .composer-input {
    width: 100%; min-height: 28px; max-height: 240px; resize: none; padding: 0; margin: 0;
    border: 0; outline: none; background: transparent; color: var(--fg);
    font: inherit; font-size: var(--t-lg); line-height: 1.5; letter-spacing: -0.01em;
  }
  .composer-input::placeholder { color: var(--fg-3); }
  .composer-input:focus-visible { outline: none; }
  .composer-bar { display: flex; align-items: center; gap: 8px; }
  .composer-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .composer-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .seg { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border-radius: var(--r-pill); border: 1px solid var(--line-2); background: transparent; }
  .seg-btn {
    display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
    border-radius: var(--r-pill); font-size: var(--t-base); color: var(--fg-2);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .seg-btn:hover:not(:disabled) { color: var(--fg); }
  .seg-btn[aria-pressed="true"], .seg-btn.is-active { background: var(--surface-2); color: var(--fg); }
  .seg-btn:disabled { color: var(--fg-4); }
  .engine-pill {
    display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px 0 6px;
    border-radius: var(--r-pill); background: var(--surface-2); font-size: var(--t-13); font-weight: 500; color: var(--fg); white-space: nowrap;
  }
  .engine-pill-mark { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #fff; color: var(--ink); }
  .send-btn {
    display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 0;
    background: var(--ink); color: #fff; transition: background-color var(--dur-1), opacity var(--dur-1), transform var(--dur-1);
  }
  .send-btn:hover:not(:disabled) { background: var(--ink-3); }
  .send-btn:active:not(:disabled) { transform: scale(0.94); }
  .send-btn:disabled { background: var(--surface-2); color: var(--fg-3); opacity: 1; }
  .stop-btn { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--ink); color: #fff; }
  .stop-btn:hover { background: var(--ink-3); }
  .stop-btn i { width: 11px; height: 11px; border-radius: 2px; background: currentColor; }
  .composer-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 0 6px; font-size: var(--t-sm); color: var(--fg-3); }
  .composer-meta .spacer { min-width: 4px; }
  .char-count { font-family: var(--font-mono); font-size: var(--t-xs); color: var(--fg-3); font-variant-numeric: tabular-nums; }
  .char-count.is-near { color: var(--amber-fg); }
  .char-count.is-over { color: var(--danger); font-weight: 600; }
  .usage-chip {
    display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px;
    border-radius: var(--r-pill); background: var(--surface); color: var(--fg-2);
    font-size: var(--t-sm); font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .usage-chip.is-low { background: var(--amber-bg); color: var(--amber-fg); }
  .usage-chip.is-out { background: var(--danger-bg); color: var(--danger); }
  .project-chip {
    display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; max-width: 220px;
    border-radius: var(--r-pill); color: var(--fg-2); font-size: var(--t-13);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .project-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.project-chip:hover, a.project-chip:hover { background: var(--surface); color: var(--fg); }
  .project-chip.is-set { background: var(--surface); color: var(--fg); }
  .composer-hint { text-align: center; font-size: var(--t-xs); color: var(--fg-3); }

  /* ---------- Menus / popovers ---------- */
  .popover-anchor { position: relative; }
  .menu {
    position: absolute; z-index: 40; min-width: 220px; max-height: 320px; overflow-y: auto;
    padding: 6px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--bg);
    box-shadow: var(--shadow-pop); animation: pop-in var(--dur-1) var(--ease);
  }
  .menu-up { bottom: calc(100% + 6px); left: 0; }
  .menu-down { top: calc(100% + 6px); right: 0; }
  .menu-label { padding: 8px 10px 4px; font-size: var(--t-xs); color: var(--fg-3); }
  .menu-item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 10px;
    border-radius: 8px; font-size: var(--t-13); color: var(--fg); text-align: left; white-space: nowrap;
  }
  .menu-item:hover, .menu-item:focus-visible { background: var(--surface); outline: none; }
  .menu-item[aria-checked="true"]::after { content: ""; margin-left: auto; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); }
  .menu-item.is-danger { color: var(--danger); }
  .menu-sep { height: 1px; margin: 4px 0; background: var(--line); }

  /* ---------- Banners / notices ---------- */
  .banner {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--r-md);
    border: 1px solid var(--line-2); background: var(--surface-3); font-size: var(--t-13); color: var(--fg-2);
    animation: fade-in var(--dur-2) var(--ease);
  }
  .banner > svg { flex: none; }
  .banner-text { flex: 1; min-width: 0; }
  .banner-text strong { color: var(--fg); font-weight: 500; }
  .banner-error { background: var(--danger-bg); border-color: var(--danger-line); color: var(--danger-fg); }
  .banner-error strong { color: var(--danger-fg); }
  .banner-warn { background: var(--amber-bg); border-color: var(--amber-line); color: var(--amber-fg); }
  .banner-warn strong { color: var(--amber-fg); }
  .banner-offline { background: var(--ink); border-color: var(--ink); color: var(--on-ink-2); }
  .banner-offline strong { color: #fff; }
  .banner-offline .btn-secondary { background: #2e2e2e; color: #fff; }
  .notice { padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--surface-3); font-size: var(--t-13); line-height: 1.5; color: var(--fg-2); }
  .notice strong { color: var(--fg); font-weight: 500; }
  .notice-warn { background: var(--amber-bg); border-color: var(--amber-line); color: var(--amber-fg); }
  .notice-warn strong { color: var(--amber-fg); }
  .notice-danger { background: var(--danger-bg); border-color: var(--danger-line); color: var(--danger-fg); }
  .notice-danger strong { color: var(--danger-fg); }
  .notice-ok { background: var(--ok-bg); border-color: #bfe8cd; color: var(--ok-fg); }

  /* ---------- Markdown ---------- */
  .md { font-size: var(--t-md); line-height: 1.65; color: var(--fg); overflow-wrap: anywhere; }
  .md > :first-child { margin-top: 0; }
  .md > :last-child { margin-bottom: 0; }
  .md p { margin: 0 0 14px; }
  .md h1, .md h2, .md h3, .md h4 { margin: 26px 0 10px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
  .md h1 { font-size: 24px; }
  .md h2 { font-size: 20px; }
  .md h3 { font-size: 17px; }
  .md h4 { font-size: 15px; }
  .md ul, .md ol { margin: 0 0 14px; padding-left: 22px; }
  .md li { margin: 4px 0; }
  .md li::marker { color: var(--fg-3); }
  .md li > p { margin: 0 0 6px; }
  .md ul ul, .md ol ol, .md ul ol, .md ol ul { margin: 4px 0; }
  .md a { text-decoration: underline; text-decoration-color: var(--line-3); text-underline-offset: 3px; }
  .md a:hover { text-decoration-color: currentColor; }
  .md strong { font-weight: 600; }
  .md blockquote { margin: 0 0 14px; padding: 2px 0 2px 14px; border-left: 2px solid var(--line-3); color: var(--fg-2); }
  .md hr { border: 0; border-top: 1px solid var(--line); margin: 22px 0; }
  .md img { max-width: 100%; border-radius: var(--r-sm); }
  .md :not(pre) > code {
    font-family: var(--font-mono); font-size: 0.86em; padding: 1px 5px; border-radius: 5px;
    background: var(--surface); border: 1px solid var(--line); color: var(--fg);
  }
  .md-table-wrap { margin: 0 0 14px; overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r-md); }
  .md table { width: 100%; border-collapse: collapse; font-size: var(--t-13); }
  .md th, .md td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
  .md th { font-weight: 500; background: var(--surface-3); color: var(--fg); }
  .md tr:last-child td { border-bottom: 0; }
  .md input[type="checkbox"] { margin: 0 6px 0 0; accent-color: var(--ink); }

  /* ---------- Code blocks ---------- */
  .code-block { margin: 0 0 16px; border-radius: var(--r-md); overflow: hidden; background: #0d1014; border: 1px solid #1c2128; }
  .code-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    height: 36px; padding: 0 6px 0 14px; background: #141920; border-bottom: 1px solid #1c2128;
  }
  .code-lang { font-family: var(--font-mono); font-size: var(--t-xs); letter-spacing: 0.04em; text-transform: lowercase; color: #8a96a8; }
  .code-copy {
    display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: 7px;
    font-size: var(--t-sm); color: #aab4c3; transition: background-color var(--dur-1), color var(--dur-1);
  }
  .code-copy:hover { background: #222a35; color: #fff; }
  .code-copy.is-done { color: var(--art-cyan); }
  .code-block pre { margin: 0; padding: 14px 16px 16px; overflow-x: auto; scrollbar-width: thin; scrollbar-color: #2b3340 transparent; }
  .code-block pre code, .code-block code.hljs {
    display: block; background: transparent; padding: 0; border: 0;
    font-family: var(--font-mono); font-size: 13px; line-height: 1.6; color: #dfe5ee; tab-size: 2; white-space: pre;
  }

  /* syntax tokens — original "console" theme */
  .hljs-comment, .hljs-quote { color: #6b7686; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag, .hljs-meta .hljs-keyword { color: #a99cff; }
  .hljs-string, .hljs-regexp, .hljs-addition, .hljs-meta .hljs-string { color: #7ee8c8; }
  .hljs-number, .hljs-symbol, .hljs-bullet, .hljs-link { color: #ffc46b; }
  .hljs-title, .hljs-title.function_, .hljs-section { color: #7fc8ff; }
  .hljs-title.class_, .hljs-type, .hljs-built_in, .hljs-class .hljs-title { color: #ffd98a; }
  .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable, .hljs-property { color: #ff9f8a; }
  .hljs-params { color: #dfe5ee; }
  .hljs-tag, .hljs-name, .hljs-selector-id, .hljs-selector-class { color: #8fb8ff; }
  .hljs-meta, .hljs-subst, .hljs-operator, .hljs-punctuation { color: #9aa6b8; }
  .hljs-deletion { color: #ff8a8a; background: rgba(255, 90, 90, 0.08); }
  .hljs-addition { background: rgba(94, 230, 208, 0.08); }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }

  /* ---------- Forms ---------- */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .label { font-size: var(--t-13); font-weight: 500; color: var(--fg); }
  .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .input, .textarea, .select {
    width: 100%; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-2);
    background: var(--bg); color: var(--fg); font: inherit; font-size: var(--t-base); outline: none;
    transition: border-color var(--dur-1), box-shadow var(--dur-1);
  }
  .input, .select { height: 42px; }
  .textarea { min-height: 120px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
  .input::placeholder, .textarea::placeholder { color: var(--fg-3); }
  .input:focus, .textarea:focus, .select:focus { border-color: var(--fg); box-shadow: 0 0 0 3px rgba(20, 20, 20, 0.08); }
  .input[aria-invalid="true"], .textarea[aria-invalid="true"] { border-color: var(--danger); }
  .input-filled { background: var(--surface); border-color: transparent; }
  .field-hint { font-size: var(--t-sm); color: var(--fg-3); }
  .field-error { font-size: var(--t-sm); color: var(--danger); }
  .form { display: flex; flex-direction: column; gap: 16px; }
  .form-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

  /* ---------- Dialog ---------- */
  .dialog-backdrop {
    position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px;
    background: rgba(10, 10, 10, 0.32); animation: fade-in var(--dur-2) var(--ease);
  }
  .dialog {
    width: 100%; max-width: 480px; max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 24px; border-radius: var(--r-xl); background: var(--bg); box-shadow: var(--shadow-pop);
    animation: pop-in var(--dur-2) var(--ease);
  }
  .dialog-lg { max-width: 600px; }
  .dialog-title { font-size: var(--t-xl); font-weight: 500; letter-spacing: -0.025em; line-height: 1.2; }
  .dialog-body { margin-top: 8px; font-size: var(--t-base); line-height: 1.55; color: var(--fg-2); }
  .dialog-form { margin-top: 20px; }
  .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 22px; }

  /* ---------- Toasts ---------- */
  .toast-stack {
    position: fixed; z-index: 100; left: 50%; bottom: 24px; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; width: max-content; max-width: calc(100vw - 32px);
  }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 10px;
    min-height: 40px; padding: 8px 8px 8px 14px; border-radius: var(--r-md);
    background: var(--ink); color: #fff; box-shadow: var(--shadow-pop);
    font-size: var(--t-13); animation: toast-in var(--dur-2) var(--ease);
  }
  .toast-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--art-cyan); flex: none; }
  .toast-warn .toast-dot { background: var(--art-amber); }
  .toast-error .toast-dot { background: #ff6b55; }
  .toast-ok .toast-dot { background: var(--live); }
  .toast-close { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; color: #9a9a9a; }
  .toast-close:hover { background: #2a2a2a; color: #fff; }

  /* ---------- Skeletons + states ---------- */
  .skeleton {
    position: relative; overflow: hidden; border-radius: 8px; background: var(--surface);
  }
  .skeleton::after {
    content: ""; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent);
    animation: shimmer 1.4s infinite;
  }
  .skel-line { height: 12px; }
  .skel-line.w-40 { width: 40%; }
  .skel-line.w-60 { width: 60%; }
  .skel-line.w-80 { width: 80%; }
  .skel-line.w-100 { width: 100%; }
  .skel-bubble { align-self: flex-end; width: 46%; height: 40px; border-radius: 20px; }
  .skel-block { height: 120px; border-radius: var(--r-md); }
  .skel-stack { display: flex; flex-direction: column; gap: 10px; }
  .state {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    padding: 56px 24px; text-align: center;
  }
  .state-emblem { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--r-lg); border: 1px solid var(--line); box-shadow: var(--shadow-chip); color: var(--ink); background: #fff; margin-bottom: 6px; }
  .state-title { font-size: var(--t-xl); font-weight: 500; letter-spacing: -0.025em; }
  .state-body { max-width: 420px; font-size: var(--t-base); line-height: 1.55; color: var(--fg-2); text-wrap: balance; }
  .state-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px; }

  /* ---------- Projects ---------- */
  .projects-page { padding-bottom: 64px; }
  .projects-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .project-card {
    position: relative; display: flex; flex-direction: column; gap: 10px; min-height: 180px;
    padding: 18px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg);
    transition: border-color var(--dur-2) var(--ease), box-shadow var(--dur-2) var(--ease);
  }
  .project-card:hover, .project-card:focus-within { border-color: var(--line-3); box-shadow: var(--shadow-soft); }
  .project-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .project-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--surface); color: var(--ink); flex: none; }
  .project-name { font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.02em; line-height: 1.25; overflow-wrap: anywhere; }
  .project-name a::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
  .project-instructions {
    font-size: var(--t-13); line-height: 1.5; color: var(--fg-2);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .project-instructions.is-empty { color: var(--fg-3); font-style: italic; }
  .project-meta { margin-top: auto; display: flex; align-items: center; gap: 10px; font-size: var(--t-sm); color: var(--fg-3); }
  .project-actions { position: relative; z-index: 1; display: flex; gap: 2px; }
  .project-new {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 180px;
    border: 1px dashed var(--line-3); border-radius: var(--r-md); color: var(--fg-2); font-size: var(--t-base);
    transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-1);
  }
  .project-new:hover { background: var(--surface-3); color: var(--fg); border-color: var(--fg-4); }
  .empty-state { border: 1px dashed var(--line-3); border-radius: var(--r-lg); }

  /* ---------- Account ---------- */
  .account-page { max-width: calc(880px + var(--gutter) * 2); padding-bottom: 64px; }
  .account-grid { display: grid; gap: 16px; }
  .account-card { padding: 24px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg); }
  .account-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .account-card-title { font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.02em; }
  .account-card-sub { margin-top: 4px; font-size: var(--t-13); color: var(--fg-2); }
  .account-plan { display: flex; align-items: center; gap: 14px; }
  .account-plan-name { font-size: var(--t-2xl); font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; }
  .account-row {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 0; border-top: 1px solid var(--line); font-size: var(--t-base);
  }
  .account-row:first-of-type { border-top: 0; padding-top: 0; }
  .account-row-label { font-weight: 500; }
  .account-row-desc { margin-top: 2px; font-size: var(--t-13); color: var(--fg-2); }
  .account-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .avatar-lg { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 15px; font-weight: 600; flex: none; }
  .meter { display: flex; flex-direction: column; gap: 8px; }
  .meter-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .meter-value { font-size: var(--t-3xl); font-weight: 500; letter-spacing: -0.035em; line-height: 1; font-variant-numeric: tabular-nums; }
  .meter-value small { font-size: var(--t-base); font-weight: 400; letter-spacing: 0; color: var(--fg-3); margin-left: 4px; }
  .meter-bar { position: relative; height: 8px; border-radius: var(--r-pill); background: var(--surface); overflow: hidden; }
  .meter-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--ink); transition: width var(--dur-3) var(--ease); }
  .meter-fill.is-warn { background: var(--amber-solid); }
  .meter-fill.is-full { background: var(--danger); }
  .meter-foot { display: flex; justify-content: space-between; gap: 12px; font-size: var(--t-sm); color: var(--fg-3); }
  .meter-sm .meter-bar { height: 4px; }
  .danger-zone { border-color: var(--danger-line); }
  .danger-zone .account-card-title { color: var(--danger-fg); }
  .confirm-input { font-family: var(--font-mono); }

  /* ---------- Login ---------- */
  .auth-page {
    min-height: calc(100dvh - var(--nav-h)); display: grid; place-items: center;
    padding: 48px var(--gutter); background: radial-gradient(1200px 500px at 50% -10%, #f6f6f6, #fff 70%);
  }
  .auth-card {
    width: 100%; max-width: 400px; padding: 32px; border: 1px solid var(--line); border-radius: var(--r-xl);
    background: var(--bg); box-shadow: var(--shadow-soft); display: flex; flex-direction: column; gap: 20px;
  }
  .auth-head { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
  .auth-emblem { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--r-lg); border: 1px solid var(--line); box-shadow: var(--shadow-chip); color: var(--ink); background: #fff; }
  .auth-title { font-size: 26px; font-weight: 500; letter-spacing: -0.035em; line-height: 1.15; }
  .auth-sub { font-size: var(--t-base); color: var(--fg-2); }
  .auth-providers { display: flex; flex-direction: column; gap: 8px; }
  .provider-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 44px;
    border-radius: var(--r-pill); border: 1px solid var(--line-2); background: var(--bg);
    font-size: var(--t-base); font-weight: 500; color: var(--fg);
    transition: background-color var(--dur-1), border-color var(--dur-1), transform var(--dur-1);
  }
  .provider-btn:hover:not(:disabled) { background: var(--surface-3); border-color: var(--line-3); }
  .provider-btn:active:not(:disabled) { transform: scale(0.99); }
  .provider-btn:disabled { opacity: 0.5; }
  .auth-divider { display: flex; align-items: center; gap: 12px; font-size: var(--t-sm); color: var(--fg-3); }
  .auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .demo-box { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: var(--r-md); border: 1px dashed var(--amber-line); background: #fffbf1; }
  .demo-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-sm); font-weight: 500; color: var(--amber-fg); }
  .auth-foot { font-size: var(--t-sm); line-height: 1.5; color: var(--fg-3); text-align: center; }
  .auth-foot a { color: var(--fg-2); text-decoration: underline; text-underline-offset: 2px; }

  /* ---------- Art animation hooks (used by Art.tsx) ---------- */
  .art-sweep { transform-box: view-box; transform-origin: center; animation: sweep 6s linear infinite; }
  .art-blink { animation: blink 2.4s ease-in-out infinite; }
  .art-blink.d1 { animation-delay: 0.6s; }
  .art-blink.d2 { animation-delay: 1.2s; }
  .art-blink.d3 { animation-delay: 1.8s; }
  .art-flow { stroke-dasharray: 4 10; animation: dash 3s linear infinite; }
  .art-scan { animation: scan 5s var(--ease) infinite; }
  .art-float { animation: float 6s ease-in-out infinite; }
  .art-pulse { transform-box: fill-box; transform-origin: center; animation: pulse 3s ease-out infinite; }

  /* ---------- Responsive ---------- */
  @media (max-width: 1200px) {
    .tile-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .footer-grid { grid-template-columns: 1.4fr repeat(2, minmax(0, 1fr)); }
    .footer-grid > :first-child { grid-row: span 2; }
  }

  @media (max-width: 1024px) {
    .nav-links .nav-link { padding: 0 8px; }
    .model-layout { grid-template-columns: 320px minmax(0, 1fr); }
    .model-side-inner { width: 320px; }
    .pricing-grid { grid-template-columns: 1fr; max-width: 560px; margin-inline: auto; }
    .projects-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .models-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .carousel { grid-auto-columns: calc((100% - 20px) / 2); }
  }

  @media (max-width: 900px) {
    .nav-links, .nav-desktop { display: none; }
    .nav-burger { display: inline-grid; }
    .nav-inner { padding: 0 12px 0 16px; gap: 8px; }

    .model-strip { grid-template-columns: 1fr; }
    .model-strip-art { min-height: 240px; }
    .steps, .plan-teaser { grid-template-columns: 1fr; }

    .model-layout, .model-layout[data-collapsed="true"] { grid-template-columns: 1fr; }
    .model-side { position: static; height: auto; overflow: visible; border-right: 0; border-bottom: 1px solid var(--line); }
    .model-side-inner { width: 100%; max-width: 640px; margin: 0 auto; }
    .model-panel { padding: 48px 20px 64px; }
    .model-panel-toggle { display: none; }

    .chat-shell, .chat-shell[data-sidebar="closed"], .chat-shell[data-sidebar="open"] { grid-template-columns: minmax(0, 1fr); }
    .chat-sidebar {
      position: fixed; top: var(--nav-h); left: 0; bottom: 0; z-index: 60; width: min(86vw, var(--sidebar-w));
      border-right: 1px solid var(--line); box-shadow: var(--shadow-pop);
      transform: translateX(-102%); transition: transform var(--dur-3) var(--ease); visibility: hidden;
    }
    .chat-shell[data-sidebar="open"] .chat-sidebar { transform: none; visibility: visible; }
    .chat-shell[data-sidebar="open"] .chat-scrim {
      display: block; position: fixed; inset: var(--nav-h) 0 0 0; z-index: 59;
      background: rgba(0, 0, 0, 0.22); animation: fade-in var(--dur-2) var(--ease);
    }
    .side-inner { width: 100%; }
    .side-item-actions { opacity: 1; }
    .msg-actions { opacity: 1; }
  }

  @media (max-width: 640px) {
    .section { padding-block: 36px; }
    .section-lg { padding-block: 48px; }
    .hero { padding: 56px 0 48px; }
    .hero-sub { font-size: 16px; margin-top: 18px; }
    .hero-ctas { margin-top: 28px; }
    .hero-ctas .btn { flex: 1 1 160px; }
    .tile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .tile { min-height: 116px; padding: 14px; }
    .tile-title { padding-top: 20px; }
    .section-title, .h2 { font-size: 26px; }
    .page-title, .h1 { font-size: 32px; }
    .page-head { padding: 36px 0 20px; }
    .carousel { grid-auto-columns: 86%; gap: 12px; }
    .carousel-ctrls { display: none; }
    .model-strip-body { padding: 20px; }
    .mini-stat { padding: 10px; }
    .mini-stat-value { font-size: var(--t-lg); }
    .plan-card { padding: 20px; }
    .plan-amount { font-size: 38px; }
    .pricing-head { flex-direction: column; align-items: flex-start; }
    .projects-grid, .models-grid { grid-template-columns: 1fr; }
    .footer { margin-top: 64px; }
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 28px 16px; padding: 44px 0 32px; }
    .footer-grid > :first-child { grid-column: 1 / -1; grid-row: auto; }
    .footer-bottom { flex-direction: column; align-items: flex-start; }

    .chat-topbar { padding: 8px 12px 0; min-height: 48px; }
    .chat-empty { padding: 28px 16px 20px; }
    .chat-emblem { width: 56px; height: 56px; }
    .chat-greeting { font-size: var(--t-3xl); }
    .suggestions { grid-template-columns: 1fr; }
    .suggestions-title { margin-top: 28px; }
    .thread { padding: 16px 16px 24px; gap: 22px; }
    .msg-bubble { max-width: 90%; font-size: var(--t-base); }
    .msg-body, .md { font-size: var(--t-base); }
    .composer-dock { padding: 0 10px 10px; }
    .composer { padding: 12px 12px 10px 14px; border-radius: 18px; }
    .composer-input { font-size: 16px; }
    .engine-pill { padding: 0 10px 0 4px; }
    .engine-pill-label { display: none; }
    .seg-btn { padding: 0 10px; }
    .code-block pre code { font-size: 12.5px; }

    .account-card { padding: 18px; }
    .account-card-head, .account-row { flex-direction: column; align-items: stretch; }
    .account-row .btn { align-self: flex-start; }
    .auth-card { padding: 24px 20px; border: 0; box-shadow: none; }
    .dialog { padding: 20px; border-radius: var(--r-lg); }
    .dialog-actions .btn { flex: 1 1 auto; }
    .toast-stack { bottom: 16px; }
  }

  @media (max-width: 420px) {
    .nav-brand { font-size: 17px; }
    .chip-tile { margin-left: -0.26em; }
    .tile-sub { font-size: var(--t-sm); }
    .media-meta { grid-template-columns: 32px minmax(0, 1fr); }
    .media-aside { display: none; }
    .media-icon { width: 32px; height: 32px; }
    .mini-stats { grid-template-columns: 1fr; }
    .mini-stat + .mini-stat { border-left: 0; border-top: 1px solid var(--line); }
    .stat-grid { grid-template-columns: 1fr; }
    .stat-grid > .stat:nth-child(2n) { border-left: 0; }
    .model-side-inner { padding: 16px; }
    .model-cta-title { font-size: 24px; }
    .seg-btn .seg-label { display: none; }
    .composer-meta { padding: 0 2px; gap: 6px; }
    .project-chip { max-width: 140px; }
    .sheet-actions { grid-template-columns: 1fr; }
  }
}

/* =========================================================
   3. KEYFRAMES
   ========================================================= */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes sheet-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@keyframes pop-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes shimmer { to { transform: translateX(100%); } }
@keyframes caret { 50% { opacity: 0; } }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.45; } 40% { transform: translateY(-4px); opacity: 1; } }
@keyframes sweep { to { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes dash { to { stroke-dashoffset: -56; } }
@keyframes scan { 0% { transform: translateY(-10%); opacity: 0; } 15% { opacity: 0.8; } 85% { opacity: 0.8; } 100% { transform: translateY(110%); opacity: 0; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes pulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }

/* =========================================================
   4. REDUCED MOTION
   ========================================================= */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .art-sweep, .art-blink, .art-flow, .art-scan, .art-float, .art-pulse, .stream-caret, .skeleton::after { animation: none !important; }
  .art-blink { opacity: 0.8; }
  .spinner { animation: spin 1.6s linear infinite !important; }
}/* ---- appended from app/extra-a3.css (Opus) ---- */
/* Art motion for components/Art.tsx. Append to globals.css. */
@layer components {
  .art-sweep { transform-box: view-box; transform-origin: 160px 100px; animation: art-rotate 6s linear infinite; }
  .art-blink { animation: art-blink 2.4s ease-in-out infinite; }
  .art-blink.d2 { animation-delay: 0.8s; }
  .art-blink.d3 { animation-delay: 1.6s; }
  .art-flow { stroke-dasharray: 6 10; animation: art-flow 2.8s linear infinite; }
  .art-scan { animation: art-scan 5s var(--ease) infinite; }
  .art-swing { transform-box: fill-box; transform-origin: 0% 100%; animation: art-swing 5s ease-in-out infinite alternate; }
  .art-caret { animation: art-blink 1s steps(2, start) infinite; }
  .checkout-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-bottom: 20px; padding: 10px 14px; border-radius: var(--r-md);
    background: var(--surface-3); border: 1px solid var(--line-2); font-size: var(--t-13); color: var(--fg-2);
  }
  @keyframes art-rotate { to { transform: rotate(360deg); } }
  @keyframes art-blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
  @keyframes art-flow { to { stroke-dashoffset: -32; } }
  @keyframes art-scan { 0% { transform: translateY(-20px); } 100% { transform: translateY(220px); } }
  @keyframes art-swing { from { transform: rotate(-6deg); } to { transform: rotate(8deg); } }
  @media (prefers-reduced-motion: reduce) {
    .art-sweep, .art-blink, .art-flow, .art-scan, .art-swing, .art-caret { animation: none !important; }
  }
}

/* ---- appended from round1a3a extra (Opus) ---- */
@layer components {
  @media (max-width: 860px) {
    .footer-grid { grid-template-columns: 1fr 1fr; }
    .footer-grid > :first-child { grid-column: 1 / -1; }
  }
  @media (max-width: 640px) {
    .nav-inner { padding: 0 16px; }
    .footer-bottom { flex-direction: column; align-items: flex-start; }
  }
}

/* ---- integration glue (not Opus): accessible skip link ---- */
.skip-link { position: absolute; left: 8px; top: -48px; z-index: 100; padding: 8px 14px; border-radius: 999px; background: var(--fg); color: var(--bg); font-size: 13px; transition: top .15s; }
.skip-link:focus { top: 8px; }

CSS>>>

Scope of THIS call: homepage, pricing, models index, model detail page, top nav, footer, phone layouts of those.
<<<SOURCE components/marketing/HomeView.tsx
"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import type { ProviderInfo } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { HeroChips, RadarArt, RoboticsArt, ShieldArt, TerminalArt, RookWireArt, ArtGlyphs } from "@/components/Art";

export interface HomeViewProps { signedIn: boolean; provider: ProviderInfo }

const sv = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const IChat = () => <svg {...sv}><path d="M4 5h16v11H9l-5 4z" /></svg>;
const ICube = () => <svg {...sv}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></svg>;
const IFolder = () => <svg {...sv}><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /></svg>;
const IGauge = () => <svg {...sv}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /></svg>;
const IUser = () => <svg {...sv}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></svg>;
const INodes = () => <svg {...sv}><circle cx="12" cy="5" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M12 7v4M12 11l-5 5M12 11l5 5" /></svg>;
const IChevL = () => <svg {...sv} width={16} height={16}><path d="M15 6l-6 6 6 6" /></svg>;
const IChevR = () => <svg {...sv} width={16} height={16}><path d="M9 6l6 6-6 6" /></svg>;
const IArrow = () => <svg {...sv} width={14} height={14}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

const tiles: { title: string; sub: string; href?: string; icon: ReactNode; badge?: "new" | "soon" }[] = [
  { title: "Chat", sub: "Ask anything, think out loud", href: "/chat", icon: <IChat /> },
  { title: "Model", sub: "One engine, fully documented", href: "/models/citad3l-v1", icon: <ICube />, badge: "new" },
  { title: "Projects", sub: "Instructions that persist", href: "/projects", icon: <IFolder /> },
  { title: "Usage", sub: "Allowance at a glance", href: "/account", icon: <IGauge /> },
  { title: "Account", sub: "Plan, billing, your data", href: "/account", icon: <IUser /> },
  { title: "Workflows", sub: "Repeatable operations", icon: <INodes />, badge: "soon" },
];

const featured: { title: string; desc: string; tag: string; art: ReactNode; icon: ReactNode; prompt: string }[] = [
  { title: "Strategic briefings", desc: "Turn a fast-moving field into a clear assessment: what changed, why it matters, what to watch next.", tag: "AI advancement", art: <RadarArt />, icon: <ArtGlyphs.GlyphAI />, prompt: "/chat" },
  { title: "Robotics", desc: "Kinematics, control loops, sensor fusion and the state of embodied AI, explained at your depth.", tag: "Robotics", art: <RoboticsArt />, icon: <ArtGlyphs.GlyphRobot />, prompt: "/chat" },
  { title: "AI security", desc: "Threat-model an agent, reason about prompt injection, and harden the systems you ship.", tag: "Cybersecurity", art: <ShieldArt />, icon: <ArtGlyphs.GlyphShield />, prompt: "/chat" },
  { title: "Everyday work", desc: "Writing, code review, study plans and research summaries. The practical side of the same engine.", tag: "General", art: <TerminalArt />, icon: <Rook size={18} />, prompt: "/chat" },
];

const plans = [
  { name: "Trial", price: "$0", note: "once · 5 successful replies" },
  { name: "Pro", price: "$20", note: "/ month · monthly allowance", highlight: true },
  { name: "Max", price: "$50", note: "/ month · 2.5× Pro allowance" },
];

export function HomeView({ signedIn, provider }: HomeViewProps) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (el.clientWidth / 3 + 7), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <>
      <main className="page-main">
        <section className="hero container">
          <h1 className="display hero-title">
            Think ahead with <HeroChips /> one strategic engine built to answer.
          </h1>
          <p className="hero-sub">AI advancement, robotics and security, plus every everyday question in between. One open-weights model, no detours.</p>
          <div className="hero-ctas">
            <Link href="/chat" className="btn btn-primary btn-lg">{signedIn ? "Open chat" : "Start chatting"}</Link>
            <Link href="/pricing" className="btn btn-secondary btn-lg">See plans <IChevR /></Link>
          </div>
          {provider.mock && <div className="hero-note"><MockBadge provider={provider} /></div>}
        </section>

        <section className="container" aria-label="Product areas">
          <div className="tile-grid">
            {tiles.map((t) => {
              const inner = (
                <>
                  <span className="tile-icon">{t.icon}</span>
                  {t.badge === "new" && <span className="badge badge-new tile-badge">New</span>}
                  {t.badge === "soon" && <span className="badge badge-soon tile-badge">Coming soon</span>}
                  <span className="tile-title">{t.title}</span>
                  <span className="tile-sub">{t.sub}</span>
                </>
              );
              return t.href ? (
                <Link key={t.title} href={t.href} className="tile">{inner}</Link>
              ) : (
                <div key={t.title} className="tile is-muted" aria-disabled="true">{inner}</div>
              );
            })}
          </div>
        </section>

        <section className="section-lg container" aria-labelledby="featured-title">
          <div className="section-head">
            <h2 id="featured-title" className="section-title">Featured</h2>
            <div className="carousel-ctrls">
              <button type="button" className="round-btn" aria-label="Previous" onClick={() => scroll(-1)}><IChevL /></button>
              <button type="button" className="round-btn" aria-label="Next" onClick={() => scroll(1)}><IChevR /></button>
            </div>
          </div>
          <div className="carousel" ref={track} tabIndex={0} aria-label="Featured use cases">
            {featured.map((f) => (
              <Link key={f.title} href={f.prompt} className="media-card">
                <div className="media">
                  {f.art}
                  <span className="media-tag">{f.tag}</span>
                </div>
                <div className="media-meta">
                  <span className="media-icon">{f.icon}</span>
                  <div>
                    <div className="media-title">{f.title}</div>
                    <p className="media-desc">{f.desc}</p>
                  </div>
                  <span className="media-aside">Try it <IArrow /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="container" aria-labelledby="engine-title">
          <div className="section-head">
            <div>
              <h2 id="engine-title" className="section-title">The engine</h2>
              <p className="section-sub">Every plan runs the same model. No tiers of intelligence.</p>
            </div>
          </div>
          <div className="model-strip">
            <div className="model-strip-art"><RookWireArt /></div>
            <div className="model-strip-body">
              <div className="model-id">
                <span className="model-mark"><Rook size={24} /></span>
                <div>
                  <div className="model-name">Citad3L V1</div>
                  <div className="model-by">Huihui-Qwen3.8-27B-abliterated · by huihui-ai</div>
                </div>
              </div>
              <div className="pill-row">
                <span className="pill">Chat</span>
                <span className="pill">27.8B parameters</span>
                <span className="pill">GGUF · llama.cpp</span>
                <span className="pill"><span className="live-dot" />Text in</span>
              </div>
              <div className="mini-stats">
                <div className="mini-stat"><div className="mini-stat-label">Context</div><div className="mini-stat-value tnum">262K</div><div className="mini-stat-note">tokens</div></div>
                <div className="mini-stat"><div className="mini-stat-label">Downloads</div><div className="mini-stat-value tnum">4.29M</div><div className="mini-stat-note">Hugging Face, Nov 2026</div></div>
                <div className="mini-stat"><div className="mini-stat-label">Likes</div><div className="mini-stat-value tnum">2.28K</div><div className="mini-stat-note">Hugging Face, Nov 2026</div></div>
              </div>
              <p className="tiny">Open weights, Apache-2.0 base. Citad3L is not affiliated with huihui-ai or Qwen.</p>
              <div className="btn-row">
                <Link href="/models/citad3l-v1" className="btn btn-primary">View model</Link>
                <Link href="/chat" className="btn btn-secondary">Chat now</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-lg container" aria-labelledby="how-title">
          <div className="section-head">
            <div>
              <h2 id="how-title" className="section-title">How it works</h2>
              <p className="section-sub">Three moves from question to answer.</p>
            </div>
          </div>
          <div className="steps">
            <div className="step"><div className="step-num">01</div><div className="step-title">Sign in</div><p className="step-body">Start on the trial with five successful replies. No card.</p></div>
            <div className="step"><div className="step-num">02</div><div className="step-title">Set the board</div><p className="step-body">Group work into projects with standing instructions so context carries forward.</p></div>
            <div className="step"><div className="step-num">03</div><div className="step-title">Make your move</div><p className="step-body">Ask, iterate, retry. Failed or stopped replies never count against you.</p></div>
          </div>

          <div className="section-head" style={{ marginTop: 56 }}>
            <div>
              <h2 className="section-title">Plans</h2>
              <p className="section-sub">Same engine and features everywhere. Bigger plans add allowance.</p>
            </div>
            <Link href="/pricing" className="btn btn-secondary btn-sm">Compare <IChevR /></Link>
          </div>
          <div className="plan-teaser">
            {plans.map((p) => (
              <Link key={p.name} href="/pricing" className={`plan-mini${p.highlight ? " is-highlight" : ""}`}>
                <span className="h4">{p.name}</span>
                <span className="plan-mini-price tnum">{p.price}</span>
                <span className="tiny text-3">{p.note}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default HomeView;

SOURCE>>>
<<<SOURCE components/marketing/PricingView.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanCard, PlanId } from "@/lib/types";
import { Footer } from "@/components/Footer";
import { HeroChips } from "@/components/Art";

export interface PricingViewProps {
  plans: PlanCard[];
  signedIn: boolean;
  currentPlan?: PlanId | null;
  billingConfigured: boolean;
}

const sv = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ICheck = () => <svg {...sv} width={12} height={12}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const IChevR = () => <svg {...sv} width={14} height={14}><path d="M9 6l6 6-6 6" /></svg>;
const IPlus = () => <svg {...sv} width={16} height={16}><path d="M12 5v14M5 12h14" /></svg>;
const IClose = () => <svg {...sv} width={14} height={14}><path d="M6 6l12 12M18 6L6 18" /></svg>;

const DOTS: Record<PlanId, number> = { trial: 1, pro: 2, max: 5 };
const NOT_CONFIGURED = "Test-mode billing not configured yet";

function Dots({ n }: { n: number }) {
  return (
    <span className="usage-dots" aria-label={`${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < n ? "on" : ""} />)}
    </span>
  );
}

const faqs = [
  { q: "Is the model different on each plan?", a: "No. Trial, Pro and Max all run Citad3L V1 with the same features. Max simply gives you 2.5× the Pro allowance." },
  { q: "Do failed or stopped replies count?", a: "Never. Only successful replies use your allowance. If a reply errors out or you stop it, nothing is charged." },
  { q: "When does my allowance reset?", a: "Paid allowances reset monthly on your billing date. The trial is a one-time grant of five successful replies." },
  { q: "Can I change or cancel?", a: "Yes, any time from your account. Cancelling keeps your plan active until the end of the current period." },
];

export function PricingView({ plans, signedIn, currentPlan, billingConfigured }: PricingViewProps) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [notes, setNotes] = useState<Partial<Record<PlanId, string>>>({});
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") === "canceled") {
      setCanceled(true);
      url.searchParams.delete("checkout");
      window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    }
  }, []);

  const note = (id: PlanId, msg: string) => setNotes((n) => ({ ...n, [id]: msg }));

  async function choose(plan: PlanCard) {
    if (plan.id === "trial") {
      window.location.href = signedIn ? "/chat" : "/login?next=/chat";
      return;
    }
    if (!signedIn) {
      window.location.href = "/login?next=/pricing";
      return;
    }
    if (!billingConfigured) { note(plan.id, NOT_CONFIGURED); return; }
    setBusy(plan.id);
    note(plan.id, "");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } };
      if (res.ok && data.url) { window.location.href = data.url; return; }
      if (res.status === 401) { window.location.href = "/login?next=/pricing"; return; }
      note(plan.id, data.error?.code === "billing_not_configured" ? NOT_CONFIGURED : data.error?.message || "Checkout could not start. Please try again.");
    } catch {
      note(plan.id, "Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <main className="page-main">
        <section className="hero container">
          <h1 className="display hero-title">
            One strategic <HeroChips /> engine, every plan, a price that scales with you.
          </h1>
          <p className="hero-sub">Same model and features on every plan. Pick an allowance, change or cancel any time from your account.</p>
          <div className="hero-ctas">
            <Link href={signedIn ? "/chat" : "/login?next=/chat"} className="btn btn-primary btn-lg">Get started</Link>
            <a href="#plans" className="btn btn-secondary btn-lg">Compare plans <IChevR /></a>
          </div>
        </section>

        <section id="plans" className="container container-narrow">
          {canceled && (
            <div className="checkout-banner" role="status">
              <span>Checkout canceled. Nothing was charged, and your plan is unchanged.</span>
              <button type="button" className="icon-btn icon-btn-sm" aria-label="Dismiss" onClick={() => setCanceled(false)}><IClose /></button>
            </div>
          )}
          <div className="pricing-head">
            <div>
              <h2 className="pricing-head-title">All plans</h2>
              <p className="tiny" style={{ marginTop: 4 }}>For individuals and small teams. Prices in US dollars.</p>
            </div>
            <span className="tiny">Trial, Pro, Max</span>
          </div>

          <div className="pricing-grid">
            {plans.map((p) => {
              const isCurrent = currentPlan === p.id;
              const hl = !!p.highlight;
              return (
                <article key={p.id} className={`plan-card${hl ? " is-highlight" : ""}`} aria-labelledby={`plan-${p.id}`}>
                  <div className="plan-top">
                    <h3 id={`plan-${p.id}`} className="plan-name">{p.name}</h3>
                    {hl && <span className="badge badge-dark">Most popular</span>}
                    {p.id === "max" && <span className="plan-mult">2.5× Pro</span>}
                  </div>
                  <p className="plan-blurb">{p.blurb}</p>
                  <div className="plan-price">
                    <span className="plan-amount tnum">${p.priceUsd}</span>
                    <span className="plan-period">{p.id === "trial" ? "once" : "/ month"}</span>
                  </div>
                  <div className="plan-cta">
                    <button
                      type="button"
                      className={`btn btn-lg btn-block ${hl ? "btn-inverse" : "btn-secondary"}`}
                      onClick={() => choose(p)}
                      disabled={busy !== null || isCurrent}
                      aria-busy={busy === p.id}
                    >
                      {busy === p.id && <span className="spinner" />}
                      {isCurrent ? "Current plan" : p.cta}
                    </button>
                    {notes[p.id] && <p className="plan-note" role="status">{notes[p.id]}</p>}
                  </div>

                  <div className="plan-section">
                    <div className="plan-section-label">Usage</div>
                    <div className="plan-row"><span className="plan-check"><ICheck /></span><span>Allowance</span><span className="plan-row-value">{p.allowance}</span></div>
                    <div className="plan-row"><span className="plan-check"><ICheck /></span><span>Relative allowance</span><span className="plan-row-value"><Dots n={DOTS[p.id]} /></span></div>
                  </div>
                  <div className="plan-section">
                    <div className="plan-section-label">Included</div>
                    {p.features.map((f) => (
                      <div key={f} className="plan-row"><span className="plan-check"><ICheck /></span><span>{f}</span><span /></div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="pricing-legend">
            <span className="pricing-legend-line"><Dots n={2} /> Dots show relative allowance. Max is 2.5× Pro.</span>
            <p className="pricing-fine">
              Failed and stopped replies are never charged. Paid allowances reset monthly on your billing date; the trial is a one-time grant of 5 successful replies with no card required. Every plan runs Citad3L V1 with identical features.
            </p>
          </div>
        </section>

        <section className="section-lg container" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-title" style={{ textAlign: "center", marginBottom: 28 }}>Questions</h2>
          <div className="faq">
            {faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}<IPlus /></summary>
                <p className="faq-body">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default PricingView;

SOURCE>>>
<<<SOURCE components/model/ModelView.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProviderInfo } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { RookWireArt } from "@/components/Art";

export interface ModelViewProps { provider: ProviderInfo; signedIn: boolean }

const HF_REPO = "https://huggingface.co/huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF";
const HF_BASE = "https://huggingface.co/Qwen/Qwen3.8-27B";

const sv = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const IPanel = () => <svg {...sv} width={16} height={16}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M9 5v14" /></svg>;
const IHeart = () => <svg {...sv} width={15} height={15}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>;
const IExt = () => <svg {...sv} width={12} height={12}><path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" /></svg>;

export function ModelView({ provider, signedIn }: ModelViewProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <main className="model-layout" data-collapsed={collapsed}>
        <aside className="model-side" aria-label="Model information" aria-hidden={collapsed} inert={collapsed}>
          <div className="model-side-inner">
            <div className="model-art"><RookWireArt /></div>

            <div>
              <div className="model-head">
                <span className="model-mark"><Rook size={24} /></span>
                <div>
                  <h1 className="model-title">Citad3L V1</h1>
                  <div className="model-by">Huihui-Qwen3.8-27B-abliterated · by huihui-ai</div>
                </div>
              </div>
              <div className="pill-row" style={{ marginTop: 14 }}>
                <span className="pill">Chat</span>
                <span className="pill">27.8B parameters</span>
                <span className="pill">{provider.mock ? <span className="amber-dot" /> : <span className="live-dot" />}{provider.mock ? "Mock" : "Live"}</span>
              </div>
            </div>

            <p className="model-desc">
              The single engine behind Citad3L: an open-weights 27B model with refusals removed, tuned for long, direct answers. Strong at strategic analysis, code and research, from AI advancement and robotics to security reasoning.
            </p>

            <div className="stat-card">
              <div className="stat-grid">
                <div className="stat"><div className="stat-label">Downloads</div><div className="stat-value tnum">4.29M</div><div className="stat-note">Hugging Face, Nov 2026</div></div>
                <div className="stat"><div className="stat-label">Likes</div><div className="stat-value tnum"><IHeart />2.28K</div><div className="stat-note">Hugging Face, Nov 2026</div></div>
                <div className="stat"><div className="stat-label">Status</div><div className="stat-value stat-value-sm">{provider.mock ? <><span className="amber-dot" />Mock</> : <><span className="live-dot" />Live</>}</div></div>
                <div className="stat"><div className="stat-label">Context</div><div className="stat-value stat-value-sm tnum">262,144 tokens</div></div>
                <div className="stat span-2"><div className="stat-label">Plans</div><div className="stat-value stat-value-sm">Every plan, same engine</div><div className="stat-note">Max adds allowance only. Failed replies are never charged.</div></div>
              </div>
            </div>

            <dl className="facts">
              <div className="facts-title">Model facts</div>
              <div className="fact-row"><dt>Size</dt><dd className="tnum">~27.8B</dd></div>
              <div className="fact-row"><dt>Context</dt><dd className="tnum">262,144 tokens</dd></div>
              <div className="fact-row"><dt>Format</dt><dd>GGUF quantizations</dd></div>
              <div className="fact-row"><dt>Runtime</dt><dd>llama.cpp</dd></div>
              <div className="fact-row"><dt>Inputs</dt><dd>Text</dd></div>
              <div className="fact-row"><dt>Base model</dt><dd>Qwen/Qwen3.8-27B</dd></div>
              <div className="fact-row"><dt>License</dt><dd>Apache-2.0</dd></div>
              <div className="fact-row"><dt>Serving</dt><dd>{provider.label}</dd></div>
            </dl>

            <div className="attribution">
              <div className="attribution-title">Attribution</div>
              <p>
                Citad3L V1 is the product name for <a className="link" href={HF_REPO} target="_blank" rel="noreferrer">Huihui-Qwen3.8-27B-abliterated-GGUF</a> by huihui-ai, as served by Citad3L. It derives from <a className="link" href={HF_BASE} target="_blank" rel="noreferrer">Qwen/Qwen3.8-27B</a>, released under Apache-2.0.
              </p>
              <p style={{ marginTop: 8 }}>Citad3L is not affiliated with, or endorsed by, huihui-ai or Qwen.</p>
              <div className="link-row">
                <a className="btn btn-outline btn-xs" href={HF_REPO} target="_blank" rel="noreferrer">Model repo <IExt /></a>
                <a className="btn btn-outline btn-xs" href={HF_BASE} target="_blank" rel="noreferrer">Base model <IExt /></a>
              </div>
            </div>
          </div>
        </aside>

        <section className="model-panel" aria-label="Start using Citad3L V1">
          <button
            type="button"
            className="icon-btn icon-btn-sm model-panel-toggle"
            aria-label={collapsed ? "Show model information" : "Hide model information"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
          >
            <IPanel />
          </button>
          <div className="model-cta">
            <span className="model-cta-mark"><Rook size={36} /></span>
            <h2 className="model-cta-title">{signedIn ? "Citad3L V1 is ready for you" : "Citad3L V1 runs on every plan"}</h2>
            <p className="model-cta-sub">
              {signedIn ? "Open a chat and make your first move." : "Start with 5 free successful replies. No card needed."}
            </p>
            <div className="model-cta-actions">
              {signedIn ? (
                <>
                  <Link href="/chat" className="btn btn-primary">Go to Chat</Link>
                  <Link href="/pricing" className="btn btn-secondary">See plans</Link>
                </>
              ) : (
                <>
                  <Link href="/login?next=/chat" className="btn btn-primary">Sign up</Link>
                  <Link href="/pricing" className="btn btn-secondary">See plans</Link>
                </>
              )}
            </div>
            <MockBadge provider={provider} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default ModelView;

SOURCE>>>
<<<SOURCE components/model/ModelsIndexView.tsx
import Link from "next/link";
import type { ProviderInfo } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { RookWireArt } from "@/components/Art";

export interface ModelsIndexViewProps { provider: ProviderInfo; signedIn: boolean }

const IArrow = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function ModelsIndexView({ provider, signedIn }: ModelsIndexViewProps) {
  return (
    <>
      <main className="page-main container">
        <header className="page-head">
          <h1 className="page-title">Models</h1>
          <p className="page-sub">One engine, chosen deliberately. Every plan runs it with the same features.</p>
        </header>
        <div className="page-toolbar">
          <span className="tiny">1 model</span>
          <MockBadge provider={provider} />
        </div>
        <div className="models-grid">
          <Link href="/models/citad3l-v1" className="media-card">
            <div className="media">
              <RookWireArt />
              <span className="media-tag">{provider.mock ? <span className="amber-dot" /> : <span className="live-dot" />}{provider.mock ? "Mock" : "Live"}</span>
            </div>
            <div className="media-meta">
              <span className="media-icon"><Rook size={18} /></span>
              <div>
                <div className="media-title">Citad3L V1</div>
                <p className="media-desc">Chat / 27.8B parameters · 262K context</p>
              </div>
              <span className="media-aside">Details <IArrow /></span>
            </div>
          </Link>
          <div className="placeholder-card">
            <span className="h4">Why one model?</span>
            <p>Depth over menus. One well-understood engine means consistent answers, honest usage accounting and no tier of lesser intelligence.</p>
          </div>
          <div className="placeholder-card">
            <span className="h4">{signedIn ? "Ready when you are" : "Try it free"}</span>
            <p>{signedIn ? "Open a chat and put Citad3L V1 to work." : "Five successful replies on the trial, no card needed."}</p>
            <div><Link href={signedIn ? "/chat" : "/login?next=/chat"} className="btn btn-primary btn-sm">{signedIn ? "Go to Chat" : "Start free"}</Link></div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default ModelsIndexView;

SOURCE>>>
<<<SOURCE components/TopNav.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rook } from "@/components/Rook";

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />
    </svg>
  );
}
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface NavItem { href: string; label: string; match: (p: string) => boolean; }

const LINKS: NavItem[] = [
  { href: "/", label: "Explore", match: (p) => p === "/" },
  { href: "/chat", label: "Chat", match: (p) => p === "/chat" || p.startsWith("/chat/") },
  { href: "/models", label: "Models", match: (p) => p === "/models" || p.startsWith("/models/") },
  { href: "/projects", label: "Projects", match: (p) => p.startsWith("/projects") },
];

function initials(label?: string): string {
  if (!label) return "C";
  const base = label.includes("@") ? label.split("@")[0] : label;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return s.toUpperCase() || "C";
}

export interface TopNavProps { signedIn: boolean; userLabel?: string; }

export function TopNav({ signedIn, userLabel }: TopNavProps) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = React.useState(false);
  const burgerRef = React.useRef<HTMLButtonElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const [isPhone, setIsPhone] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const update = () => {
      setIsPhone(mq.matches);
      if (!mq.matches) setOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  React.useEffect(() => { setOpen(false); }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pricingActive = pathname.startsWith("/pricing");
  const accountActive = pathname.startsWith("/account");

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand" aria-label="Citad3L home">
          <Rook size={isPhone ? 22 : 18} />
          <span>Citad3L</span>
        </Link>

        {!isPhone && (
          <nav className="nav-links" aria-label="Primary">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" aria-current={l.match(pathname) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="nav-right">
          <Link href="/chat" className="icon-btn nav-icon" aria-label="Search chats">
            <SearchIcon />
          </Link>
          {!isPhone ? (
            <div className="nav-desktop">
              <Link href="/projects" className="icon-btn nav-icon" aria-label="Projects">
                <FolderIcon />
              </Link>
              <Link href="/pricing" className="nav-text" aria-current={pricingActive ? "page" : undefined}>
                Pricing
              </Link>
              {signedIn ? (
                <Link
                  href="/account"
                  className="nav-avatar"
                  aria-label={`Account${userLabel ? ` (${userLabel})` : ""}`}
                  aria-current={accountActive ? "page" : undefined}
                  title={userLabel}
                >
                  {initials(userLabel)}
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary btn-sm">Log in</Link>
                  <Link href="/login?next=/chat" className="btn btn-primary btn-sm">Get started</Link>
                </>
              )}
            </div>
          ) : (
            <button
              ref={burgerRef}
              type="button"
              className="icon-btn nav-icon"
              style={{ display: "inline-grid" }}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="nav-sheet"
              onClick={() => setOpen((o) => !o)}
            >
              <MenuIcon open={open} />
            </button>
          )}
        </div>
      </div>

      {isPhone && open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="nav-sheet" ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="sheet-link" aria-current={l.match(pathname) ? "page" : undefined}>
                {l.label}
                <ChevronIcon />
              </Link>
            ))}
            <Link href="/pricing" className="sheet-link" aria-current={pricingActive ? "page" : undefined}>
              Pricing
              <ChevronIcon />
            </Link>
            {signedIn && (
              <Link href="/account" className="sheet-link" aria-current={accountActive ? "page" : undefined}>
                <span>Account{userLabel ? <span className="text-3"> · {userLabel}</span> : null}</span>
                <ChevronIcon />
              </Link>
            )}
            {!signedIn && (
              <div className="sheet-actions">
                <Link href="/login" className="btn btn-secondary">Log in</Link>
                <Link href="/login?next=/chat" className="btn btn-primary">Get started</Link>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}

export default TopNav;

SOURCE>>>
<<<SOURCE components/Art.tsx
import { useId } from "react";
import { Rook } from "@/components/Rook";

type ArtProps = { className?: string };

const svgProps = {
  viewBox: "0 0 320 200",
  preserveAspectRatio: "xMidYMid slice",
  "aria-hidden": true,
  focusable: false,
} as const;

function Grid({ id, step = 20, opacity = 0.07 }: { id: string; step?: number; opacity?: number }) {
  return (
    <>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          <path d={`M${step} 0H0V${step}`} fill="none" stroke="#fff" strokeOpacity={opacity} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="320" height="200" fill={`url(#${id})`} />
    </>
  );
}

export function RadarArt({ className }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg {...svgProps} className={className ?? "art-fill"}>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="50%" r="70%">
          <stop offset="0" stopColor="#10202a" />
          <stop offset="1" stopColor="#05070b" />
        </radialGradient>
        <linearGradient id={`${id}sw`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5ee6d0" stopOpacity="0" />
          <stop offset="1" stopColor="#5ee6d0" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}bg)`} />
      <Grid id={`${id}g`} />
      <g fill="none" stroke="#5ee6d0" strokeOpacity="0.35" strokeWidth="0.8">
        {[24, 48, 72, 96].map((r) => <circle key={r} cx="160" cy="100" r={r} />)}
        <path d="M160 0V200M40 100H280" strokeOpacity="0.18" />
      </g>
      <path className="art-sweep" d="M160 100L256 100A96 96 0 0 0 228 32Z" fill={`url(#${id}sw)`} />
      <g fill="#5ee6d0">
        <circle className="art-blink" cx="204" cy="66" r="3" />
        <circle className="art-blink d2" cx="118" cy="134" r="2.5" />
        <circle className="art-blink d3" cx="186" cy="152" r="2" />
      </g>
      <g fill="#ffb547"><circle className="art-blink d2" cx="104" cy="58" r="3" /></g>
      <g fontFamily="ui-monospace, monospace" fontSize="7" fill="#ffffff" fillOpacity="0.45">
        <text x="14" y="20">SECTOR 07 · WATCH</text>
        <text x="14" y="188">BRG 041° · RNG 3.2</text>
        <text x="250" y="188">LIVE FEED</text>
      </g>
    </svg>
  );
}

export function RoboticsArt({ className }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg {...svgProps} className={className ?? "art-fill"}>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141029" />
          <stop offset="1" stopColor="#05070b" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}bg)`} />
      <Grid id={`${id}g`} step={16} opacity={0.06} />
      <path d="M0 168H320" stroke="#8d7cff" strokeOpacity="0.4" />
      <g fill="none" stroke="#8d7cff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="120" y="150" width="56" height="18" rx="3" />
        <g className="art-swing">
          <path d="M148 150L148 116L196 78" strokeWidth="6" stroke="#2a2550" />
          <path d="M148 150L148 116L196 78" />
          <circle cx="148" cy="116" r="6" fill="#05070b" />
          <circle cx="196" cy="78" r="5" fill="#05070b" />
          <path d="M196 78L222 70M222 70l8-8M222 70l10 4" />
        </g>
      </g>
      <g fill="none" stroke="#5ee6d0" strokeOpacity="0.7" strokeDasharray="2 4">
        <path d="M236 64c20 10 30 34 22 60" />
      </g>
      <rect x="244" y="124" width="22" height="22" rx="3" fill="none" stroke="#5ee6d0" strokeOpacity="0.8" />
      <g fontFamily="ui-monospace, monospace" fontSize="7" fill="#ffffff" fillOpacity="0.45">
        <text x="14" y="20">ARM-02 · 6 DOF</text>
        <text x="14" y="188">J1 −12° J2 34° J3 71°</text>
        <text x="240" y="118">TARGET</text>
      </g>
    </svg>
  );
}

export function ShieldArt({ className }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg {...svgProps} className={className ?? "art-fill"}>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor="#1a1410" />
          <stop offset="1" stopColor="#05070b" />
        </radialGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}bg)`} />
      <g fill="none" stroke="#ffb547" strokeOpacity="0.5" strokeWidth="1">
        <path className="art-flow" d="M0 60H90V100H130" />
        <path className="art-flow" d="M0 140H70V112H130" />
        <path className="art-flow" d="M320 50H240V96H190" />
        <path className="art-flow" d="M320 150H250V110H190" />
      </g>
      <g fill="#ffb547">
        <circle cx="90" cy="60" r="2" /><circle cx="70" cy="140" r="2" />
        <circle cx="240" cy="50" r="2" /><circle cx="250" cy="150" r="2" />
      </g>
      <path d="M160 46l34 12v30c0 26-16 44-34 54-18-10-34-28-34-54V58z" fill="#0e1520" stroke="#ffb547" strokeWidth="1.5" />
      <path d="M146 96l10 10 20-22" fill="none" stroke="#5ee6d0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <g fontFamily="ui-monospace, monospace" fontSize="7" fill="#ffffff" fillOpacity="0.45">
        <text x="14" y="20">THREAT MODEL · v3</text>
        <text x="14" y="188">INGRESS FILTERED · 0 OPEN</text>
      </g>
    </svg>
  );
}

export function TerminalArt({ className }: ArtProps) {
  const id = useId().replace(/:/g, "");
  const lines = [
    "$ citad3l brief --topic frontier-ai",
    "› scanning sources …",
    "› 3 developments flagged",
    "› compute ↑   agents ↑   evals ~",
    "› drafting assessment",
  ];
  return (
    <svg {...svgProps} className={className ?? "art-fill"}>
      <rect width="320" height="200" fill="#05070b" />
      <Grid id={`${id}g`} step={10} opacity={0.04} />
      <g fontFamily="ui-monospace, monospace" fontSize="9">
        {lines.map((l, i) => (
          <text key={l} x="20" y={44 + i * 18} fill={i === 0 ? "#5ee6d0" : "#ffffff"} fillOpacity={i === 0 ? 1 : 0.6}>{l}</text>
        ))}
      </g>
      <rect className="art-caret" x="20" y="136" width="6" height="10" fill="#5ee6d0" />
      <rect className="art-scan" x="0" y="0" width="320" height="18" fill="#5ee6d0" fillOpacity="0.05" />
      <circle cx="20" cy="18" r="3" fill="#ff6b5b" /><circle cx="30" cy="18" r="3" fill="#ffb547" /><circle cx="40" cy="18" r="3" fill="#5ee6d0" />
    </svg>
  );
}

export function RookWireArt({ className }: ArtProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg {...svgProps} className={className ?? "art-fill"}>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="60%" r="65%">
          <stop offset="0" stopColor="#151b2b" />
          <stop offset="1" stopColor="#05070b" />
        </radialGradient>
        <linearGradient id={`${id}st`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5ee6d0" />
          <stop offset="1" stopColor="#8d7cff" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}bg)`} />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.06">
        {Array.from({ length: 9 }, (_, i) => <path key={`h${i}`} d={`M20 ${150 + i * 6}H300`} />)}
        {Array.from({ length: 15 }, (_, i) => <path key={`v${i}`} d={`M${160 + (i - 7) * 8} 150L${160 + (i - 7) * 26} 200`} />)}
      </g>
      <g fill="none" stroke={`url(#${id}st)`} strokeWidth="1.2" strokeLinejoin="round">
        <path d="M128 40h12v12h12V40h16v12h12V40h12v28l-10 8v54l14 12v12h-72v-12l14-12V76l-10-8z" />
        <path d="M128 68h64M138 76h44M136 130h48M128 142h64" strokeOpacity="0.6" />
        <path d="M154 92h12v18h-12z" strokeOpacity="0.8" />
        <path d="M138 76L182 130M182 76L138 130" strokeOpacity="0.18" />
      </g>
      <rect className="art-scan" x="0" y="0" width="320" height="14" fill="#8d7cff" fillOpacity="0.07" />
      <g fontFamily="ui-monospace, monospace" fontSize="7" fill="#ffffff" fillOpacity="0.45">
        <text x="14" y="20">CITAD3L V1 · 27.8B</text>
        <text x="236" y="20">CTX 262,144</text>
      </g>
    </svg>
  );
}

/* ----- Hero glyph chips ----- */
function GlyphAI() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="3" fill="#8d7cff" stroke="none" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
function GlyphRobot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="8" width="14" height="11" rx="3" />
      <path d="M12 4v4M3 13v2M21 13v2" strokeLinecap="round" />
      <circle cx="9.5" cy="13" r="1.4" fill="#16b8a0" stroke="none" />
      <circle cx="14.5" cy="13" r="1.4" fill="#16b8a0" stroke="none" />
    </svg>
  );
}
function GlyphShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" />
      <path d="M9 12l2 2 4-4" stroke="#d48806" strokeLinecap="round" />
    </svg>
  );
}

export function HeroChips() {
  return (
    <span className="chip-cluster" aria-hidden>
      <span className="chip-tile"><GlyphAI /></span>
      <span className="chip-tile"><GlyphRobot /></span>
      <span className="chip-tile"><GlyphShield /></span>
      <span className="chip-tile"><Rook size={40} /></span>
    </span>
  );
}

export const ArtGlyphs = { GlyphAI, GlyphRobot, GlyphShield };

export default HeroChips;

SOURCE>>>
# Output format (strict)
1. `CRITIQUE` — max 15 bullets: the most important likeness/identity gaps you see, and what you're changing.
2. Then changes, using ONLY these block types:
   - `=== FILE: app/round2-<area>.css ===` … `=== END FILE ===` — a CSS override appendix (it is appended after globals.css; wrap rules in `@layer components { }`).
   - `=== PATCH: <path> ===` then one or more pairs `<<<FIND` (exact existing text, unique in that file) / `>>>REPLACE` (new text) / `<<<END`, then `=== END PATCH ===` — for targeted code edits.
   - `=== FILE: <path> ===` full replacement only if a component needs a substantial rewrite (max 2 full files).
No other prose. Keep the API contracts and props unchanged.
Use area name `marketing` for the CSS file.