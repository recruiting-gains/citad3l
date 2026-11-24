/** Time-of-day greetings. Original Citad3L phrasing; evaluated in the viewer's local time. */

export interface Greeting {
  short: string;
  sub: string;
}

export function timeOfDayGreeting(date: Date = new Date()): Greeting {
  const h = date.getHours();
  if (h < 5) {
    return { short: "Still at it. So are we.", sub: "The quiet hours are good for hard problems." };
  }
  if (h < 12) {
    return { short: "Morning. Set the opening.", sub: "What should we work through first?" };
  }
  if (h < 17) {
    return { short: "Midday. What needs solving?", sub: "Bring the problem. We'll map the moves." };
  }
  if (h < 21) {
    return { short: "Evening. Let's take stock.", sub: "Wrap up the day or start something new." };
  }
  return { short: "Lights low, mind sharp.", sub: "One more idea before you call it?" };
}

/** For greetings that already include punctuation, skip the ", Name" comma splice. */
export function formatGreeting(g: Greeting, name?: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return g.short;
  if (g.short.includes(".")) return g.short;
  return `${g.short}, ${n}`;
}
