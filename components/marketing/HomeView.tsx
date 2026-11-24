"use client";

import Link from "next/link";
import type { ProviderInfo } from "@/lib/types";
import { marketingModels } from "@/lib/models";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { LineupCard } from "@/components/model/LineupCard";
import { WaitlistForm } from "@/components/marketing/WaitlistForm";
import { GuestTryBox } from "@/components/marketing/GuestTryBox";

export interface HomeViewProps { signedIn: boolean; provider: ProviderInfo; isAdmin?: boolean; guestUsed?: number; freeLimit?: number; guestChat?: boolean }

const sv = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const INodes = () => <svg {...sv}><circle cx="12" cy="5" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M12 7v4M12 11l-5 5M12 11l5 5" /></svg>;
const IChevR = () => <svg {...sv} width={16} height={16}><path d="M9 6l6 6-6 6" /></svg>;

const plans = [
  { name: "Free", price: "$0", note: "once · 5 successful replies" },
  { name: "Pro", price: "$20", note: "/ month · adds Image", highlight: true },
  { name: "Max", price: "$50", note: "/ month · 2.5× Pro allowance, plus Video" },
];

const lineup = marketingModels();
const lead = lineup.find((m) => m.default) ?? lineup[0];
const rest = lineup.filter((m) => m.id !== lead.id);

export function HomeView({ signedIn, provider, isAdmin = false, guestUsed = 0, freeLimit = 5, guestChat = true }: HomeViewProps) {
  const showTry = !signedIn && guestChat;
  return (
    <>
      <main className="page-main">
        <section className={`hero container${showTry ? " hero-try" : ""}`}>
          <h1 className="display hero-title">AI that answers the question the safe bots dodge.</h1>
          <p className="hero-sub">Ask the thing other AI shrugs at. Citad3L reasons through the grey areas instead of bouncing you to a forum.</p>
          <div className="hero-ctas">
            {signedIn ? (
              <Link href="/chat" className="btn btn-primary btn-lg">Open chat</Link>
            ) : showTry ? (
              <a
                href="#try"
                className="btn btn-primary btn-lg"
                onClick={(e) => {
                  const el = document.getElementById("try-text") as HTMLTextAreaElement | null;
                  if (el) { e.preventDefault(); document.getElementById("try")?.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); }
                }}
              >
                Try it free — no signup
              </a>
            ) : (
              <Link href="/chat" className="btn btn-primary btn-lg">Try it free — no signup</Link>
            )}
            <Link href="/pricing" className="btn btn-secondary btn-lg">See plans <IChevR /></Link>
          </div>
          {provider.mock && <div className="hero-note"><MockBadge provider={provider} /></div>}
          {showTry && <GuestTryBox freeLimit={freeLimit} initialUsed={guestUsed} />}
        </section>

        <section className="container" aria-labelledby="lineup-title">
          <div className="section-head">
            <div>
              <h2 id="lineup-title" className="section-title">Models</h2>
              <p className="section-sub">Five models with different jobs. Private comes with a free account, Image with Pro, and Video with Max.</p>
            </div>
            <Link href="/models" className="btn btn-secondary btn-sm">All models <IChevR /></Link>
          </div>
          <div className="lineup">
            <LineupCard model={lead} lead isAdmin={isAdmin} />
            {rest.map((m) => <LineupCard key={m.id} model={m} isAdmin={isAdmin} />)}
          </div>

          <aside className="swarm" aria-labelledby="swarm-title">
            <div className="swarm-body">
              <div className="swarm-head">
                <span className="swarm-icon"><INodes /></span>
                <h3 id="swarm-title" className="swarm-title">Swarm mode</h3>
              </div>
              <p className="swarm-text">
                Swarm mode is a chat setting for large requests. Citad3L V1 breaks the request into parts, up to three Fast workers handle those parts in parallel, and V1 puts the answer together. Sign in and tap Swarm in chat to turn it on. A Swarm reply uses 4 replies of allowance.
              </p>
            </div>
            <div className="swarm-diagram" aria-hidden="true">
              <span className="swarm-node is-lead">V1 · lead</span>
              <span className="swarm-wire" />
              <span className="swarm-workers">
                <span className="swarm-node">Fast</span>
                <span className="swarm-node">Fast</span>
                <span className="swarm-node">Fast</span>
                <span className="swarm-node">Fast</span>
              </span>
            </div>
          </aside>
        </section>

        <section className="section-lg container" aria-labelledby="how-title">
          <div className="section-head">
            <div>
              <h2 id="how-title" className="section-title">How it works</h2>
              <p className="section-sub">Three moves from question to answer.</p>
            </div>
          </div>
          <div className="steps">
            <div className="step"><div className="step-num">01</div><div className="step-title">Try it</div><p className="step-body">Ask a few questions right here with no signup. Save your chat with your email when you want to keep going. No card.</p></div>
            <div className="step"><div className="step-num">02</div><div className="step-title">Set the board</div><p className="step-body">Group work into projects with standing instructions so context carries forward.</p></div>
            <div className="step"><div className="step-num">03</div><div className="step-title">Make your move</div><p className="step-body">Ask, iterate, retry. Failed or stopped replies never count against you.</p></div>
          </div>

          <div className="section-head" style={{ marginTop: 56 }}>
            <div>
              <h2 className="section-title">Plans</h2>
              <p className="section-sub">Plans differ in allowance. Pro adds Citad3L Image; Max adds Citad3L Video.</p>
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

        <section className="section-lg container" aria-label="Updates">
          <WaitlistForm source="home" />
        </section>
      </main>
      <Footer />
    </>
  );
}

export default HomeView;
