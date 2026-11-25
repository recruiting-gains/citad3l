/**
 * Client-side, zero-dependency PDF 1.4 generator for Citad3L chat answers.
 * Renders headings, paragraphs, lists, and fenced code blocks (shaded Courier monospace)
 * onto US Letter pages (612x792 pt) with pagination and WinAnsi text safety.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 48;
const TOP_Y = PAGE_H - 52;
const BOTTOM_Y = 52;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 516 pt

type MdBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "list"; bullet: string; text: string }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "para"; text: string };

const UNICODE_MAP: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": ",",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u2013": "-",
  "\u2014": "--",
  "\u2015": "--",
  "\u2212": "-",
  "\u2026": "...",
  "\u2022": "*",
  "\u25CF": "*",
  "\u25E6": "-",
  "\u25AA": "-",
  "\u2192": "->",
  "\u2190": "<-",
  "\u2194": "<->",
  "\u21D2": "=>",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2260": "!=",
  "\u2248": "~=",
  "\u00D7": "x",
  "\u00F7": "/",
  "\u2713": "[ok]",
  "\u2714": "[ok]",
  "\u2705": "[ok]",
  "\u26A0": "[!]",
  "\u00A0": " ",
  "\u200B": "",
  "\uFEFF": "",
};

/** Normalize text to printable WinAnsi / ASCII so PDF Type1 fonts never render mojibake. */
export function toPdfText(input: string): string {
  let out = "";
  const normalized = input.replace(/\t/g, "  ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  for (const ch of normalized) {
    if (ch in UNICODE_MAP) {
      out += UNICODE_MAP[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 32;
    if (code >= 0x20 && code <= 0x7e) {
      out += ch;
    } else if (code === 0x00b7) {
      out += "|";
    } else if (code === 0x0a || code === 0x0d) {
      out += " ";
    }
  }
  return out;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function stripInlineMd(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "[$1]")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function parseMarkdownBlocks(markdown: string): MdBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "para", text: stripInlineMd(text) });
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence && !(fence[1][0] === "`" && fence[2].includes("`"))) {
      flushPara();
      const ch = fence[1][0];
      const len = fence[1].length;
      const lang = fence[2].trim().split(/[\s:,{]/, 1)[0] || "text";
      const closeRe = ch === "`"
        ? new RegExp(`^[ \\t]{0,3}\`{${len},}[ \\t]*$`)
        : new RegExp(`^[ \\t]{0,3}~{${len},}[ \\t]*$`);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ kind: "code", lang, lines: codeLines });
      continue;
    }

    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }
    if (/^[ \t]*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ kind: "heading", level: heading[1].length, text: stripInlineMd(heading[2]) });
      i++;
      continue;
    }
    const ul = /^[ \t]*[-*+]\s+(.+)$/.exec(line);
    if (ul) {
      flushPara();
      blocks.push({ kind: "list", bullet: "*", text: stripInlineMd(ul[1]) });
      i++;
      continue;
    }
    const ol = /^[ \t]*(\d+\.)\s+(.+)$/.exec(line);
    if (ol) {
      flushPara();
      blocks.push({ kind: "list", bullet: ol[1], text: stripInlineMd(ol[2]) });
      i++;
      continue;
    }
    const quote = /^[ \t]*>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      blocks.push({ kind: "quote", text: stripInlineMd(quote[1]) });
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return blocks;
}

/** Approximate Helvetica glyph width in points. */
function approxWidth(text: string, fontSize: number, mono = false): number {
  if (mono) return text.length * fontSize * 0.6;
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ("ilI.,;:'!| ".includes(c)) w += 0.28;
    else if ("mwMW@#%&".includes(c)) w += 0.78;
    else if (c >= "A" && c <= "Z") w += 0.64;
    else w += 0.52;
  }
  return w * fontSize;
}

function wrapText(raw: string, maxWidthPt: number, fontSize: number, mono = false): string[] {
  const safe = toPdfText(raw);
  if (!safe) return [""];
  if (mono) {
    const maxChars = Math.max(20, Math.floor(maxWidthPt / (fontSize * 0.6)));
    const out: string[] = [];
    for (let i = 0; i < safe.length; i += maxChars) {
      out.push(safe.slice(i, i + maxChars));
    }
    return out.length ? out : [""];
  }
  const words = safe.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (approxWidth(next, fontSize) <= maxWidthPt) {
      cur = next;
    } else if (!cur) {
      // Single long word / URL: hard-wrap cleanly
      let rest = w;
      const chunkMax = Math.max(12, Math.floor(maxWidthPt / (fontSize * 0.54)));
      while (rest.length > chunkMax) {
        lines.push(rest.slice(0, chunkMax));
        rest = rest.slice(chunkMax);
      }
      cur = rest;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function buildChatPdf(markdown: string, opts?: { title?: string; createdAt?: string }): Uint8Array {
  const blocks = parseMarkdownBlocks(markdown);
  const pages: string[][] = [[]];
  let y = TOP_Y;

  const currentPage = () => pages[pages.length - 1];
  const newPage = () => {
    pages.push([]);
    y = TOP_Y;
  };
  const ensureSpace = (neededPt: number) => {
    if (y - neededPt < BOTTOM_Y) newPage();
  };

  const drawText = (font: "F1" | "F2" | "F3", size: number, x: number, baselineY: number, text: string, rgb = "0.1 0.12 0.16") => {
    const clean = pdfEscape(toPdfText(text));
    currentPage().push(`BT /${font} ${size} Tf ${rgb} rg 1 0 0 1 ${x.toFixed(1)} ${baselineY.toFixed(1)} Tm (${clean}) Tj ET`);
  };

  // Header on page 1
  const title = toPdfText(opts?.title?.trim() || "Citad3L Answer");
  const stamp = toPdfText(opts?.createdAt ? new Date(opts.createdAt).toLocaleString("en-US") : new Date().toLocaleString("en-US"));
  drawText("F2", 15, MARGIN_X, y, title.slice(0, 72));
  y -= 16;
  drawText("F1", 8.5, MARGIN_X, y, `Citad3L export | ${stamp}`, "0.42 0.45 0.5");
  y -= 10;
  currentPage().push(`0.85 0.87 0.9 RG 0.8 w ${MARGIN_X} ${y.toFixed(1)} m ${(PAGE_W - MARGIN_X).toFixed(1)} ${y.toFixed(1)} l S`);
  y -= 18;

  for (const b of blocks) {
    if (b.kind === "heading") {
      const size = b.level === 1 ? 14 : b.level === 2 ? 12.5 : 11;
      const lineH = size + 5;
      const wrapped = wrapText(b.text, CONTENT_W, size);
      ensureSpace(wrapped.length * lineH + 10);
      y -= 4;
      for (const line of wrapped) {
        drawText("F2", size, MARGIN_X, y, line);
        y -= lineH;
      }
      y -= 4;
      continue;
    }

    if (b.kind === "hr") {
      ensureSpace(16);
      currentPage().push(`0.86 0.88 0.91 RG 0.6 w ${MARGIN_X} ${y.toFixed(1)} m ${(PAGE_W - MARGIN_X).toFixed(1)} ${y.toFixed(1)} l S`);
      y -= 14;
      continue;
    }

    if (b.kind === "list") {
      const size = 10;
      const lineH = 14.5;
      const indent = 16;
      const wrapped = wrapText(b.text, CONTENT_W - indent, size);
      for (let idx = 0; idx < wrapped.length; idx++) {
        ensureSpace(lineH);
        if (idx === 0) drawText("F2", size, MARGIN_X + 2, y, b.bullet);
        drawText("F1", size, MARGIN_X + indent, y, wrapped[idx]);
        y -= lineH;
      }
      y -= 2;
      continue;
    }

    if (b.kind === "quote") {
      const size = 10;
      const lineH = 14.5;
      const wrapped = wrapText(b.text, CONTENT_W - 14, size);
      for (const line of wrapped) {
        ensureSpace(lineH);
        currentPage().push(`0.75 0.78 0.82 RG 2 w ${(MARGIN_X + 4).toFixed(1)} ${(y + 9).toFixed(1)} m ${(MARGIN_X + 4).toFixed(1)} ${(y - 3).toFixed(1)} l S`);
        drawText("F1", size, MARGIN_X + 14, y, line, "0.28 0.31 0.36");
        y -= lineH;
      }
      y -= 4;
      continue;
    }

    if (b.kind === "para") {
      const size = 10;
      const lineH = 14.5;
      const wrapped = wrapText(b.text, CONTENT_W, size);
      for (const line of wrapped) {
        ensureSpace(lineH);
        drawText("F1", size, MARGIN_X, y, line);
        y -= lineH;
      }
      y -= 6;
      continue;
    }

    if (b.kind === "code") {
      const fontSize = 8.5;
      const lineH = 11.5;
      const padX = 10;
      const padY = 8;
      const innerW = CONTENT_W - padX * 2;
      const wrappedLines: string[] = [];
      for (const rawLine of b.lines) {
        wrappedLines.push(...wrapText(rawLine, innerW, fontSize, true));
      }
      if (!wrappedLines.length) wrappedLines.push("");

      // Split tall code blocks cleanly across pages
      let cursor = 0;
      let isFirstChunk = true;
      while (cursor < wrappedLines.length) {
        const headerH = isFirstChunk ? 14 : 0;
        const availH = y - BOTTOM_Y - padY * 2 - headerH;
        const maxFit = Math.floor(availH / lineH);
        if (maxFit < 2) {
          newPage();
          continue;
        }
        const chunk = wrappedLines.slice(cursor, cursor + maxFit);
        const boxH = headerH + chunk.length * lineH + padY * 2;
        const boxBottom = y - boxH;
        // Shaded background + subtle border
        currentPage().push(
          `0.95 0.96 0.98 rg 0.84 0.86 0.9 RG 0.6 w ${MARGIN_X.toFixed(1)} ${boxBottom.toFixed(1)} ${CONTENT_W.toFixed(1)} ${boxH.toFixed(1)} re B`
        );
        let textY = y - padY - 7;
        if (isFirstChunk) {
          drawText("F2", 7.5, MARGIN_X + padX, textY, b.lang.toUpperCase(), "0.4 0.44 0.52");
          textY -= headerH;
        }
        for (const cl of chunk) {
          drawText("F3", fontSize, MARGIN_X + padX, textY, cl, "0.12 0.14 0.18");
          textY -= lineH;
        }
        y = boxBottom - 8;
        cursor += chunk.length;
        isFirstChunk = false;
        if (cursor < wrappedLines.length) newPage();
      }
    }
  }

  // Page footers
  const totalPages = pages.length;
  for (let p = 0; p < totalPages; p++) {
    const footer = pdfEscape(`Citad3L   |   Page ${p + 1} of ${totalPages}`);
    pages[p].push(`BT /F1 8 Tf 0.48 0.51 0.56 rg 1 0 0 1 ${MARGIN_X} 26 Tm (${footer}) Tj ET`);
  }

  // Assemble PDF objects
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold, 5: Courier, then pairs of (Page, ContentStream)
  const enc = new TextEncoder();
  const objects: string[] = [];
  const pageIds: number[] = [];

  for (let p = 0; p < totalPages; p++) {
    const pageObjId = 6 + p * 2;
    pageIds.push(pageObjId);
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${totalPages} >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n`);

  for (let p = 0; p < totalPages; p++) {
    const pageId = 6 + p * 2;
    const streamId = pageId + 1;
    const contentStr = pages[p].join("\n");
    const contentLen = enc.encode(contentStr).length;
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${streamId} 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStr}\nendstream\nendobj\n`
    );
  }

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const chunks: Uint8Array[] = [enc.encode(header)];
  let byteOffset = chunks[0].length;
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(byteOffset);
    const b = enc.encode(obj);
    chunks.push(b);
    byteOffset += b.length;
  }

  const xrefOffset = byteOffset;
  const xrefLines = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  xrefLines.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  chunks.push(enc.encode(xrefLines.join("")));

  const totalBytes = chunks.reduce((s, c) => s + c.length, 0);
  const pdf = new Uint8Array(totalBytes);
  let pos = 0;
  for (const c of chunks) {
    pdf.set(c, pos);
    pos += c.length;
  }
  return pdf;
}
