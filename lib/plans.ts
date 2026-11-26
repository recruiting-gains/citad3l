import { proWeeklyUnits, maxWeeklyUnits, proWindowUnits, maxWindowUnits, TRIAL_REPLIES, FREE_DAILY_REPLIES } from "./config";
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
      blurb: "5 messages to try, then 3 every day with a free account.",
      allowance: `Guests: ${TRIAL_REPLIES} messages, one time. Free account: ${FREE_DAILY_REPLIES} messages every day, reset at midnight Central.`,
      features: [
        `${TRIAL_REPLIES} guest messages on Citad3L Fast, no sign-in needed`,
        `A free account gives you ${FREE_DAILY_REPLIES} messages every day on Fast and Private`,
        "Resets at midnight Central. Failed replies never count",
        "Create an account any time to save chats",
        "Swarm uses 4 replies, so it is on Pro and Max",
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
