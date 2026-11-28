"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProviderInfo } from "@/lib/types";
import { modelTier, type PublicModel } from "@/lib/models";
import { Rook } from "@/components/Rook";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { SlotVideo } from "@/components/Art";
import { ModelFlags } from "@/components/model/LineupCard";

export interface ModelViewProps {
  provider: ProviderInfo;
  signedIn: boolean;
  model: PublicModel;
  /** ADMIN_EMAILS account: every model is unlocked (the server enforces this per route). */
  isAdmin?: boolean;
  showReferral?: boolean;
  models?: PublicModel[];
}

const sv = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const IPanel = () => <svg {...sv} width={16} height={16}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M9 5v14" /></svg>;

function modalityLabel(m: PublicModel): string {
  if (m.modality === "image") return "Image";
  if (m.modality === "video") return "Video";
  return "Chat";
}

export function ModelView({ provider, signedIn, model, isAdmin = false, showReferral = false, models }: ModelViewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const kind = modalityLabel(model);
  const tier = modelTier(model.id);
  const unlocked = isAdmin && !model.comingSoon;
  const chatReady = !model.comingSoon;
  const plansLabel = isAdmin
    ? "Every model is unlocked on your admin account"
    : model.comingSoon ? "Every plan, once it ships"
      : tier === "max" ? "Max plan only"
        : tier === "pro" || tier === "signin" ? "Pro and Max"
          : "Free, Pro and Max";
  const plansNote = model.comingSoon
    ? "Not available yet."
    : tier === "max"
      ? model.modality === "video" ? "Not included on Free or Pro. Clips are limited per day to keep the service fair." : "Not included on Free or Pro."
      : tier === "pro" || tier === "signin"
        ? model.modality === "image" ? "Not included on Free. Images are limited per day to keep the service fair." : "Not included on Free. The listing stays visible so you can see what it is."
        : "Free chat uses this model. Failed replies are never charged.";
  const howTo =
    model.modality === "video"
      ? "Pick Citad3L Video in chat and describe a clip. Each clip is 5 seconds at 720p, with a daily clip limit."
      : model.modality === "image"
        ? "Pick Citad3L Image in chat and describe a picture, or type /image from any chat model."
        : model.requiresClientE2EE
          ? "Pick Citad3L Private in chat. Text only; no images, web search or Swarm."
          : "Open a chat and make your first move.";
  const ctaTitle = unlocked
    ? `${model.name} is unlocked for you`
    : model.comingSoon
      ? `${model.name} is coming soon`
      : tier === "max"
        ? `${model.name} comes with Max`
        : tier === "pro" || tier === "signin"
          ? `${model.name} comes with Pro and Max`
          : signedIn || isAdmin ? `${model.name} is in your lineup` : `${model.name} is free to try`;
  const ctaSub = model.comingSoon
    ? `${model.name} isn't available in chat yet. Chat uses Citad3L V1 or Fast for now.`
    : signedIn || unlocked
      ? howTo
      : tier === "guest"
        ? "Try 5 messages with no account, or create a free account for 5 every day on Citad3L V1 Fast. No card needed."
        : `This model stays listed so you can see what it is. Pick ${tier === "max" ? "Max" : "Pro or Max"} on the pricing page to use it.`;

  return (
    <>
      <main className="model-layout" data-collapsed={collapsed}>
        <aside className="model-side" aria-label="Model information" aria-hidden={collapsed} inert={collapsed}>
          <div className="model-side-inner">
            <div className="model-art">{model.cover ? <img className="art-cover" src={model.cover} alt={model.coverAlt || model.name} width={1280} height={800} decoding="sync" /> : <SlotVideo slot={model.art ?? "rook"} eager />}</div>

            <div>
              <div className="model-head">
                <span className="model-mark"><Rook size={24} /></span>
                <div>
                  <h1 className="model-title">{model.name}</h1>
                  <div className="model-by">A Citad3L model, served through third-party providers.</div>
                </div>
              </div>
              <div className="pill-row" style={{ marginTop: 14 }}>
                <span className="pill">{kind}</span>
                <ModelFlags model={model} isAdmin={isAdmin} />
                <span className="pill">{provider.mock ? <span className="amber-dot" /> : provider.offline ? <span className="off-dot" /> : <span className="live-dot" />}{provider.mock ? "Mock" : provider.offline ? "Offline" : "Live"}</span>
              </div>
            </div>

            <p className="model-desc">{model.description}</p>

            <div className="stat-card">
              <div className="stat-grid">
                <div className="stat"><div className="stat-label">Status</div><div className="stat-value stat-value-sm">{provider.mock ? <><span className="amber-dot" />Mock</> : provider.offline ? <><span className="off-dot" />Offline</> : <><span className="live-dot" />Live</>}</div></div>
                <div className="stat"><div className="stat-label">Type</div><div className="stat-value stat-value-sm">{kind}</div></div>
                <div className="stat span-2"><div className="stat-label">Plans</div><div className="stat-value stat-value-sm">{plansLabel}</div><div className="stat-note">{plansNote}</div></div>
              </div>
            </div>

            <div className="attribution">
              <div className="attribution-title">Providers</div>
              <p>Citad3L runs on third-party providers. We don&apos;t train these models from scratch.</p>
            </div>
          </div>
        </aside>

        <section className="model-panel" aria-label={`Start using ${model.name}`}>
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
            <h2 className="model-cta-title">{ctaTitle}</h2>
            <p className="model-cta-sub">{ctaSub}</p>
            <div className="model-cta-actions">
              {unlocked || (tier === "guest" && !model.comingSoon) ? (
                <>
                  <Link href={`/chat?model=${encodeURIComponent(model.id)}`} className="btn btn-primary">{unlocked ? `Open ${model.name}` : "Try V1 Fast"}</Link>
                  <Link href="/pricing" className="btn btn-secondary">See plans</Link>
                </>
              ) : (
                <>
                  <Link href="/pricing" className="btn btn-primary">See plans</Link>
                  <Link href="/chat" className="btn btn-secondary">Try V1 Fast</Link>
                </>
              )}
            </div>
            <MockBadge provider={provider} />
          </div>
        </section>
      </main>
      <Footer showReferral={showReferral} models={models} />
    </>
  );
}

export default ModelView;
