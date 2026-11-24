import Link from "next/link";
import type { PublicModel } from "@/lib/models";
import { modalityLabel, modelBadges } from "@/lib/models";
import { Rook } from "@/components/Rook";
import { SlotVideo } from "@/components/Art";

const IArrow = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Status flags for a model. On art they use fixed glass colors; off art they use theme tokens. */
export function ModelFlags({ model, onArt, isAdmin = false }: { model: PublicModel; onArt?: boolean; isAdmin?: boolean }) {
  const flags = modelBadges(model, isAdmin);
  if (flags.length === 0) return null;

  if (onArt) {
    return (
      <span className="lineup-flags">
        {flags.map((f) => (
          <span key={f.key} className={`art-flag${f.tone === "default" ? "" : ` is-${f.tone}`}`}>{f.label}</span>
        ))}
      </span>
    );
  }
  return (
    <>
      {flags.map((f) => (
        <span key={f.key} className={`pill${f.tone === "default" ? "" : ` pill-${f.tone}`}`}>{f.label}</span>
      ))}
    </>
  );
}

export interface LineupCardProps {
  model: PublicModel;
  lead?: boolean;
  eager?: boolean;
  isAdmin?: boolean;
}

export function LineupCard({ model, lead, eager, isAdmin = false }: LineupCardProps) {
  const slot = lead ? "rookHero" : model.art ?? "rook";
  const cls = ["media-card", "lineup-card", lead ? "is-lead" : "", model.comingSoon ? "is-soon" : ""].filter(Boolean).join(" ");
  return (
    <Link href={`/models/${model.id}`} className={cls}>
      <div className="media">
        <SlotVideo slot={slot} eager={eager} />
        <span className="media-tag">{modalityLabel(model)}</span>
        <ModelFlags model={model} onArt isAdmin={isAdmin} />
      </div>
      <div className="media-meta">
        <span className="media-icon"><Rook size={18} /></span>
        <div>
          <div className="media-title">{model.name}</div>
          {model.role ? <div className="lineup-role">{model.role}</div> : null}
          <p className="media-desc">{model.summary ?? model.description}</p>
          {model.specs && model.specs.length > 0 ? <div className="lineup-specs">{model.specs.join(" · ")}</div> : null}
        </div>
        <span className="media-aside">Details <IArrow /></span>
      </div>
    </Link>
  );
}

export default LineupCard;
