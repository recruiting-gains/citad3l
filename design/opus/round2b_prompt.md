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

Scope of THIS call: chat workspace (desktop + phone), projects, account, login, limit-reached state. Known issues to fix: (1) composer bottom hint line is cut off / crowded at viewport bottom on desktop and wraps on phone; (2) a 'Chat / Agents' segmented toggle was copied from the reference but Citad3L has no agents feature — remove it or replace it with something truthful (e.g. no toggle, or a project picker); (3) on a trial account with 0 left the composer placeholder says "You've used this period's allowance" — trial should say trial; (4) check the sidebar Recents skeleton/empty states; (5) phone composer + meta row density.
<<<SOURCE components/chat/ChatWorkspace.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ConversationListItem, Project, ProviderInfo, UsageSummary } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { MockBadge } from "@/components/MockBadge";
import { LimitReached } from "@/components/LimitReached";
import { Markdown } from "@/components/chat/Markdown";

const MAX_CHARS = 8000;
const NEAR_CHARS = 7000;

export interface ChatWorkspaceProps {
  initialConversationId?: string | null;
  initialProjectId?: string | null;
  userLabel: string;
  provider: ProviderInfo;
  initialUsage: UsageSummary;
}

/* ---------- local icons ---------- */
function Ic({ children, size = 16, sw = 1.5 }: { children: React.ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const ISearch = () => <Ic size={14}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></Ic>;
const IPanel = () => <Ic><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M6 3v10M3.8 6h.6M3.8 8h.6" /></Ic>;
const IPen = () => <Ic><path d="M10.5 2.5l3 3L6 13H3v-3z" /></Ic>;
const IFolder = ({ size = 15 }: { size?: number }) => <Ic size={size}><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.5 1.5h4.7A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" /></Ic>;
const IPlus = () => <Ic><path d="M8 3v10M3 8h10" /></Ic>;
const ITrash = () => <Ic size={13}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></Ic>;
const IEdit = () => <Ic size={13}><path d="M10.5 2.5l3 3L6 13H3v-3z" /></Ic>;
const ICopy = () => <Ic size={14}><rect x="5" y="5" width="8.5" height="8.5" rx="2" /><path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5" /></Ic>;
const ICheck = () => <Ic size={14} sw={1.8}><path d="M3 8.5l3.2 3L13 4.5" /></Ic>;
const IRetry = () => <Ic size={14}><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.8h-2.8" /></Ic>;
const IUp = () => <Ic size={16} sw={1.8}><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></Ic>;
const IDown = () => <Ic size={14}><path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" /></Ic>;
const IChev = () => <Ic size={12}><path d="M4 6l4 4 4-4" /></Ic>;
const IClose = () => <Ic size={13}><path d="M4 4l8 8M12 4l-8 8" /></Ic>;
const IChat = () => <Ic size={15}><path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v6A1.5 1.5 0 0 1 12 11.5H6.5L3.5 14v-2.5A1.5 1.5 0 0 1 2.5 10z" /></Ic>;
const IBot = () => <Ic size={15}><rect x="2.5" y="4.5" width="11" height="8.5" rx="2.5" /><path d="M8 2v2.5M6 8.5v.5M10 8.5v.5" /></Ic>;
const ISpark = () => <Ic><path d="M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.5 3.5l2.3 2.3M10.2 10.2l2.3 2.3M12.5 3.5l-2.3 2.3M5.8 10.2l-2.3 2.3" /></Ic>;
const IArm = () => <Ic><path d="M3 14h6M5 14V11l5-5M10 6l3 1.5M10 6L8.5 3" /><circle cx="5" cy="11" r="1" /><circle cx="10" cy="6" r="1" /></Ic>;
const IShield = () => <Ic><path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z" /><path d="M6 8l1.5 1.5L10.5 6.5" /></Ic>;
const INote = () => <Ic><path d="M4 2.5h6l2.5 2.5v8.5h-8.5z" /><path d="M6 8h4.5M6 10.5h3" /></Ic>;
const IWarn = () => <Ic><path d="M8 2l6.5 11.5h-13z" /><path d="M8 6.5v3M8 11.5v.2" /></Ic>;
const IWifi = () => <Ic><path d="M2 6a9 9 0 0 1 12 0M4.3 8.5a5.5 5.5 0 0 1 7.4 0M6.5 11a2.2 2.2 0 0 1 3 0M2.5 2.5l11 11" /></Ic>;

/* ---------- helpers ---------- */
type Banner = { kind: "error" | "offline" | "warn"; title: string; text: string; retry?: () => void; login?: boolean };
type Toast = { id: number; kind: "error" | "warn" | "ok"; text: string };

const uid = () => Math.random().toString(36).slice(2, 10);

function firstName(label: string): string {
  const base = label.includes("@") ? label.split("@")[0] : label;
  const w = base.trim().split(/\s+/)[0] ?? "";
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}
function initials(label: string): string {
  const base = label.includes("@") ? label.split("@")[0] : label;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "")).toUpperCase();
}
function groupOf(iso: string): "Today" | "Previous 7 days" | "Older" {
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return "Today";
  if (d.getTime() >= start - 7 * 86400000) return "Previous 7 days";
  return "Older";
}

const SUGGESTIONS = [
  { kicker: "AI advancement", text: "Brief me on the most important open problems in AI reasoning right now.", icon: <ISpark /> },
  { kicker: "Robotics", text: "Compare approaches to robot manipulation: classical planning vs. learned policies.", icon: <IArm /> },
  { kicker: "AI security", text: "Outline a threat model for an LLM app that calls external tools.", icon: <IShield /> },
  { kicker: "Everyday", text: "Help me draft a clear, friendly email declining a meeting.", icon: <INote /> },
];

/* ---------- component ---------- */
export function ChatWorkspace({ initialConversationId = null, initialProjectId = null, userLabel, provider, initialUsage }: ChatWorkspaceProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convsLoaded, setConvsLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(!!initialConversationId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<UsageSummary>(initialUsage);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [input, setInput] = useState("");
  const [sidebar, setSidebar] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [greeting, setGreeting] = useState("Hello");

  const convRef = useRef<string | null>(initialConversationId);
  const projRef = useRef<string | null>(initialProjectId);
  const liveRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef<ChatMessage[]>([]);
  msgsRef.current = messages;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const name = firstName(userLabel);
  const limitHit = usage.limit > 0 && usage.remaining <= 0;

  /* toasts */
  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const r = await fetch("/api/usage");
      if (r.ok) {
        const j = (await r.json()) as { usage: UsageSummary };
        setUsage(j.usage);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([fetch("/api/conversations"), fetch("/api/projects")]);
      if (c.ok) setConversations(((await c.json()) as { conversations: ConversationListItem[] }).conversations);
      if (p.ok) setProjects(((await p.json()) as { projects: Project[] }).projects);
    } catch {
      /* sidebar stays empty */
    } finally {
      setConvsLoaded(true);
    }
  }, []);

  const setProject = (id: string | null) => {
    projRef.current = id;
    setProjectId(id);
  };

  const loadConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    convRef.current = id;
    setConversationId(id);
    setMessages([]);
    setErrs({});
    setBanner(null);
    setLoadError(null);
    setLoading(true);
    stickRef.current = true;
    try {
      const r = await fetch(`/api/conversations/${id}`);
      if (!r.ok) throw new Error(r.status === 404 ? "This conversation no longer exists." : "We couldn't load this conversation.");
      const j = (await r.json()) as { conversation: { id: string; title: string; projectId: string | null }; messages: ChatMessage[] };
      if (convRef.current !== id) return;
      setMessages(j.messages);
      setTitle(j.conversation.title);
      projRef.current = j.conversation.projectId;
      setProjectId(j.conversation.projectId);
    } catch (e) {
      if (convRef.current === id) setLoadError(e instanceof Error ? e.message : "We couldn't load this conversation.");
    } finally {
      if (convRef.current === id) setLoading(false);
    }
  }, []);

  const newChat = useCallback((project: string | null = null, push = true) => {
    abortRef.current?.abort();
    convRef.current = null;
    setConversationId(null);
    setMessages([]);
    setErrs({});
    setTitle(null);
    setLoadError(null);
    setLoading(false);
    setBanner(null);
    projRef.current = project;
    setProjectId(project);
    if (push) window.history.pushState(null, "", project ? `/chat?project=${encodeURIComponent(project)}` : "/chat");
    if (window.matchMedia("(max-width: 900px)").matches) setSidebar("closed");
    window.setTimeout(() => taRef.current?.focus(), 0);
  }, []);

  /* mount */
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    if (window.matchMedia("(max-width: 900px)").matches) setSidebar("closed");
    void loadLists();
    if (initialConversationId) void loadConversation(initialConversationId);
    const onPop = () => {
      const m = /^\/chat\/([^/?#]+)/.exec(window.location.pathname);
      if (m) void loadConversation(decodeURIComponent(m[1]));
      else newChat(new URLSearchParams(window.location.search).get("project"), false);
    };
    const onOffline = () => setBanner({ kind: "offline", title: "Connection lost.", text: "You appear to be offline. We'll keep your draft." });
    const onOnline = () => setBanner((b) => (b?.kind === "offline" ? null : b));
    window.addEventListener("popstate", onPop);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine) onOffline();
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Esc stops */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (abortRef.current) abortRef.current.abort();
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* close menu outside */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  /* autoscroll */
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    stickRef.current = bottom;
    setAtBottom(bottom);
  };
  const jumpLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  /* autosize */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [input]);

  /* ---------- chat ---------- */
  const patchLive = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === liveRef.current ? fn(m) : m)));

  const setErr = (id: string | null, text: string | null) => {
    if (!id) return;
    setErrs((e) => {
      const n = { ...e };
      if (text) n[id] = text;
      else delete n[id];
      return n;
    });
  };

  async function runChat(text: string, retryId?: string) {
    if (abortRef.current) return;
    setBanner((b) => (b?.kind === "offline" && navigator.onLine ? null : b?.kind === "offline" ? b : null));
    const now = new Date().toISOString();
    let userTmp: string | null = null;
    if (retryId) {
      liveRef.current = retryId;
      setErr(retryId, null);
      setMessages((ms) => ms.map((m) => (m.id === retryId ? { ...m, content: "", status: "streaming" } : m)));
    } else {
      userTmp = `tmp-u-${uid()}`;
      const a = `tmp-a-${uid()}`;
      liveRef.current = a;
      setMessages((ms) => [
        ...ms,
        { id: userTmp as string, role: "user", content: text, status: "complete", createdAt: now },
        { id: a, role: "assistant", content: "", status: "streaming", createdAt: now },
      ]);
    }
    stickRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);
    let terminal = false;

    const fail = (code: string, message: string, u?: UsageSummary) => {
      terminal = true;
      const id = liveRef.current;
      patchLive((m) => ({ ...m, status: "error" }));
      setErr(id, message);
      if (u) setUsage(u);
      switch (code) {
        case "limit_reached":
          if (!u) void refreshUsage();
          break;
        case "unauthorized":
          setBanner({ kind: "error", title: "You're signed out.", text: "Sign in again to keep chatting.", login: true });
          break;
        case "rate_limited":
          toast("warn", "You're sending messages quickly. Wait a moment, then retry.");
          break;
        case "busy":
          toast("warn", "Citad3L V1 is busy right now. Try again in a few seconds.");
          break;
        case "too_large":
          toast("error", "That message is too large to send.");
          break;
        default:
          if (id) setBanner({ kind: "error", title: "Something went wrong.", text: message, retry: () => retryMessage(id) });
      }
    };

    const handle = (block: string) => {
      let ev = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (!data.length) return;
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(data.join("\n")) as Record<string, unknown>;
      } catch {
        return;
      }
      if (ev === "meta") {
        const cid = String(d.conversationId);
        const aid = String(d.assistantMessageId);
        const umid = String(d.userMessageId);
        const prev = liveRef.current;
        liveRef.current = aid;
        setMessages((ms) =>
          ms.map((m) => (m.id === prev ? { ...m, id: aid } : userTmp && m.id === userTmp ? { ...m, id: umid } : m)),
        );
        const t = typeof d.title === "string" ? d.title : "New chat";
        setTitle(t);
        if (!convRef.current) {
          convRef.current = cid;
          setConversationId(cid);
          window.history.replaceState(null, "", `/chat/${encodeURIComponent(cid)}`);
        }
        setConversations((cs) => {
          const ex = cs.find((c) => c.id === cid);
          return [{ id: cid, title: t, projectId: ex ? ex.projectId : projRef.current, updatedAt: new Date().toISOString() }, ...cs.filter((c) => c.id !== cid)];
        });
      } else if (ev === "delta") {
        const tx = typeof d.text === "string" ? d.text : "";
        if (tx) patchLive((m) => ({ ...m, content: m.content + tx }));
      } else if (ev === "done") {
        terminal = true;
        patchLive((m) => ({ ...m, status: "complete" }));
        if (d.usage) setUsage(d.usage as UsageSummary);
      } else if (ev === "error") {
        fail(String(d.code ?? "internal"), String(d.message ?? "The reply failed."), d.usage as UsageSummary | undefined);
      }
    };

    try {
      const body: Record<string, unknown> = { message: text };
      if (convRef.current) body.conversationId = convRef.current;
      else if (projRef.current) body.projectId = projRef.current;
      if (retryId) body.retryAssistantMessageId = retryId;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        let code = res.status === 402 ? "limit_reached" : res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limited" : res.status === 413 ? "too_large" : "internal";
        let message = `Request failed (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: { code?: string; message?: string } };
          if (j.error) {
            code = j.error.code ?? code;
            message = j.error.message ?? message;
          }
        } catch {
          /* non-JSON */
        }
        fail(code, message);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          handle(block);
        }
      }
      if (buf.trim()) handle(buf);
      if (!terminal) throw new Error("stream ended");
    } catch {
      if (ac.signal.aborted) {
        patchLive((m) => ({ ...m, status: "stopped" }));
      } else if (!terminal) {
        const id = liveRef.current;
        patchLive((m) => ({ ...m, status: "error" }));
        setErr(id, "Connection lost before the reply finished. You weren't charged.");
        setBanner({
          kind: "offline",
          title: "Connection lost.",
          text: "The reply was interrupted.",
          retry: id ? () => retryMessage(id) : undefined,
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  function retryMessage(id: string) {
    if (abortRef.current) return;
    setBanner(null);
    if (id.startsWith("tmp-")) {
      const ms = msgsRef.current;
      const idx = ms.findIndex((m) => m.id === id);
      const user = idx > 0 ? ms[idx - 1] : undefined;
      if (!user || user.role !== "user") return;
      setMessages(ms.filter((_, i) => i !== idx && i !== idx - 1));
      setErr(id, null);
      void runChat(user.content);
      return;
    }
    void runChat("", id);
  }

  const canSend = !streaming && !limitHit && input.trim().length > 0 && input.length <= MAX_CHARS;
  const send = () => {
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    void runChat(text);
  };
  const stop = () => abortRef.current?.abort();

  const copyMsg = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500);
    } catch {
      toast("error", "Couldn't copy to clipboard.");
    }
  };

  /* ---------- sidebar actions ---------- */
  const openConversation = (e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (window.matchMedia("(max-width: 900px)").matches) setSidebar("closed");
    if (id === convRef.current && !loadError) return;
    window.history.pushState(null, "", `/chat/${encodeURIComponent(id)}`);
    void loadConversation(id);
  };

  const deleteConversation = async (c: ConversationListItem) => {
    if (!window.confirm(`Delete “${c.title || "Untitled"}”? This can't be undone.`)) return;
    try {
      const r = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setConversations((cs) => cs.filter((x) => x.id !== c.id));
      if (convRef.current === c.id) newChat(projRef.current);
      toast("ok", "Conversation deleted.");
    } catch {
      toast("error", "Couldn't delete that conversation.");
    }
  };

  const commitRename = async () => {
    if (!renaming) return;
    const { id, value } = renaming;
    const t = value.trim();
    setRenaming(null);
    if (!t) return;
    const prev = conversations.find((c) => c.id === id)?.title;
    if (t === prev) return;
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: t } : c)));
    if (convRef.current === id) setTitle(t);
    try {
      const r = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: prev ?? c.title } : c)));
      toast("error", "Couldn't rename that conversation.");
    }
  };

  const chooseProject = async (id: string | null) => {
    setMenuOpen(false);
    const prev = projRef.current;
    setProject(id);
    const cid = convRef.current;
    if (!cid) {
      window.history.replaceState(null, "", id ? `/chat?project=${encodeURIComponent(id)}` : "/chat");
      return;
    }
    setConversations((cs) => cs.map((c) => (c.id === cid ? { ...c, projectId: id } : c)));
    try {
      const r = await fetch(`/api/conversations/${cid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setProject(prev);
      setConversations((cs) => cs.map((c) => (c.id === cid ? { ...c, projectId: prev } : c)));
      toast("error", "Couldn't move this conversation.");
    }
  };

  /* ---------- derived ---------- */
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = conversations
      .filter((c) => !q || (c.title || "").toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const out: { label: string; items: ConversationListItem[] }[] = [];
    for (const c of list) {
      const g = groupOf(c.updatedAt);
      let bucket = out.find((x) => x.label === g);
      if (!bucket) {
        bucket = { label: g, items: [] };
        out.push(bucket);
      }
      bucket.items.push(c);
    }
    return out;
  }, [conversations, search]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const currentProject = projects.find((p) => p.id === projectId) ?? null;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const showEmpty = !conversationId && messages.length === 0 && !loading && !loadError;

  const usageText =
    usage.plan === "trial"
      ? `${usage.remaining} of ${usage.limit} trial replies left`
      : `${usage.remaining.toLocaleString()} of ${usage.limit.toLocaleString()} ${usage.unitLabel} left`;
  const usageCls = limitHit ? " is-out" : usage.limit > 0 && usage.remaining / usage.limit <= 0.2 ? " is-low" : "";

  /* ---------- render pieces ---------- */
  const composer = (
    <div className={`composer${limitHit ? " is-disabled" : ""}${input.length > MAX_CHARS ? " is-over" : ""}`}>
      <label className="sr-only" htmlFor="citadel-composer">Message Citad3L</label>
      <textarea
        id="citadel-composer"
        ref={taRef}
        className="composer-input"
        rows={showEmpty ? 2 : 1}
        placeholder={limitHit ? "You've used this period's allowance" : showEmpty ? "Ask anything — strategy, code, research…" : "Reply to Citad3L…"}
        value={input}
        disabled={limitHit}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        aria-invalid={input.length > MAX_CHARS}
      />
      <div className="composer-bar">
        <div className="composer-left">
          <div className="seg" role="group" aria-label="Mode">
            <button type="button" className="seg-btn" aria-pressed="true">
              <IChat />
              <span className="seg-label">Chat</span>
            </button>
            <button type="button" className="seg-btn" disabled title="Agents — coming soon">
              <IBot />
              <span className="seg-label">Agents</span>
            </button>
          </div>
        </div>
        <div className="composer-right">
          <span className="engine-pill" title="Huihui-Qwen3.8-27B-abliterated by huihui-ai, served by Citad3L">
            <span className="engine-pill-mark"><Rook size={13} /></span>
            <span className="engine-pill-label">Citad3L V1</span>
          </span>
          {streaming ? (
            <button type="button" className="stop-btn" onClick={stop} aria-label="Stop generating (Esc)" title="Stop (Esc)">
              <i />
            </button>
          ) : (
            <button type="button" className="send-btn" onClick={send} disabled={!canSend} aria-label="Send message">
              <IUp />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const projectChip = (
    <div className="popover-anchor" ref={menuRef}>
      <button
        type="button"
        className={`project-chip${currentProject ? " is-set" : ""}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        disabled={streaming}
      >
        <IFolder size={14} />
        <span>{currentProject ? currentProject.name : "No project"}</span>
      </button>
      {menuOpen && (
        <div className="menu menu-up" role="menu">
          <div className="menu-label">Project</div>
          <button type="button" role="menuitemradio" aria-checked={!projectId} className="menu-item" onClick={() => void chooseProject(null)}>
            No project
          </button>
          {projects.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={projectId === p.id} className="menu-item" onClick={() => void chooseProject(p.id)}>
              <IFolder size={14} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            </button>
          ))}
          <div className="menu-sep" />
          <a className="menu-item" href="/projects" role="menuitem">
            <IPlus /> New project
          </a>
        </div>
      )}
    </div>
  );

  const charCount =
    input.length > NEAR_CHARS ? (
      <span className={`char-count${input.length > MAX_CHARS ? " is-over" : " is-near"}`} aria-live="polite">
        {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
      </span>
    ) : null;

  const bannerEl = banner ? (
    <div className={`banner banner-${banner.kind}`} role="alert">
      {banner.kind === "offline" ? <IWifi /> : <IWarn />}
      <div className="banner-text">
        <strong>{banner.title}</strong> {banner.text}
      </div>
      {banner.retry && (
        <button type="button" className="btn btn-secondary btn-xs" onClick={banner.retry} disabled={streaming}>
          <IRetry /> Retry
        </button>
      )}
      {banner.login && (
        <a className="btn btn-primary btn-xs" href={`/login?next=${encodeURIComponent(conversationId ? `/chat/${conversationId}` : "/chat")}`}>
          Sign in
        </a>
      )}
      <button type="button" className="icon-btn icon-btn-sm" onClick={() => setBanner(null)} aria-label="Dismiss">
        <IClose />
      </button>
    </div>
  ) : null;

  const renderMessage = (m: ChatMessage) => {
    const isLast = m.id === lastAssistantId || m.id === messages[messages.length - 1]?.id;
    if (m.role === "user") {
      return (
        <div key={m.id} className="msg msg-user">
          <div className="msg-bubble">{m.content}</div>
          <div className="msg-actions">
            <button type="button" className={`msg-action${copiedId === m.id ? " is-done" : ""}`} onClick={() => void copyMsg(m)} aria-label="Copy message">
              {copiedId === m.id ? <ICheck /> : <ICopy />}
            </button>
          </div>
        </div>
      );
    }
    const live = m.status === "streaming";
    const canRetry = !streaming && (m.id === lastAssistantId || m.status === "error" || m.status === "stopped");
    return (
      <div key={m.id} className={`msg msg-assistant${isLast ? " is-last" : ""}`}>
        <div className="msg-head">
          <span className="msg-avatar"><Rook size={14} /></span>
          Citad3L
        </div>
        <div className="msg-body" aria-live={live ? "polite" : undefined} aria-busy={live}>
          {live && !m.content ? (
            <span className="thinking" aria-label="Thinking"><i /><i /><i /></span>
          ) : (
            <>
              {m.content && <Markdown content={m.content} />}
              {live && <span className="stream-caret" aria-hidden="true" />}
            </>
          )}
        </div>
        {m.status === "stopped" && <div className="msg-status">Stopped — not charged.</div>}
        {m.status === "error" && (
          <div className="msg-error" role="alert">
            <span>{errs[m.id] ?? "This reply failed. Failed replies are never charged."}</span>
            {canRetry && (
              <button type="button" className="btn btn-outline btn-xs" onClick={() => retryMessage(m.id)}>
                <IRetry /> Retry
              </button>
            )}
          </div>
        )}
        {!live && (
          <div className="msg-actions">
            {m.content && (
              <button type="button" className={`msg-action${copiedId === m.id ? " is-done" : ""}`} onClick={() => void copyMsg(m)}>
                {copiedId === m.id ? <ICheck /> : <ICopy />}
                {copiedId === m.id ? "Copied" : "Copy"}
              </button>
            )}
            {canRetry && m.status !== "error" && (
              <button type="button" className="msg-action" onClick={() => retryMessage(m.id)} disabled={limitHit}>
                <IRetry /> Retry
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ---------- render ---------- */
  return (
    <div className="chat-shell" data-sidebar={sidebar}>
      <div className="chat-scrim" onClick={() => setSidebar("closed")} aria-hidden="true" />
      <aside className="chat-sidebar" aria-label="Conversations" aria-hidden={sidebar === "closed" ? true : undefined}>
        <div className="side-inner">
          <div className="side-top">
            <div className="side-search">
              <ISearch />
              <input type="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search chats and projects" />
            </div>
            <button type="button" className="icon-btn" onClick={() => setSidebar("closed")} aria-label="Close sidebar">
              <IPanel />
            </button>
          </div>
          <button type="button" className="side-action" onClick={() => newChat(null)}>
            <IPen /> New chat
          </button>

          <div className="side-scroll">
            <div className="side-section">
              <button type="button" className="side-section-head" aria-expanded={projectsOpen} onClick={() => setProjectsOpen((o) => !o)}>
                Projects <IChev />
              </button>
              {projectsOpen && (
                <div className="side-list">
                  {filteredProjects.map((p) => (
                    <div key={p.id} className={`side-item${projectId === p.id && !conversationId ? " is-active" : ""}`}>
                      <a
                        className="side-item-link"
                        href={`/chat?project=${encodeURIComponent(p.id)}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                          e.preventDefault();
                          newChat(p.id);
                        }}
                      >
                        <IFolder size={14} />
                        <span>{p.name}</span>
                      </a>
                    </div>
                  ))}
                  <a className="side-action" href="/projects" style={{ marginTop: 2 }}>
                    <IPlus /> New project
                  </a>
                </div>
              )}
            </div>

            <div className="side-section">
              <div className="side-section-head">Recents</div>
              {!convsLoaded ? (
                <div className="skel-stack" style={{ padding: "8px 10px" }}>
                  <div className="skeleton skel-line w-80" />
                  <div className="skeleton skel-line w-60" />
                  <div className="skeleton skel-line w-80" />
                </div>
              ) : groups.length === 0 ? (
                <div className="side-empty">{search ? "No chats match your search." : "Your chats show up here."}</div>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <div className="side-group-label">{g.label}</div>
                    <div className="side-list">
                      {g.items.map((c) =>
                        renaming?.id === c.id ? (
                          <div key={c.id} className="side-item is-active">
                            <form
                              className="side-rename"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void commitRename();
                              }}
                            >
                              <input
                                autoFocus
                                value={renaming.value}
                                maxLength={120}
                                aria-label="Conversation title"
                                onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                                onBlur={() => void commitRename()}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.stopPropagation();
                                    setRenaming(null);
                                  }
                                }}
                              />
                            </form>
                          </div>
                        ) : (
                          <div key={c.id} className="side-item" aria-current={c.id === conversationId ? "page" : undefined}>
                            <a className="side-item-link" href={`/chat/${encodeURIComponent(c.id)}`} onClick={(e) => openConversation(e, c.id)} title={c.title}>
                              <span>{c.title || "Untitled"}</span>
                            </a>
                            <div className="side-item-actions">
                              <button type="button" className="side-item-btn" aria-label={`Rename ${c.title}`} onClick={() => setRenaming({ id: c.id, value: c.title })}>
                                <IEdit />
                              </button>
                              <button type="button" className="side-item-btn is-danger" aria-label={`Delete ${c.title}`} onClick={() => void deleteConversation(c)}>
                                <ITrash />
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="side-foot">
            <span className={`usage-chip${usageCls}`} style={{ alignSelf: "flex-start" }}>{usageText}</span>
            <a className="side-user" href="/account">
              <span className="nav-avatar">{initials(userLabel)}</span>
              <span className="side-user-name">{userLabel}</span>
            </a>
          </div>
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-topbar">
          {sidebar === "closed" && (
            <button type="button" className="btn btn-sm btn-quiet chats-btn" onClick={() => setSidebar("open")} aria-label="Open chats sidebar">
              <IPanel /> Chats
            </button>
          )}
          <div className="chat-topbar-title">{!showEmpty ? title ?? "" : ""}</div>
          <div className="chat-topbar-actions">
            {!showEmpty && (
              <button type="button" className="icon-btn" onClick={() => newChat(projRef.current)} aria-label="New chat" title="New chat">
                <IPen />
              </button>
            )}
          </div>
        </div>

        {showEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-inner">
              <div className="chat-emblem"><Rook size={64} /></div>
              <h1 className="chat-greeting">
                {greeting}
                {name ? `, ${name}` : ""}
              </h1>
              <p className="chat-greeting-sub">
                {currentProject ? `Working in ${currentProject.name}.` : "Strategy, robotics, AI security — or whatever's on your mind."}
              </p>
              {bannerEl && <div style={{ width: "100%", marginTop: 20 }}>{bannerEl}</div>}
              {limitHit && <div style={{ width: "100%", marginTop: 20 }}><LimitReached usage={usage} /></div>}
              {composer}
              <div className="chat-empty-meta">
                {projectChip}
                <div className="row">
                  {charCount}
                  <MockBadge provider={provider} />
                  <span className={`usage-chip${usageCls}`}>{usageText}</span>
                </div>
              </div>
              <h2 className="suggestions-title">Start with a briefing</h2>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.kicker}
                    type="button"
                    className="suggestion"
                    disabled={limitHit}
                    onClick={() => {
                      setInput(s.text);
                      taRef.current?.focus();
                    }}
                  >
                    <span className="suggestion-icon">{s.icon}</span>
                    <span>
                      <span className="suggestion-kicker">{s.kicker}</span>
                      <span className="suggestion-text" style={{ display: "block" }}>{s.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
              <div className="thread">
                {loading ? (
                  <div className="skel-stack" aria-label="Loading conversation">
                    <div className="skeleton skel-bubble" />
                    <div className="skeleton skel-line w-100" />
                    <div className="skeleton skel-line w-80" />
                    <div className="skeleton skel-line w-60" />
                    <div className="skeleton skel-bubble" style={{ marginTop: 16 }} />
                    <div className="skeleton skel-line w-80" />
                    <div className="skeleton skel-line w-40" />
                  </div>
                ) : loadError ? (
                  <div className="state">
                    <div className="state-emblem"><Rook size={32} /></div>
                    <div className="state-title">Couldn&apos;t open this chat</div>
                    <p className="state-body">{loadError}</p>
                    <div className="state-actions">
                      {conversationId && (
                        <button type="button" className="btn btn-secondary" onClick={() => void loadConversation(conversationId)}>
                          <IRetry /> Try again
                        </button>
                      )}
                      <button type="button" className="btn btn-primary" onClick={() => newChat(null)}>New chat</button>
                    </div>
                  </div>
                ) : (
                  messages.map(renderMessage)
                )}
              </div>
            </div>
            {!atBottom && !loading && (
              <button type="button" className="jump-latest" onClick={jumpLatest} style={{ bottom: 150 }}>
                <IDown /> Jump to latest
              </button>
            )}
            {!loadError && (
              <div className="composer-dock">
                <div className="composer-dock-inner">
                  {bannerEl}
                  {limitHit && <LimitReached usage={usage} />}
                  {composer}
                  <div className="composer-meta">
                    {projectChip}
                    <span className="spacer" />
                    {charCount}
                    <MockBadge provider={provider} />
                    <span className={`usage-chip${usageCls}`}>{usageText}</span>
                  </div>
                  <div className="composer-hint">
                    <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span>+<span className="kbd">Enter</span> for a new line · <span className="kbd">Esc</span> to stop. Failed or stopped replies aren&apos;t charged.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <span className="toast-dot" />
              <span>{t.text}</span>
              <button type="button" className="toast-close" onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Dismiss">
                <IClose />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChatWorkspace;

SOURCE>>>
<<<SOURCE components/projects/ProjectsView.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { Rook } from "@/components/Rook";

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type DialogState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; project: Project }
  | { kind: "delete"; project: Project };

type Toast = { id: number; text: string; tone: "ok" | "error" };

const NAME_MAX = 80;
const INSTR_MAX = 4000;

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    if (typeof j.error === "string") return j.error;
    return j.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function relTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectsView({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    setDialog({ kind: "none" });
    setFormError(null);
  }, [busy]);

  useEffect(() => {
    if (dialog.kind === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    if (dialog.kind !== "delete") window.setTimeout(() => nameRef.current?.focus(), 30);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  const openCreate = () => {
    setName("");
    setInstructions("");
    setFormError(null);
    setDialog({ kind: "create" });
  };
  const openEdit = (p: Project) => {
    setName(p.name);
    setInstructions(p.instructions);
    setFormError(null);
    setDialog({ kind: "edit", project: p });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setFormError("Give the project a name.");
      return;
    }
    if (n.length > NAME_MAX || instructions.length > INSTR_MAX) {
      setFormError("Name or instructions are too long.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (dialog.kind === "create") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, instructions }),
        });
        if (!res.ok) throw new Error(await readError(res));
        const j = (await res.json()) as { project: Project };
        setProjects((p) => [j.project, ...p]);
        toast("Project created");
      } else if (dialog.kind === "edit") {
        const id = dialog.project.id;
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, instructions }),
        });
        if (!res.ok) throw new Error(await readError(res));
        let updated: Project = { ...dialog.project, name: n, instructions, updatedAt: new Date().toISOString() };
        try {
          const j = (await res.json()) as { project?: Project };
          if (j.project) updated = j.project;
        } catch {
          /* no body */
        }
        setProjects((p) => p.map((x) => (x.id === id ? updated : x)));
        toast("Project saved");
      }
      setDialog({ kind: "none" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (dialog.kind !== "delete") return;
    const id = dialog.project.id;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      setProjects((p) => p.filter((x) => x.id !== id));
      setDialog({ kind: "none" });
      toast("Project deleted");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container projects-page page-main">
      <header className="page-head">
        <h1 className="page-title">Projects</h1>
        <p className="page-sub">
          Group related chats and give Citad3L standing instructions — a brief it reads before every reply in that project.
        </p>
      </header>

      <div className="page-toolbar">
        <span className="tiny">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          <IconPlus /> New project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="state empty-state">
          <div className="state-emblem">
            <Rook size={32} />
          </div>
          <h2 className="state-title">No projects yet</h2>
          <p className="state-body">
            Create a project for a research thread, a codebase or a recurring brief. Its instructions apply to every chat inside it.
          </p>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <IconPlus /> Create a project
            </button>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => (
            <article key={p.id} className="project-card">
              <div className="project-card-head">
                <span className="project-icon">
                  <IconFolder />
                </span>
                <div className="project-actions">
                  <button type="button" className="icon-btn icon-btn-sm" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => {
                      setFormError(null);
                      setDialog({ kind: "delete", project: p });
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
              <h2 className="project-name">
                <a href={`/chat?project=${encodeURIComponent(p.id)}`}>{p.name}</a>
              </h2>
              <p className={`project-instructions${p.instructions.trim() ? "" : " is-empty"}`}>
                {p.instructions.trim() || "No instructions"}
              </p>
              <div className="project-meta">
                <span className="tnum">
                  {p.conversationCount} {p.conversationCount === 1 ? "chat" : "chats"}
                </span>
                <span aria-hidden="true">·</span>
                <span>Updated {relTime(p.updatedAt)}</span>
              </div>
            </article>
          ))}
          <button type="button" className="project-new" onClick={openCreate}>
            <IconPlus /> New project
          </button>
        </div>
      )}

      {(dialog.kind === "create" || dialog.kind === "edit") && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog dialog-lg" role="dialog" aria-modal="true" aria-labelledby="proj-dialog-title">
            <h2 id="proj-dialog-title" className="dialog-title">
              {dialog.kind === "create" ? "New project" : "Edit project"}
            </h2>
            <p className="dialog-body">Instructions are sent with every message in this project.</p>
            <form className="form dialog-form" onSubmit={submit}>
              <div className="field">
                <label className="label" htmlFor="proj-name">Name</label>
                <input
                  ref={nameRef}
                  id="proj-name"
                  className="input"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Robotics reading list"
                  aria-invalid={formError !== null && !name.trim()}
                />
              </div>
              <div className="field">
                <div className="label-row">
                  <label className="label" htmlFor="proj-instr">Instructions</label>
                  <span className="char-count">
                    {instructions.length.toLocaleString()} / {INSTR_MAX.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="proj-instr"
                  className="textarea"
                  rows={6}
                  value={instructions}
                  maxLength={INSTR_MAX}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Tone, context, constraints. e.g. Answer as a security reviewer; cite assumptions; keep it under 300 words."
                />
                <span className="field-hint">Optional. You can change this any time.</span>
              </div>
              {formError && <p className="field-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy && <span className="spinner" />}
                  {dialog.kind === "create" ? "Create project" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dialog.kind === "delete" && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-body">
            <h2 id="del-title" className="dialog-title">Delete “{dialog.project.name}”?</h2>
            <p id="del-body" className="dialog-body">
              The project and its instructions will be removed. This can’t be undone.
            </p>
            {formError && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close} disabled={busy} autoFocus>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={busy}>
                {busy && <span className="spinner" />} Delete project
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "toast-error" : "toast-ok"}`}>
            <span className="toast-dot" />
            <span>{t.text}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

export default ProjectsView;

SOURCE>>>
<<<SOURCE components/account/AccountView.tsx
"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { ProviderInfo, UsageSummary } from "@/lib/types";
import { MockBadge } from "@/components/MockBadge";

interface Props {
  userLabel: string;
  email: string;
  usage: UsageSummary;
  billingConfigured: boolean;
  provider: ProviderInfo;
}

const PLAN_NAMES: Record<UsageSummary["plan"], string> = { trial: "Trial", pro: "Pro", max: "Max" };

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function initials(label: string): string {
  const parts = label.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "")).toUpperCase();
}

async function errMsg(res: Response): Promise<{ code?: string; message: string }> {
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } | string };
    if (typeof j.error === "string") return { code: j.error, message: j.error };
    return { code: j.error?.code, message: j.error?.message ?? `Request failed (${res.status})` };
  } catch {
    return { message: `Request failed (${res.status})` };
  }
}

function StatusBadge({ status }: { status: UsageSummary["status"] }) {
  const map: Record<UsageSummary["status"], [string, string]> = {
    active: ["badge-ok", "Active"],
    trialing: ["badge-ok", "Trial"],
    past_due: ["badge-danger", "Past due"],
    canceled: ["badge-warn", "Canceled"],
    none: ["badge-warn", "No plan"],
  };
  const [cls, text] = map[status];
  return <span className={`badge ${cls}`}>{text}</span>;
}

export function AccountView({ userLabel, email, usage, billingConfigured, provider }: Props) {
  const [checkoutOk, setCheckoutOk] = useState(false);
  const [busy, setBusy] = useState<null | "portal" | "pro" | "max" | "export" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") setCheckoutOk(true);
  }, []);

  const limit = Math.max(0, usage.limit);
  const used = Math.min(usage.used, limit || usage.used);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const fillCls = pct >= 100 ? " is-full" : pct >= 80 ? " is-warn" : "";
  const reset = fmtDate(usage.resetAt);
  const isPaid = usage.plan !== "trial" && usage.status !== "none";

  const goPortal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } | string };
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      const code = typeof j.error === "string" ? j.error : j.error?.code;
      setError(code === "billing_not_configured" ? "Test-mode billing not configured yet." : (typeof j.error === "object" && j.error?.message) || "Could not open billing portal.");
    } catch {
      setError("Network error — try again.");
    }
    setBusy(null);
  };

  const checkout = async (plan: "pro" | "max") => {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code?: string; message?: string } | string };
      if (res.ok && j.url) {
        window.location.href = j.url;
        return;
      }
      const code = typeof j.error === "string" ? j.error : j.error?.code;
      setError(code === "billing_not_configured" ? "Test-mode billing not configured yet." : (typeof j.error === "object" && j.error?.message) || "Could not start checkout.");
    } catch {
      setError("Network error — try again.");
    }
    setBusy(null);
  };

  const exportData = async () => {
    setBusy("export");
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error((await errMsg(res)).message);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `citad3l-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
    setBusy(null);
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error((await errMsg(res)).message);
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
      setBusy(null);
    }
  };

  return (
    <main className="container account-page page-main">
      <header className="page-head">
        <h1 className="page-title">Account</h1>
        <p className="page-sub">Your plan, allowance and data.</p>
      </header>

      <div className="account-grid">
        {checkoutOk && (
          <div className="notice notice-ok" role="status">
            <strong>Payment confirmed.</strong> Your plan is updating — it can take a few seconds to appear here.
          </div>
        )}
        {error && (
          <div className="notice notice-danger" role="alert">
            <strong>Something went wrong.</strong> {error}
          </div>
        )}

        <section className="account-card">
          <div className="account-card-head">
            <div className="account-identity">
              <span className="avatar-lg" aria-hidden="true">{initials(userLabel || email)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="account-card-title">{userLabel}</div>
                <div className="account-card-sub">{email}</div>
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </button>
          </div>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <div>
              <div className="account-card-sub">Current plan</div>
              <div className="account-plan" style={{ marginTop: 6 }}>
                <span className="account-plan-name">{PLAN_NAMES[usage.plan]}</span>
                <StatusBadge status={usage.status} />
              </div>
            </div>
            <div className="btn-row">
              {isPaid && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={goPortal} disabled={busy !== null}>
                  {busy === "portal" && <span className="spinner" />} Manage billing
                </button>
              )}
              {usage.plan === "trial" && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => checkout("pro")} disabled={busy !== null}>
                  {busy === "pro" && <span className="spinner" />} Upgrade to Pro
                </button>
              )}
              {usage.plan !== "max" && (
                <button type="button" className={`btn btn-sm ${usage.plan === "trial" ? "btn-outline" : "btn-primary"}`} onClick={() => checkout("max")} disabled={busy !== null}>
                  {busy === "max" && <span className="spinner" />} {usage.plan === "trial" ? "Go Max" : "Upgrade to Max"}
                </button>
              )}
            </div>
          </div>

          {!billingConfigured && <div className="notice notice-warn" style={{ marginBottom: 16 }}>Test-mode billing not configured yet.</div>}
          {usage.cancelAtPeriodEnd && (
            <div className="notice notice-warn" style={{ marginBottom: 16 }}>
              <strong>Cancellation scheduled.</strong> Your plan stays active until {reset ?? "the end of the billing period"}, then won’t renew.
            </div>
          )}
          {usage.status === "past_due" && (
            <div className="notice notice-danger" style={{ marginBottom: 16 }}>
              <strong>Payment failed.</strong> Update your payment method in billing to keep your allowance.
            </div>
          )}

          <div className="meter">
            <div className="meter-top">
              <span className="meter-value">
                {used.toLocaleString()}
                <small>of {limit.toLocaleString()} {usage.unitLabel} used</small>
              </span>
              <span className="tiny tnum">{Math.max(0, usage.remaining).toLocaleString()} left</span>
            </div>
            <div className="meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label="Allowance used">
              <div className={`meter-fill${fillCls}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="meter-foot">
              <span>{usage.plan === "trial" ? "One-time trial allowance" : reset ? `Resets ${reset}` : "Resets on your billing date"}</span>
              <span>Failed replies are never charged</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 18, flexWrap: "wrap" }}>
            <span className="tiny">Engine: Citad3L V1</span>
            <MockBadge provider={provider} />
          </div>
        </section>

        <section className="account-card">
          <div className="account-card-head">
            <div>
              <div className="account-card-title">Data</div>
              <div className="account-card-sub">Your conversations and projects belong to you.</div>
            </div>
          </div>
          <div className="account-row">
            <div>
              <div className="account-row-label">Export data</div>
              <div className="account-row-desc">Download all conversations, projects and usage as JSON.</div>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportData} disabled={busy !== null}>
              {busy === "export" && <span className="spinner" />} Export
            </button>
          </div>
        </section>

        <section className="account-card danger-zone">
          <div className="account-card-head">
            <div>
              <div className="account-card-title">Delete account</div>
              <div className="account-card-sub">Permanently removes your account, conversations and projects. Cancel any subscription first.</div>
            </div>
            {!confirmOpen && (
              <button type="button" className="btn btn-danger-quiet btn-sm" onClick={() => setConfirmOpen(true)}>
                Delete account
              </button>
            )}
          </div>
          {confirmOpen && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
            >
              <div className="field">
                <label className="label" htmlFor="confirm-del">Type DELETE to confirm</label>
                <input
                  id="confirm-del"
                  className="input confirm-input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setConfirmOpen(false); setConfirmText(""); }} disabled={busy === "delete"}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger btn-sm" disabled={confirmText !== "DELETE" || busy !== null}>
                  {busy === "delete" && <span className="spinner" />} Permanently delete
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default AccountView;

SOURCE>>>
<<<SOURCE components/auth/LoginView.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Rook } from "@/components/Rook";

interface Props {
  demoEnabled: boolean;
  providers: { id: string; name: string }[];
  next?: string;
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.4 7.4 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2Z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#4285F4" d="M15.7 8.2c0-.6-.1-1.1-.2-1.6H8v3h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.4-3.4 2.4-5.8Z" />
      <path fill="#34A853" d="M8 16c2.2 0 4-.7 5.3-2l-2.6-2c-.7.5-1.6.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3H.8v2.1A8 8 0 0 0 8 16Z" />
      <path fill="#FBBC05" d="M3.5 9.5a4.8 4.8 0 0 1 0-3V4.4H.8a8 8 0 0 0 0 7.2l2.7-2.1Z" />
      <path fill="#EA4335" d="M8 3.2c1.2 0 2.3.4 3.1 1.2l2.3-2.3A8 8 0 0 0 .8 4.4l2.7 2.1C4.1 4.6 5.9 3.2 8 3.2Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 4.5 8 9l5.5-4.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function safeNext(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/chat";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginView({ demoEnabled, providers, next }: Props) {
  const callbackUrl = safeNext(next);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicEmail, setMagicEmail] = useState("");
  const [demoEmail, setDemoEmail] = useState("demo@citad3l.dev");
  const [sent, setSent] = useState(false);

  const oauth = providers.filter((p) => p.id !== "resend" && p.id !== "demo");
  const hasResend = providers.some((p) => p.id === "resend");

  const go = async (id: string, extra?: Record<string, string>) => {
    setError(null);
    setPending(id);
    try {
      const res = (await signIn(id, { callbackUrl, ...(extra ?? {}) })) as unknown as { error?: string } | undefined;
      if (res?.error) {
        setError("Sign-in failed. Try again.");
        setPending(null);
      }
    } catch {
      setError("Sign-in failed. Check your connection and try again.");
      setPending(null);
    }
  };

  const submitMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(magicEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setPending("resend");
    try {
      await signIn("resend", { email: magicEmail.trim(), callbackUrl, redirect: false });
      setSent(true);
    } catch {
      setError("Could not send the link. Try again.");
    }
    setPending(null);
  };

  const submitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(demoEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    void go("demo", { email: demoEmail.trim() });
  };

  const icon = (id: string) => (id === "github" ? <GithubIcon /> : id === "google" ? <GoogleIcon /> : <MailIcon />);
  const nothing = oauth.length === 0 && !hasResend && !demoEnabled;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-emblem"><Rook size={30} /></span>
          <h1 className="auth-title">Sign in to Citad3L</h1>
          <p className="auth-sub">Start with 5 free replies. No card required.</p>
        </div>

        {oauth.length > 0 && (
          <div className="auth-providers">
            {oauth.map((p) => (
              <button key={p.id} type="button" className="provider-btn" disabled={pending !== null} onClick={() => go(p.id)}>
                {pending === p.id ? <span className="spinner" /> : icon(p.id)}
                Continue with {p.name}
              </button>
            ))}
          </div>
        )}

        {hasResend && (
          <>
            {oauth.length > 0 && <div className="auth-divider">or</div>}
            {sent ? (
              <div className="notice notice-ok" role="status">
                Check <strong>{magicEmail}</strong> for a sign-in link.
              </div>
            ) : (
              <form className="form" onSubmit={submitMagic}>
                <div className="field">
                  <label className="label" htmlFor="magic-email">Email</label>
                  <input id="magic-email" type="email" className="input" autoComplete="email" placeholder="you@example.com" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={pending !== null}>
                  {pending === "resend" && <span className="spinner" />} Email me a link
                </button>
              </form>
            )}
          </>
        )}

        {demoEnabled && (
          <>
            {(oauth.length > 0 || hasResend) && <div className="auth-divider">or</div>}
            <form className="demo-box" onSubmit={submitDemo}>
              <span className="demo-label"><span className="amber-dot" /> Development demo login — disabled in production</span>
              <div className="field">
                <label className="label" htmlFor="demo-email">Email</label>
                <input id="demo-email" type="email" className="input" autoComplete="off" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={pending !== null}>
                {pending === "demo" && <span className="spinner" />} Continue as demo user
              </button>
            </form>
          </>
        )}

        {nothing && <div className="notice notice-warn">No sign-in providers are configured.</div>}
        {error && <p className="field-error" role="alert">{error}</p>}

        <p className="auth-foot">
          By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

export default LoginView;

SOURCE>>>
<<<SOURCE components/LimitReached.tsx
import * as React from "react";
import Link from "next/link";
import type { UsageSummary } from "@/lib/types";
import { formatDate } from "@/lib/engine";

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function LimitReached({ usage }: { usage: UsageSummary }) {
  const reset = formatDate(usage.resetAt, { month: "long", day: "numeric" });
  let title: string;
  let body: string;
  let primary: { href: string; label: string };
  const secondary: { href: string; label: string } | null =
    usage.plan === "trial" ? null : { href: "/account", label: "View usage" };

  if (usage.plan === "trial") {
    title = "Your trial replies are used up";
    body = `You've used all ${usage.limit} trial ${usage.unitLabel}. Pro and Max run the same Citad3L V1 engine with a monthly allowance. Failed replies never count.`;
    primary = { href: "/pricing", label: "See plans" };
  } else if (usage.plan === "pro") {
    title = "You've reached this month's allowance";
    body = `Your Pro allowance${reset ? ` resets on ${reset}` : " resets on your billing date"}. Max gives you 2.5× the allowance on the same engine.`;
    primary = { href: "/pricing", label: "Upgrade to Max" };
  } else {
    title = "You've reached this month's allowance";
    body = `Your Max allowance${reset ? ` resets on ${reset}` : " resets on your billing date"}. Failed or stopped replies are never charged.`;
    primary = { href: "/account", label: "Manage plan" };
  }

  return (
    <div className="limit-card" role="alert">
      <div className="limit-icon"><LockIcon /></div>
      <div>
        <div className="limit-title">{title}</div>
        <p className="limit-body">{body}</p>
        <div className="limit-actions">
          <Link href={primary.href} className="btn btn-primary btn-sm">{primary.label}</Link>
          {secondary && primary.href !== secondary.href ? (
            <Link href={secondary.href} className="btn btn-secondary btn-sm">{secondary.label}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default LimitReached;

SOURCE>>>
# Output format (strict)
1. `CRITIQUE` — max 15 bullets: the most important likeness/identity gaps you see, and what you're changing.
2. Then changes, using ONLY these block types:
   - `=== FILE: app/round2-<area>.css ===` … `=== END FILE ===` — a CSS override appendix (it is appended after globals.css; wrap rules in `@layer components { }`).
   - `=== PATCH: <path> ===` then one or more pairs `<<<FIND` (exact existing text, unique in that file) / `>>>REPLACE` (new text) / `<<<END`, then `=== END PATCH ===` — for targeted code edits.
   - `=== FILE: <path> ===` full replacement only if a component needs a substantial rewrite (max 2 full files).
No other prose. Keep the API contracts and props unchanged.
Use area name `app` for the CSS file.