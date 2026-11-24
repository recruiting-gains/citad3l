export const MAX_CHARS = 8000;
export const CHAR_WARN_AT = 7000;

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
