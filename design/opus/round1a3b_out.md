=== FILE: app/extra-a3.css ===
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
=== END FILE ===

=== FILE: components/Art.tsx ===
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
=== END FILE ===

=== FILE: components/marketing/HomeView.tsx ===
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
=== END FILE ===

=== FILE: components/marketing/PricingView.tsx ===
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
=== END FILE ===

=== FILE: components/model/ModelView.tsx ===
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
=== END FILE ===

=== FILE: components/model/ModelsIndexView.tsx ===
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
=== END FILE ===