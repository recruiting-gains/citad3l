import "server-only";
/**
 * SERVER-ONLY. Brains the owner can pick per Hermes message. Keys double as slash shortcuts ("/astra …").
 * Labels and routes never ship in the public JS bundle: the owner's chat page passes hermesBrainOptions() as props.
 * `route` is a Hermes alias (mapped to a real model only on the Hermes server), never a provider model id.
 * Display labels and route aliases are overridable from Worker secrets (kept out of the public repo):
 *   HERMES_BRAIN_LABELS  JSON { "<key>": "<label>" }
 *   HERMES_ROUTES        JSON { "<key>": "<hermes alias>" }   (HERMES_ROUTE_LARGE also accepted for "large")
 * Premium brains count against the HERMES_PREMIUM_PER_DAY cap (default 10).
 */
type Brain = { label: string; route: string; premium: boolean };
const BRAINS = {
  v1: { label: "V1", route: "hermes", premium: false },
  fast: { label: "Flash", route: "hermes-fast", premium: false },
  uncensored: { label: "Uncensored 1.2", route: "hermes-uncensored", premium: false },
  large: { label: "Large Flash", route: "hermes-large", premium: true },
  sol: { label: "Sol", route: "hermes-sol", premium: true },
  prime: { label: "Prime", route: "hermes-prime", premium: true },
  carbon: { label: "Carbon", route: "hermes-carbon", premium: true },
  astra: { label: "Astra", route: "hermes-astra", premium: true },
  fable: { label: "Fable", route: "hermes-fable", premium: true },
} as const satisfies Record<string, Brain>;
export type HermesBrain = keyof typeof BRAINS;
export const HERMES_BRAIN_KEYS = Object.keys(BRAINS) as HermesBrain[];

function jsonMap(name: string): Record<string, string> {
  try {
    const v = JSON.parse(process.env[name] || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([, s]) => typeof s === "string" && s.trim()).map(([k, s]) => [k, (s as string).trim()]));
  } catch {
    return {};
  }
}

function resolved(key: string, b: Brain): Brain {
  const routes = jsonMap("HERMES_ROUTES");
  const labels = jsonMap("HERMES_BRAIN_LABELS");
  const legacyLarge = key === "large" ? process.env.HERMES_ROUTE_LARGE?.trim() : undefined;
  return { ...b, label: labels[key] || b.label, route: routes[key] || legacyLarge || b.route };
}

export const HERMES_BRAINS: Record<HermesBrain, Brain> = new Proxy(BRAINS as Record<HermesBrain, Brain>, {
  get(target, key) {
    const b = (target as Record<string | symbol, Brain>)[key];
    return b && typeof key === "string" ? resolved(key, b) : b;
  },
});

/** What the owner's composer needs to draw the brain picker (no routes). */
export type HermesBrainOption = { key: string; label: string; premium: boolean };
export function hermesBrainOptions(): HermesBrainOption[] {
  return HERMES_BRAIN_KEYS.map((k) => {
    const b = resolved(k, BRAINS[k]);
    return { key: k, label: b.label, premium: b.premium };
  });
}
