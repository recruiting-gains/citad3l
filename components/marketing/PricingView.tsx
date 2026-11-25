"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanCard, PlanId } from "@/lib/types";
import type { PublicModel } from "@/lib/models";
import { marketingModels, modelTier } from "@/lib/models";
import { Footer } from "@/components/Footer";
import { HeroChips } from "@/components/Art";
import { WaitlistForm } from "@/components/marketing/WaitlistForm";

export interface PricingViewProps {
  plans: PlanCard[];
  signedIn: boolean;
  currentPlan?: PlanId | null;
  billingConfigured: boolean;
  /** Whether this viewer may start checkout (BILLING_ENABLED gate). */
  billingOpen?: boolean;
  /** ADMIN_EMAILS account: every model is already unlocked; plans are for customers. */
  isAdmin?: boolean;
  showReferral?: boolean;
}

const sv = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ICheck = () => <svg {...sv} width={12} height={12}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const IChevR = () => <svg {...sv} width={14} height={14}><path d="M9 6l6 6-6 6" /></svg>;
const IPlus = () => <svg {...sv} width={16} height={16}><path d="M12 5v14M5 12h14" /></svg>;
const IClose = () => <svg {...sv} width={14} height={14}><path d="M6 6l12 12M18 6L6 18" /></svg>;

const DOTS: Record<PlanId, number> = { trial: 1, pro: 2, max: 5 };
const NOT_CONFIGURED = "Billing isn’t configured yet";
const COMING_SOON = "Paid plans are coming soon. Join early access below to hear first.";

function Dots({ n }: { n: number }) {
  return (
    <span className="usage-dots" aria-label={`${n} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < n ? "on" : ""} />)}
    </span>
  );
}

function LineupCell({ model, plan }: { model: PublicModel; plan: PlanId }) {
  const tier = modelTier(model.id);
  if ((tier === "max" && plan !== "max") || (tier === "pro" && plan === "trial")) {
    return <span className="lineup-no" role="img" aria-label="Not included" />;
  }
  if (model.comingSoon) return <span className="lineup-soon">Soon</span>;
  return <span className="lineup-yes" role="img" aria-label="Included"><ICheck /></span>;
}

const faqs = [
  { q: "Do the plans include different models?", a: "Free includes Citad3L V1 and Fast, plus Citad3L Private and Swarm mode once you make a free account. Pro adds Citad3L Image. Max adds Citad3L Video and per-model settings on top of everything in Pro." },
  { q: "What is Citad3L Video?", a: "Video generation for Max subscribers. Clips run 5 seconds at 720p, with sound. There is a daily clip limit to keep the service fast for everyone." },
  { q: "Are there daily limits on images and video?", a: "Yes. On top of your plan's allowance, images and video clips have a daily limit per account so one heavy user can't slow things down for everyone. Limits reset every day at 6 PM Central." },
  { q: "What is Swarm mode?", a: "A chat setting. Citad3L V1 splits a large request into parts, Fast workers handle the parts in parallel, and V1 assembles the answer. It uses 4 replies of allowance." },
  { q: "Do failed or stopped replies count?", a: "Never. Only successful replies use your allowance. If a reply errors out or you stop it, nothing is charged." },
  { q: "How do limits reset?", a: "Paid plans have two limits. A rolling 5-hour window refreshes on its own a few hours after you start using it. A weekly cap sets the ceiling across the whole week. Free is simpler: five messages in total, with no card and no timer. You can start chatting without an account." },
  { q: "Can I change or cancel?", a: "Yes, any time from your account. Cancelling keeps your plan active until the end of the current period." },
];

const lineup = marketingModels();

export function PricingView({ plans, signedIn, currentPlan, billingConfigured, billingOpen = false, isAdmin = false, showReferral = false }: PricingViewProps) {
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
      window.location.href = "/chat";
      return;
    }
    if (!billingOpen) { note(plan.id, COMING_SOON); return; }
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
      if (data.error?.code === "billing_coming_soon") { note(plan.id, COMING_SOON); return; }
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
          {isAdmin ? (
            <p className="notice" role="status" data-testid="admin-unlocked">Your admin account already has every model and mode unlocked (V1, Fast, Private, Image, Video, Swarm and @computer), whatever the plan below says. These plans are for customers.</p>
          ) : null}
          <h1 className="display hero-title">
            Free, Pro and Max. <HeroChips /> Image with Pro, Video with Max.
          </h1>
          <p className="hero-sub">Start free, upgrade when you need more, and change or cancel from your account. Free includes Citad3L V1 and Fast, plus Private and Swarm with a free account. Pro adds Citad3L Image. Max adds 2.5× the Pro allowance, per-model settings, and Citad3L Video.</p>
          <div className="hero-ctas">
            <Link href="/chat" className="btn btn-primary btn-lg">Start chatting</Link>
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
          {!billingOpen && (
            <div className="checkout-banner" role="status">
              <span>Paid plans coming soon. Free works today, and you can join early access below to hear first.</span>
            </div>
          )}
          <div className="pricing-head">
            <div>
              <h2 className="pricing-head-title">All plans</h2>
              <p className="tiny" style={{ marginTop: 4 }}>For individuals and small teams. Prices in US dollars.</p>
            </div>
            <span className="tiny">Free, Pro, Max</span>
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
                    <span className="plan-period">{p.id === "trial" ? "free" : "/ month"}</span>
                  </div>
                  <div className="plan-cta">
                    <button
                      type="button"
                      className={`btn btn-lg btn-block ${hl ? "btn-inverse" : "btn-secondary"}`}
                      onClick={() => choose(p)}
                      disabled={busy !== null || isCurrent || (p.id !== "trial" && !billingOpen)}
                      aria-busy={busy === p.id}
                    >
                      {busy === p.id && <span className="spinner" />}
                      {isCurrent ? "Current plan" : p.id !== "trial" && !billingOpen ? "Coming soon" : p.cta}
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

          <div className="plan-lineup">
            <div className="plan-lineup-head">
              <h2 className="pricing-head-title">Models by plan</h2>
              <p className="tiny">Private is listed for every plan and arrives when its encryption flow is ready.</p>
            </div>
            <div className="plan-lineup-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    {plans.map((p) => <th key={p.id} scope="col">{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {lineup.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">
                        <span className="plan-lineup-name">{m.name}</span>
                        <span className="plan-lineup-role">{m.role}</span>
                      </th>
                      {plans.map((p) => <td key={p.id}><LineupCell model={m} plan={p.id} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pricing-legend">
            <span className="pricing-legend-line"><Dots n={2} /> Dots show relative allowance. Max is 2.5× Pro.</span>
            <p className="pricing-fine">
              Failed and stopped replies are never charged. Paid allowances refresh every 5 hours, with a weekly cap. Free is a one-time grant of 5 messages, no card required, and no account needed to start. Citad3L Video and per-model settings are included with Max only.
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
          <p className="pricing-fine" style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/faq">See all questions</Link>
          </p>
        </section>

        <section className="section-lg container" aria-label="Updates">
          <WaitlistForm source="pricing" />
        </section>
      </main>
      <Footer showReferral={showReferral} />
    </>
  );
}

export default PricingView;
