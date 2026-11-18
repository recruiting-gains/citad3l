# CRITIQUE

- **"Skip to content" is visible in normal flow.** It sits above the nav on every page and pushes the whole layout down about 20px. That is the single biggest likeness break. The skip link is now visually hidden until it receives focus.
- **`.container` is being overridden by Tailwind v4's own `container` utility.** The utility sits in the utilities layer, so it wins over ours. As a result our content column is about 1087px wide inside a 1288px viewport, where the reference fills the space with ~30px gutters. I re-assert our container (and `container-narrow`) in `@layer utilities` so it wins again.
- **The `.hero` padding shorthand wipes the container's side padding.** On phones this makes the CTAs bleed to the screen edges. The hero now sets vertical padding only.
- **The phone CTAs stretch edge to edge.** The reference uses centered pills that size to their content. Ours now do the same.
- **The nav is too tall.** It is 60px against the reference's ~52px, and our link type is 14px against their ~13.5px. I tightened the height, link pills, brand size and button sizes.
- **The display type is slightly oversized.** The reference is about 70px at a 1288px viewport. I retuned the clamp and the line-height, and set tracking to −0.035em.
- **The hero sub wraps to two lines where the reference is a single 18px line.** I widened its measure and tightened the gap above the CTAs.
- **Tile heights drift between tiles.** "Model" has a two-line sub, which stretches the whole row and misaligns every title. Subs are now single-line with an ellipsis, the copy is shorter, and tiles have a fixed ~112px height with titles pinned to the bottom.
- **Tile proportions and radius don't match.** The reference uses a ~10px radius, 12px gaps, 13px subs and 14px titles. Matched.
- **Section headings are too large.** "Featured" is ~28px in the reference against our 32px. The spacing from the tiles down to Featured is now reference-like (~72px).
- **Media cards need closer matching.** The meta row now uses a 13.5px title and a 28px icon, the tag is smaller, and the radius is 10px, all closer to the reference.
- **Pricing is too wide.** The reference pricing column is about 1024px. Card padding drops to 20px, the price to 36px, the CTA to 40px and the rows get tighter. This also removes the extra vertical gap between the hero and "All plans".
- **The model detail sidebar already matches (320px, art ~1.77:1).** I only tuned the title to 24px, made the stat labels smaller, and set the top offset to the new nav height.
- **Phone tiles misalign for the same reason as desktop.** Fixed by the same height rules. The phone display is clamped to 44px to match the reference.
- **No identity changes.** There are no presence counts. The Mock badge stays visible on the hero, the model panel and the models index.

=== FILE: app/round2-marketing.css ===
```css
/* Round 2 — marketing likeness pass */

/* Tailwind v4 ships its own .container utility in the utilities layer, which beats ours. Re-assert ours. */
@layer utilities {
  .container {
    width: 100%;
    max-width: calc(var(--container) + var(--gutter) * 2);
    margin-inline: auto;
    padding-inline: var(--gutter);
  }
  .container.container-narrow { max-width: calc(1024px + var(--gutter) * 2); }
}

@layer components {
  :root { --nav-h: 52px; --gutter: 30px; --display: clamp(44px, 3.6vw + 24px, 76px); }
  @media (max-width: 640px) { :root { --gutter: 16px; } }

  /* Skip link: hidden until focused, whatever class the layout gives it */
  body > a[href^="#"]:first-child:not(:focus),
  .skip-link:not(:focus) {
    position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  body > a[href^="#"]:first-child:focus {
    position: fixed; left: 8px; top: 8px; z-index: 200; padding: 8px 14px;
    border-radius: 999px; background: var(--fg); color: var(--bg); font-size: 13px;
  }

  /* Nav */
  .nav-inner { padding: 0 20px; gap: 14px; }
  .nav-brand { font-size: 17px; gap: 7px; }
  .nav-links { gap: 0; margin-left: 4px; }
  .nav-link { height: 30px; padding: 0 10px; font-size: 13.5px; }
  .nav-text { height: 30px; font-size: 13.5px; }
  .nav-right, .nav-desktop { gap: 4px; }
  .nav .btn-sm { height: 30px; padding: 0 12px; font-size: 13px; }
  .nav .icon-btn { width: 32px; height: 32px; }

  /* Hero */
  .hero { padding: 0; padding-block: 88px 64px; }
  .display { font-size: var(--display); line-height: 1.02; letter-spacing: -0.035em; }
  .hero-title { max-width: 980px; }
  .hero-sub { max-width: 720px; margin-top: 22px; font-size: 18px; }
  .hero-ctas { margin-top: 30px; gap: 8px; }
  .hero-ctas .btn-lg { height: 44px; padding: 0 22px; font-size: 15.5px; }
  .hero-note { margin-top: 16px; }

  /* Tiles */
  .tile-grid { gap: 12px; }
  .tile { min-height: 0; height: 112px; padding: 14px 14px 16px; border-radius: 10px; }
  .tile-badge { top: 12px; right: 12px; }
  .tile-title { padding-top: 0; font-size: 14px; }
  .tile-sub {
    margin-top: 6px; font-size: 12.5px;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }

  /* Sections */
  .section-lg { padding-block: 72px; }
  .section-title { font-size: 28px; letter-spacing: -0.03em; }
  .section-head { margin-bottom: 16px; }
  .round-btn { width: 32px; height: 32px; }

  /* Media cards */
  .carousel { gap: 14px; grid-auto-columns: calc((100% - 28px) / 3); }
  .media, .media-card { border-radius: 10px; }
  .media-tag { top: 10px; left: 10px; height: 22px; font-size: 11.5px; }
  .media-card { gap: 12px; }
  .media-meta { grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; }
  .media-icon { width: 28px; height: 28px; border-radius: 8px; }
  .media-title { font-size: 13.5px; }
  .media-desc { margin-top: 2px; font-size: 12.5px; }
  .models-grid { gap: 14px; }

  .model-strip, .step, .plan-mini { border-radius: 12px; }

  /* Pricing */
  .pricing-grid { gap: 12px; }
  .plan-card { padding: 20px; border-radius: 16px; }
  .plan-blurb { margin-top: 10px; }
  .plan-price { margin-top: 14px; }
  .plan-amount { font-size: 36px; }
  .plan-cta { margin-top: 16px; }
  .plan-cta .btn-lg { height: 40px; font-size: 14px; }
  .plan-section { margin-top: 22px; }
  .plan-row { padding: 9px 0; font-size: 12.5px; }
  .pricing-head-title { font-size: 16px; }

  /* Model detail */
  .model-side-inner { gap: 18px; padding: 20px; }
  .model-title { font-size: 24px; }
  .stat-label { font-size: 12.5px; }

  @media (max-width: 1200px) { .tile { height: 104px; } }

  @media (max-width: 640px) {
    .hero { padding-block: 48px 40px; }
    .display { font-size: 44px; line-height: 1.04; }
    .hero-sub { font-size: 17px; }
    .hero-ctas .btn { flex: 0 0 auto; }
    .tile { height: 128px; padding: 16px; border-radius: 14px; }
    .tile-sub { font-size: 14px; white-space: normal; }
    .carousel { grid-auto-columns: 86%; }
  }
}
```
=== END FILE ===

=== PATCH: components/marketing/HomeView.tsx ===
<<<FIND
sub: "One engine, fully documented"
>>>REPLACE
sub: "One engine, documented"
<<<END
=== END PATCH ===