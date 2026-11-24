import Link from "next/link";
import type { ProviderInfo } from "@/lib/types";
import type { PublicModel } from "@/lib/models";
import { marketingModels } from "@/lib/models";
import { Footer } from "@/components/Footer";
import { MockBadge } from "@/components/MockBadge";
import { LineupCard } from "@/components/model/LineupCard";

export interface ModelsIndexViewProps {
  provider: ProviderInfo;
  signedIn: boolean;
  /** Kept for existing callers. The page lists the full marketing lineup from marketingModels(). */
  models?: PublicModel[];
  /** ADMIN_EMAILS account: everything is unlocked. */
  isAdmin?: boolean;
}

export function ModelsIndexView({ provider, signedIn, isAdmin = false }: ModelsIndexViewProps) {
  const list = marketingModels();
  const count = list.length;
  return (
    <>
      <main className="page-main container">
        <header className="page-head">
          <h1 className="page-title">Models</h1>
          <p className="page-sub">{isAdmin
            ? "Each model does a different job. Every model is unlocked on your admin account: V1, Fast, Private, Image and Video, plus Swarm and @computer."
            : "Each model does a different job. Citad3L V1 and Fast are open on every plan, Private comes with a free account, Image comes with Pro and Max, and Video is Max only."}</p>
        </header>
        <div className="page-toolbar">
          <span className="tiny">{count} model{count === 1 ? "" : "s"}</span>
          <MockBadge provider={provider} />
        </div>
        <div className="models-grid">
          {list.map((m, i) => (
            <LineupCard key={m.id} model={m} eager={i < 1} isAdmin={isAdmin} />
          ))}
          <div className="placeholder-card">
            <span className="h4">{signedIn ? "Ready when you are" : "Try it free"}</span>
            <p>{signedIn ? "Open a chat and pick a model from the menu above the composer." : "Five successful replies on the trial, no card needed."}</p>
            <div><Link href={signedIn ? "/chat" : "/login?next=/chat"} className="btn btn-primary btn-sm">{signedIn ? "Go to Chat" : "Start free"}</Link></div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default ModelsIndexView;
