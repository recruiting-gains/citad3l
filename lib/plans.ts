import { proWeeklyUnits, maxWeeklyUnits, proWindowUnits, maxWindowUnits, TRIAL_REPLIES } from "./config";
import type { PlanCard } from "./types";

export function planCatalog(): PlanCard[] {
  const lineup = "Citad3L V1, Fast and Image";
  const privateChat = "Citad3L Private (encrypted, secure enclave)";
  const swarm = "Swarm mode (V1 leads, Fast workers)";
  const shared = ["Streaming chat with saved history", "Projects with custom instructions", "Export or delete your data any time"];
  return [
    {
      id: "trial",
      name: "Free",
      priceUsd: 0,
      blurb: "Try Citad3L with five messages, no account required.",
      allowance: `${TRIAL_REPLIES} messages, one time`,
      features: [
        "Chat with Citad3L V1 or Fast, no sign-in needed",
        "Free account unlocks Citad3L Private and Swarm",
        "Create an account any time to save chats",
        "Failed replies never count",
      ],
      cta: "Start chatting",
    },
    {
      id: "pro",
      name: "Pro",
      priceUsd: 20,
      blurb: "For daily work across chat and images.",
      allowance: `${proWindowUnits()} replies every 5 hours, up to ${proWeeklyUnits().toLocaleString()} a week`,
      features: [lineup, privateChat, swarm, ...shared, "Allowance refreshes every 5 hours, with a weekly cap"],
      cta: "Get Pro",
      highlight: true,
    },
    {
      id: "max",
      name: "Max",
      priceUsd: 50,
      blurb: "2.5× the Pro allowance, plus Video and model controls.",
      allowance: `${maxWindowUnits()} replies every 5 hours, up to ${maxWeeklyUnits().toLocaleString()} a week`,
      features: [
        lineup,
        "Citad3L Video, Max only",
        "Per-model settings: prompt, temperature, length",
        privateChat,
        swarm,
        ...shared,
        "Allowance refreshes every 5 hours, with a weekly cap",
      ],
      cta: "Get Max",
    },
  ];
}
