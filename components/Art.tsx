import { LoopVideo } from "@/components/LoopVideo";

/* ----- Cinematic media slots (generated originals; see media-src/ and design/opus/round5) ----- */
type Slot = { name: string; alt: string; position: string; mobileName?: string };
export const MEDIA: Record<"rookHero" | "rook" | "ai" | "robotics" | "cyber" | "everyday", Slot> = {
  rookHero: { name: "rook-hero", mobileName: "rook", alt: "Glass chess rook glowing with flowing blue and cyan light around an amber core on a dark slab", position: "50% 50%" },
  rook: { name: "rook", alt: "Glass chess rook glowing with flowing blue and cyan light around an amber core on a dark slab", position: "50% 45%" },
  ai: { name: "ai", alt: "Night satellite view of a coastline with a cyan radar sweep and tracking boxes marking vessels", position: "50% 40%" },
  robotics: { name: "robotics", alt: "Graphite robot arm hovering over a metal part as cyan scan lines map it in a dark lab", position: "55% 30%" },
  cyber: { name: "cyber", alt: "Macro of fiber-optic cables carrying cyan light, with a red pulse stopped at a glowing hexagonal gate", position: "70% 45%" },
  everyday: { name: "everyday", alt: "Desk at blue hour with an amber lamp, open blank notebook and steaming mug before a city window", position: "45% 55%" },
};

export function SlotVideo({ slot, eager, className }: { slot: keyof typeof MEDIA; eager?: boolean; className?: string }) {
  const m = MEDIA[slot];
  return <LoopVideo name={m.name} mobileName={m.mobileName} alt={m.alt} position={m.position} eager={eager} className={className} />;
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
      <span className="chip-tile chip-photo"><img src="/media/chip-ai.jpg" alt="" width={80} height={80} /></span>
      <span className="chip-tile chip-photo"><img src="/media/chip-robotics.jpg" alt="" width={80} height={80} /></span>
      <span className="chip-tile chip-photo"><img src="/media/chip-cyber.jpg" alt="" width={80} height={80} /></span>
      <span className="chip-tile chip-photo"><img src="/media/chip-rook.jpg" alt="" width={80} height={80} /></span>
    </span>
  );
}

export const ArtGlyphs = { GlyphAI, GlyphRobot, GlyphShield };

export default HeroChips;
