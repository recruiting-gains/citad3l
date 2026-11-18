import Link from "next/link";
import type { ProviderInfo } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { SlotVideo } from "@/components/Art";

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
              <SlotVideo slot="rook" eager />
              <span className="media-tag">{provider.mock ? <span className="amber-dot" /> : provider.offline ? <span className="off-dot" /> : <span className="live-dot" />}{provider.mock ? "Mock" : provider.offline ? "Offline" : "Live"}</span>
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
