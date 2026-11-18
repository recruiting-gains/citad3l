export const MAX_CHARS = 8000;
export const CHAR_WARN_AT = 7000;

export const ENGINE = {
  slug: "citad3l-v1",
  name: "Citad3L V1",
  repoName: "Huihui-Qwen3.8-27B-abliterated-GGUF",
  shortRepo: "Huihui-Qwen3.8-27B-abliterated",
  author: "huihui-ai",
  repoUrl: "https://huggingface.co/huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF",
  baseModel: "Qwen/Qwen3.8-27B",
  baseModelUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
  license: "Apache-2.0",
  licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
  parameters: "~27.8B",
  contextTokens: 262144,
  contextLabel: "262,144 tokens",
  contextShort: "262K",
  format: "GGUF quantizations",
  runtime: "llama.cpp",
  inputs: "Text",
  hfDownloads: "4.29M",
  hfLikes: "2.28K",
  hfStatsLabel: "Hugging Face, Nov 2026",
  attribution:
    "Citad3L V1 is the product name for this open-weights model as served by Citad3L. Citad3L is not affiliated with huihui-ai or Qwen.",
} as const;

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
