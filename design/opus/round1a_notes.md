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

