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
        <section className="hero pricing-hero container">
          <h1 className="display hero-title">
            Every plan, one <HeroChips /> engine. A price that scales with you.
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

        <section className="section-lg faq-section container" aria-labelledby="faq-title">
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
