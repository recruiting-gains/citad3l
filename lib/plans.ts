import { proUnits, maxUnits, TRIAL_REPLIES } from "./config";
import type { PlanCard } from "./types";
export function planCatalog(): PlanCard[] {
  const shared = ["Citad3L V1 engine", "Streaming chat with saved history", "Projects with custom instructions", "Export or delete your data any time"];
  return [
    { id: "trial", name: "Trial", priceUsd: 0, blurb: "Try Citad3L once, no card needed.", allowance: `${TRIAL_REPLIES} replies, one time`, features: [...shared, "Failed replies never count"], cta: "Start free" },
    { id: "pro", name: "Pro", priceUsd: 20, blurb: "Your daily strategic partner.", allowance: `${proUnits().toLocaleString()} replies / month`, features: [...shared, "Monthly allowance resets on your billing date"], cta: "Get Pro", highlight: true },
    { id: "max", name: "Max", priceUsd: 50, blurb: "2.5× the Pro allowance for heavy use.", allowance: `${maxUnits().toLocaleString()} replies / month`, features: [...shared, "2.5× Pro allowance, same engine"], cta: "Get Max" },
  ];
}
