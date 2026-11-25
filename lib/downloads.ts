export interface ExtractedCodeBlock {
  lang: string;
  code: string;
  filename: string;
}

const LANG_EXT: Record<string, { ext: string; exact?: string }> = {
  py: { ext: "py" },
  python: { ext: "py" },
  python3: { ext: "py" },
  ts: { ext: "ts" },
  typescript: { ext: "ts" },
  tsx: { ext: "tsx" },
  js: { ext: "js" },
  javascript: { ext: "js" },
  mjs: { ext: "mjs" },
  cjs: { ext: "cjs" },
  jsx: { ext: "jsx" },
  json: { ext: "json" },
  jsonc: { ext: "jsonc" },
  json5: { ext: "json" },
  sh: { ext: "sh" },
  bash: { ext: "sh" },
  shell: { ext: "sh" },
  zsh: { ext: "sh" },
  fish: { ext: "fish" },
  ps1: { ext: "ps1" },
  powershell: { ext: "ps1" },
  html: { ext: "html" },
  htm: { ext: "html" },
  css: { ext: "css" },
  scss: { ext: "scss" },
  sass: { ext: "sass" },
  less: { ext: "less" },
  sql: { ext: "sql" },
  postgres: { ext: "sql" },
  postgresql: { ext: "sql" },
  mysql: { ext: "sql" },
  sqlite: { ext: "sql" },
  yml: { ext: "yml" },
  yaml: { ext: "yml" },
  toml: { ext: "toml" },
  xml: { ext: "xml" },
  svg: { ext: "svg" },
  md: { ext: "md" },
  markdown: { ext: "md" },
  mdx: { ext: "mdx" },
  rs: { ext: "rs" },
  rust: { ext: "rs" },
  go: { ext: "go" },
  golang: { ext: "go" },
  java: { ext: "java" },
  kt: { ext: "kt" },
  kotlin: { ext: "kt" },
  swift: { ext: "swift" },
  c: { ext: "c" },
  h: { ext: "h" },
  cpp: { ext: "cpp" },
  "c++": { ext: "cpp" },
  cxx: { ext: "cpp" },
  cc: { ext: "cpp" },
  hpp: { ext: "hpp" },
  cs: { ext: "cs" },
  csharp: { ext: "cs" },
  "c#": { ext: "cs" },
  rb: { ext: "rb" },
  ruby: { ext: "rb" },
  php: { ext: "php" },
  r: { ext: "r" },
  lua: { ext: "lua" },
  dart: { ext: "dart" },
  scala: { ext: "scala" },
  ex: { ext: "ex" },
  elixir: { ext: "ex" },
  erl: { ext: "erl" },
  haskell: { ext: "hs" },
  hs: { ext: "hs" },
  dockerfile: { ext: "dockerfile", exact: "Dockerfile" },
  docker: { ext: "dockerfile", exact: "Dockerfile" },
  makefile: { ext: "mk", exact: "Makefile" },
  make: { ext: "mk", exact: "Makefile" },
  ini: { ext: "ini" },
  conf: { ext: "conf" },
  nginx: { ext: "conf" },
  env: { ext: "env" },
  dotenv: { ext: "env" },
  csv: { ext: "csv" },
  tsv: { ext: "tsv" },
  diff: { ext: "diff" },
  patch: { ext: "patch" },
  graphql: { ext: "graphql" },
  gql: { ext: "graphql" },
  prisma: { ext: "prisma" },
  tf: { ext: "tf" },
  terraform: { ext: "tf" },
  hcl: { ext: "hcl" },
  proto: { ext: "proto" },
  protobuf: { ext: "proto" },
  vue: { ext: "vue" },
  svelte: { ext: "svelte" },
  zig: { ext: "zig" },
  solidity: { ext: "sol" },
  sol: { ext: "sol" },
  txt: { ext: "txt" },
  text: { ext: "txt" },
  plaintext: { ext: "txt" },
};

export function normalizeLang(lang?: string): string {
  const raw = (lang ?? "").trim().toLowerCase();
  if (!raw) return "text";
  return raw.split(/[\s:,{]/, 1)[0] || "text";
}

export function extForLang(lang?: string): { ext: string; exact?: string } {
  const key = normalizeLang(lang);
  return LANG_EXT[key] ?? { ext: "txt" };
}

export function sanitizeRelPath(raw: string): string | null {
  const cleaned = raw.trim().replace(/^['"`]+|['"`]+$/g, "").replace(/\\/g, "/");
  if (!cleaned || cleaned.length > 140) return null;
  const parts = cleaned.split("/").filter(Boolean);
  if (!parts.length) return null;
  const safeParts: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "..") return null;
    const p = part.replace(/[^a-zA-Z0-9._-]/g, "");
    if (!p || p === "." || p === "..") return null;
    safeParts.push(p);
  }
  const joined = safeParts.join("/");
  // Must look like a file with an extension or a known extensionless name
  const last = safeParts[safeParts.length - 1];
  if (!/\.[a-zA-Z0-9]{1,12}$/.test(last) && !/^(Dockerfile|Makefile|Procfile)$/i.test(last)) {
    return null;
  }
  return joined;
}

/**
 * Look for a safe filename hint on the first line of a code block (e.g. `# bot/main.py` or `// src/index.ts`)
 * or inside the fence info string (e.g. `python:main.py` or `ts file=app.ts`).
 */
export function extractFilenameHint(code: string, fenceInfo?: string): string | null {
  if (fenceInfo) {
    const colon = /^[^\s:]+:([^\s]+)$/.exec(fenceInfo.trim());
    if (colon) {
      const s = sanitizeRelPath(colon[1]);
      if (s) return s;
    }
    const kv = /(?:file|path|name)\s*=\s*([^\s]+)/i.exec(fenceInfo);
    if (kv) {
      const s = sanitizeRelPath(kv[1]);
      if (s) return s;
    }
  }
  const firstLine = (code.split(/\r?\n/, 1)[0] ?? "").trim();
  if (!firstLine || firstLine.length > 160) return null;
  const commentMatch = /^(?:#|\/\/|--|;|<!--|\*+|\/\*)\s*(?:file(?:name)?\s*[:=]\s*)?([^\s*<>|]+)(?:\s*(?:-->|\*\/))?$/i.exec(firstLine);
  if (!commentMatch) return null;
  return sanitizeRelPath(commentMatch[1]);
}

export function codeBlockFilename(lang: string, code: string, index?: number, fenceInfo?: string): string {
  const hint = extractFilenameHint(code, fenceInfo);
  if (hint) return hint;
  const spec = extForLang(lang);
  if (spec.exact && index === undefined) return spec.exact;
  if (index !== undefined) {
    const num = String(index + 1).padStart(2, "0");
    return spec.exact ? `${spec.exact}-${num}` : `code-${num}.${spec.ext}`;
  }
  return spec.exact ?? `snippet.${spec.ext}`;
}

function dedupeName(candidate: string, used: Set<string>): string {
  const lower = candidate.toLowerCase();
  if (!used.has(lower)) {
    used.add(lower);
    return candidate;
  }
  const slash = candidate.lastIndexOf("/");
  const dir = slash >= 0 ? candidate.slice(0, slash + 1) : "";
  const base = slash >= 0 ? candidate.slice(slash + 1) : candidate;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let n = 2;
  while (true) {
    const next = `${dir}${stem}-${n}${ext}`;
    if (!used.has(next.toLowerCase())) {
      used.add(next.toLowerCase());
      return next;
    }
    n++;
  }
}

export function slugFromTitle(title?: string | null, fallback = "citad3l-answer"): string {
  const base = (title && title !== "New chat" ? title : fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || fallback;
}

export function stripExportFooter(markdown: string): string {
  return markdown.replace(/\n+---\n\*\*Downloads \(signed, 24h\):\*\*[^\n]*\s*$/, "");
}

/**
 * Check a markdown heading or label line immediately above a code fence for a safe relative file path,
 * e.g. "### bot/main.py", "**src/index.ts**", "File: `requirements.txt`", or "`config.json`:".
 */
export function extractPrecedingFilenameHint(prevLine?: string): string | null {
  if (!prevLine) return null;
  const trimmed = prevLine.trim();
  if (!trimmed || trimmed.length > 160) return null;
  // Strip heading hashes, list bullets, bold markers, trailing colon
  const normalized = trimmed
    .replace(/^#{1,6}\s+/, "")
    .replace(/^(?:[-*]|\d+\.)\s+/, "")
    .replace(/^(?:file(?:name)?|path)\s*[:=]\s*/i, "")
    .replace(/:$/, "")
    .trim()
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/^__(.+)__$/, "$1")
    .replace(/^`([^`]+)`$/, "$1")
    .trim();
  if (!normalized || /\s/.test(normalized)) return null;
  return sanitizeRelPath(normalized);
}

/**
 * Parse fenced code blocks (``` or ~~~, any fence length >= 3) from markdown.
 */
export function extractCodeBlocks(markdown: string): ExtractedCodeBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ExtractedCodeBlock[] = [];
  const used = new Set<string>(["answer.md"]);

  let openFenceChar: string | null = null;
  let openFenceLen = 0;
  let fenceInfo = "";
  let prevHint: string | null = null;
  let lastNonEmpty = "";
  let buf: string[] = [];

  for (const line of lines) {
    if (!openFenceChar) {
      const m = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (m) {
        const marker = m[1];
        const info = m[2].trim();
        // Backtick info strings cannot contain backticks in CommonMark
        if (marker[0] === "`" && info.includes("`")) continue;
        openFenceChar = marker[0];
        openFenceLen = marker.length;
        fenceInfo = info;
        prevHint = extractPrecedingFilenameHint(lastNonEmpty);
        buf = [];
      } else if (line.trim()) {
        lastNonEmpty = line;
      }
      continue;
    }
    const closeRe = openFenceChar === "`"
      ? new RegExp(`^[ \\t]{0,3}\`{${openFenceLen},}[ \\t]*$`)
      : new RegExp(`^[ \\t]{0,3}~{${openFenceLen},}[ \\t]*$`);
    if (closeRe.test(line)) {
      const code = buf.join("\n");
      const lang = normalizeLang(fenceInfo);
      const rawName = extractFilenameHint(code, fenceInfo) ?? prevHint ?? codeBlockFilename(lang, code, blocks.length, fenceInfo);
      blocks.push({
        lang,
        code,
        filename: dedupeName(rawName, used),
      });
      openFenceChar = null;
      openFenceLen = 0;
      fenceInfo = "";
      prevHint = null;
      lastNonEmpty = "";
      buf = [];
    } else {
      buf.push(line);
    }
  }
  // If a response ended mid-fence, still rescue the partial code block
  if (openFenceChar && buf.length) {
    const code = buf.join("\n");
    const lang = normalizeLang(fenceInfo);
    const rawName = extractFilenameHint(code, fenceInfo) ?? prevHint ?? codeBlockFilename(lang, code, blocks.length, fenceInfo);
    blocks.push({
      lang,
      code,
      filename: dedupeName(rawName, used),
    });
  }
  return blocks;
}

/* ---------- Minimal, standards-compliant client-side ZIP builder (Store / CRC-32) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

export interface ZipEntryInput {
  name: string;
  content: string | Uint8Array;
}

export function buildZip(entries: ZipEntryInput[], now = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name.replace(/^\/+/, ""));
    const dataBytes = typeof entry.content === "string" ? enc.encode(entry.content) : entry.content;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const lfh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Store (no compression)
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);

    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 filename flag
    cv.setUint16(10, 0, true); // Store
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);

    localParts.push(lfh, dataBytes);
    centralParts.push(cdh);
    offset += lfh.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of localParts) { out.set(p, pos); pos += p.length; }
  for (const p of centralParts) { out.set(p, pos); pos += p.length; }
  out.set(eocd, pos);
  return out;
}

export function buildAnswerZip(markdown: string): { bytes: Uint8Array; fileCount: number; codeCount: number } {
  const cleanMd = stripExportFooter(markdown);
  const blocks = extractCodeBlocks(cleanMd);
  const entries: ZipEntryInput[] = [
    { name: "answer.md", content: cleanMd.replace(/\r?\n$/, "") + "\n" },
    ...blocks.map((b) => ({ name: b.filename, content: b.code.replace(/\r?\n$/, "") + "\n" })),
  ];
  return { bytes: buildZip(entries), fileCount: entries.length, codeCount: blocks.length };
}

export function triggerBlobDownload(data: Uint8Array | string, mime: string, filename: string): void {
  const buf = typeof data === "string" ? data : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  const blob = new Blob([buf], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
