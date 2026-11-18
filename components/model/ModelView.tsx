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
