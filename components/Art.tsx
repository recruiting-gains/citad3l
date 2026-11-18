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
