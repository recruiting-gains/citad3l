import Link from "next/link";
import type { ProviderInfo } from "@/lib/types";
import type { PublicModel } from "@/lib/models";
import { marketingModels } from "@/lib/models";
import { SiteFooter } from "@/components/SiteFooter";
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
  const media = list.some((m) => m.modality === "image" || m.modality === "video");
  return (
    <>
      <main className="page-main container">
        <header className="page-head">
          <h1 className="page-title">Models</h1>
          <p className="page-sub">{isAdmin
            ? media
              ? "Each model does a different job. Every model is unlocked on your admin account, including Image and Video, plus Swarm and @computer."
              : "Each model does a different job. Every chat model is unlocked on your admin account, plus Swarm and @computer."
            : media
              ? "Each model does a different job. Free has Citad3L V1, Fast, Private, Gemma 4 Uncensored and Uncensored 1.2 (Private needs a free account). Pro adds Role Play Uncensored, Inkling 2 Mini and Qwen 3.8 27B, plus Image. Max adds Qwen 4 Max, Grok 4.7 and Kimi K3.1 Pro, plus Video."
              : "Each model does a different job. Free has Citad3L V1, Fast, Private, Gemma 4 Uncensored and Uncensored 1.2 (Private needs a free account). Pro adds Role Play Uncensored, Inkling 2 Mini and Qwen 3.8 27B. Max adds Qwen 4 Max, Grok 4.7 and Kimi K3.1 Pro."}</p>
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
      <SiteFooter />
    </>
  );
}

export default ModelsIndexView;
