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
  { title: "Model", sub: "One engine, documented", href: "/models/citad3l-v1", icon: <ICube />, badge: "new" },
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
