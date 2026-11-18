CRITIQUE
- **Pricing hero wrap (desktop):** the headline breaks as "One strategic [chips] / engine, every plan, a / price that scales with you." The reference keeps the chips at the end of line 1 ("Play with [chips] any"), with balanced lines below. I'll restructure the copy so the chips close line 1 ("Every plan, one [chips] engine — a price that scales with you."), and widen the title so line 2 doesn't strand a lone "a".
- **Pricing hero size:** our hero is taller than the reference because the sub is two lines. I'll tighten the sub to one line at desktop, matching the reference rhythm.
- **Footer wordmark:** the reference wordmark is huge, light grey, starts flush near the left gutter and is clipped at about 60% of cap height. Ours is centred, smaller and cut too high, so it reads as a fragment ("Citad3L" hump). I'll make it left-aligned, larger and clipped lower.
- **Footer grid:** ours sits about 250px lower and is roomier than the reference (whose columns start right after the hairline). I'll reduce the footer top margin and padding, and shrink the brand line to the reference's ~20px.
- **Chat greeting:** "Good evening, Review-mwlfna1l" wraps and dominates. I'll clamp it to one line with an ellipsis, set it at a ~40px size and cap its width. A first-name-only greeting is better handled in data, but CSS guarantees no wrap.
- **Chat empty state, sub line:** the reference has no sub-line under the greeting. I'll keep ours but quieten it.
- **Chat empty state, lower section:** the reference's lower "Try other models" section is a heading row plus three equal cards. Our briefing grid is 2×2 at a wider width. I'll align the "Start with a briefing" title size (17→18) and the spacing to the reference's ~48px gap below the meta row.
- **Phone pricing:** the "Trial, Pro, Max" tag duplicates the card names and adds dead space, and the reference's extra stacked text looks unpolished. I'll hide it on phones and tighten the hero/sub spacing. The 5-line phone headline also breaks awkwardly ("engine," alone); the new copy fixes that.
- **Pricing cards:** the reference cards are taller, with more air between the CTA and Usage, and a 44px CTA. I'll nudge both.
- **FAQ:** the section sits fine. I'll only trim the excess top padding so the gap after the legend matches the reference.

=== FILE: app/round3-polish.css ===
@layer components {
  /* Pricing hero */
  .pricing-hero .hero-title { max-width: 1120px; }
  .pricing-hero .hero-sub { max-width: 760px; }
  .plan-cta .btn-lg { height: 44px; }
  .plan-section { margin-top: 26px; }
  .faq-section { padding-top: 40px; }

  /* Footer */
  .footer { margin-top: 64px; }
  .footer-grid { padding: 48px 0 40px; }
  .footer-brand-line { font-size: 20px; margin-top: 18px; }
  .footer-giant {
    height: 0.62em; margin-top: 8px; padding-left: var(--gutter);
    text-align: left; font-size: clamp(110px, 25vw, 520px);
    line-height: 0.9; color: #ebebeb;
  }

  /* Chat empty */
  .chat-greeting {
    max-width: 100%; font-size: 40px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-wrap: nowrap;
  }
  .chat-greeting-sub { font-size: 13.5px; }
  .suggestions-title { margin-top: 48px; font-size: 18px; }
  .suggestion { padding: 16px; border-radius: 14px; }

  @media (max-width: 640px) {
    .chat-greeting { font-size: 30px; white-space: normal; text-wrap: balance; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .pricing-head > .tiny { display: none; }
    .pricing-hero .hero-sub { font-size: 16px; }
    .footer-giant { height: 0.66em; }
  }
}
=== END FILE ===

=== PATCH: components/marketing/PricingView.tsx ===
<<<FIND
        <section className="hero container">
          <h1 className="display hero-title">
            One strategic <HeroChips /> engine, every plan, a price that scales with you.
          </h1>
>>>REPLACE
        <section className="hero pricing-hero container">
          <h1 className="display hero-title">
            Every plan, one <HeroChips /> engine. A price that scales with you.
          </h1>
<<<END
<<<FIND
        <section className="section-lg container" aria-labelledby="faq-title">
>>>REPLACE
        <section className="section-lg faq-section container" aria-labelledby="faq-title">
<<<END

=== PATCH: components/Footer.tsx ===
<<<FIND
            <p className="footer-brand-line">Hold the high ground<br />on what&apos;s next.</p>
>>>REPLACE
            <p className="footer-brand-line">Hold the high ground<br />on what&apos;s next.</p>
<<<END