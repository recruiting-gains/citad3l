import { proWeeklyUnits, maxWeeklyUnits, proWindowUnits, maxWindowUnits, TRIAL_REPLIES, FREE_DAILY_REPLIES } from "./config";
import { LIST_PRICE_USD } from "./holiday";
import { mediaGenerationEnabled } from "./media";
import type { PlanCard } from "./types";

export function planCatalog(): PlanCard[] {
  const media = mediaGenerationEnabled();
  const lineup = media ? "Citad3L V1 Fast and Image" : "Citad3L V1 Fast and Private";
  const privateChat = "Citad3L Private (encrypted, secure enclave)";
  const swarm = "Swarm mode (V1 Fast leads, workers in parallel)";
  const freeModels = "Free lineup: Citad3L V1 Fast, Private, Gemma 4 Uncensored, Uncensored 1.2 and GLM 5.3 Flash Uncensored";
  const proModels = "Pro models: Role Play Uncensored, Inkling 2 Mini and Qwen 3.8 27B (8 chat models in all)";
  const maxModels = "Max models: Qwen 4 Max, Grok 4.7, Kimi K3.1 Pro and Kimi K2.7 Code on top of Pro";
  const shared = ["Streaming chat with saved history", "Projects with custom instructions", "Export or delete your data any time"];
  const proFeatures = media
    ? [lineup, proModels, privateChat, swarm, ...shared, "Allowance refreshes every 5 hours, with a weekly cap"]
    : [lineup, proModels, swarm, ...shared, "Allowance refreshes every 5 hours, with a weekly cap"];
  const maxFeatures = media
    ? [lineup, proModels, maxModels, "Citad3L Video, Max only", "Per-model settings: prompt, temperature, length", privateChat, swarm, ...shared, "Allowance refreshes every 5 hours, with a weekly cap"]
    : [lineup, proModels, maxModels, "Per-model settings: prompt, temperature, length", swarm, ...shared, "Allowance refreshes every 5 hours, with a weekly cap"];
  return [
    {
      id: "trial",
      name: "Free",
      priceUsd: 0,
      blurb: "5 messages to try, then 3 every day with a free account.",
      allowance: `Guests: ${TRIAL_REPLIES} messages, one time. Free account: ${FREE_DAILY_REPLIES} messages every day, reset at midnight Central.`,
      features: [
        `${TRIAL_REPLIES} guest messages on Citad3L V1 Fast, Gemma 4 Uncensored, Uncensored 1.2 or GLM 5.3 Flash Uncensored, no sign-in needed`,
        `A free account gives you ${FREE_DAILY_REPLIES} messages every day across the Free lineup`,
        freeModels,
        "Resets at midnight Central. Failed replies never count",
        "Create an account any time to save chats",
        "Swarm uses 4 replies, so it is on Pro and Max",
      ],
      cta: "Start chatting",
    },
    {
      id: "pro",
      name: "Pro",
      priceUsd: LIST_PRICE_USD.pro,
      blurb: media ? "For daily work across chat and images." : "For daily work.",
      allowance: `${proWindowUnits()} replies every 5 hours, up to ${proWeeklyUnits().toLocaleString()} a week`,
      features: proFeatures,
      cta: "Get Pro",
      highlight: true,
    },
    {
      id: "max",
      name: "Max",
      priceUsd: LIST_PRICE_USD.max,
      blurb: media ? "2.5× the Pro allowance, plus Video and model controls." : "2.5× the Pro allowance, plus model controls.",
      allowance: `${maxWindowUnits()} replies every 5 hours, up to ${maxWeeklyUnits().toLocaleString()} a week`,
      features: maxFeatures,
      cta: "Get Max",
    },
  ];
}
