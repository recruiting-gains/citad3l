import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  codeCardHtml,
  fitCanvasSize,
  imageKindFor,
  isInlineSafeUrl,
  MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  pageDocumentHtml,
  pngFilename,
  stripExternalCss,
} from "@/lib/html-image";
import { codeBlockFilename } from "@/lib/downloads";
import { countPhotoSlots, countSlides, OWN_IMAGE_RE, slideFilename } from "@/lib/html-image";
import { buildTurns, GRAPHICS_GUIDE, systemPrompt, wantsGraphicsGuide } from "@/lib/prompt";
import { LEAK_RE } from "./leak-words";

const read = (p: string) => readFileSync(p, "utf8");

describe("save as image: what gets drawn", () => {
  it("HTML/SVG blocks (and untagged full documents) render as a page; other code renders as a code card", () => {
    expect(imageKindFor("html", "<div>x</div>")).toBe("page");
    expect(imageKindFor("HTML", "<div>x</div>")).toBe("page");
    expect(imageKindFor("svg", "<svg></svg>")).toBe("page");
    expect(imageKindFor("text", "<!DOCTYPE html><html><body>x</body></html>")).toBe("page");
    expect(imageKindFor("python", "print('<html>')")).toBe("code");
    expect(imageKindFor("css", "body{}")).toBe("code");
  });
  it("names the PNG after the block's own download name", () => {
    const html = "<!doctype html><html><body>post</body></html>";
    expect(pngFilename(codeBlockFilename("html", html, 1), "page")).toBe("code-02.png");
    expect(pngFilename("src/app/page.tsx", "code")).toBe("page.png");
    expect(pngFilename("", "page")).toBe("citad3l-graphic.png");
    expect(pngFilename("snippet.html", "page")).toBe("citad3l-graphic.png");
    expect(pngFilename(undefined, "code")).toBe("citad3l-code.png");
  });
  it("wraps fragments and bare SVG into a full document", () => {
    expect(pageDocumentHtml("<div>hi</div>", "html")).toMatch(/^<!doctype html><html><head>.*<body><div>hi<\/div><\/body><\/html>$/s);
    expect(pageDocumentHtml('<?xml version="1.0"?><svg viewBox="0 0 1 1"></svg>', "svg")).toContain('<body><svg viewBox="0 0 1 1"></svg></body>');
    const full = "<!DOCTYPE html><html><body>x</body></html>";
    expect(pageDocumentHtml(full, "html")).toBe(full);
  });
  it("code cards escape the code so nothing in it is parsed as markup", () => {
    const card = codeCardHtml('<script>alert(1)</script> & "x"', "js");
    expect(card).not.toContain("<script>");
    expect(card).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;");
    expect(card).not.toMatch(/https?:\/\//);
  });
});

describe("save as image: offline and inert", () => {
  it("only inline data: images/fonts and #anchors are allowed as URLs", () => {
    expect(isInlineSafeUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isInlineSafeUrl("data:image/svg+xml,%3Csvg%3E")).toBe(true);
    expect(isInlineSafeUrl("data:font/woff2;base64,AAAA")).toBe(true);
    expect(isInlineSafeUrl("#section")).toBe(true);
    expect(isInlineSafeUrl("https://tracker.example/p.gif")).toBe(false);
    expect(isInlineSafeUrl("//cdn.example/x.png")).toBe(false);
    expect(isInlineSafeUrl("/api/account/export")).toBe(false);
    expect(isInlineSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isInlineSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });
  it("strips @import and external url() from CSS but keeps inline ones", () => {
    const css = `@import url("https://fonts.example/css?family=X"); .a{background:url('https://x.example/a.png')} .b{background:url(data:image/png;base64,AA)}`;
    const out = stripExternalCss(css);
    expect(out).not.toContain("@import");
    expect(out).not.toContain("x.example");
    expect(out).toContain("url(data:image/png;base64,AA)");
    expect(out).toContain(".a{background:none}");
  });
  it("the render never allows scripts and doesn't relax any site security setting", () => {
    const src = read("lib/html-image.ts");
    expect(src).toContain('frame.setAttribute("sandbox", "allow-same-origin")');
    expect(src).not.toMatch(/allow-scripts"|allow-scripts /);
    expect(src).not.toMatch(/allow-(forms|popups|top-navigation|modals)/);
    for (const tag of ["script", "iframe", "object", "embed", "base", "link"]) expect(src).toContain(`"${tag}"`);
    expect(src).toMatch(/name\.startsWith\("on"\)/);
    expect(src).toContain("new DOMParser().parseFromString");
    expect(src).toContain("<foreignObject");
    // No change to the site CSP (frame-src stays limited to the bot check).
    expect(read("security/edge.mjs")).toContain("`frame-src ${TURNSTILE_ORIGIN}`");
  });
});

describe("save as image: canvas limits", () => {
  it("keeps 2x for normal sizes", () => {
    expect(fitCanvasSize(1080, 1350, 2)).toEqual({ width: 2160, height: 2700, scale: 2 });
  });
  it("shrinks very tall pages under the iPhone canvas limits", () => {
    const s = fitCanvasSize(1080, 12000, 2);
    expect(s.width * s.height).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    expect(s.scale).toBeLessThan(2);
  });
  it("clamps silly sizes", () => {
    const s = fitCanvasSize(0, 0, 2);
    expect(s.width).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
  });
});

describe("save as image: chat wiring", () => {
  const md = read("components/chat/Markdown.tsx");
  const gp = read("components/chat/GraphicPreview.tsx");
  it("every code block gets a Save as image button next to Download and Copy", () => {
    expect(md).toContain('data-testid="code-save-image"');
    expect(md).toContain('"Save as image"');
    expect(md).toContain("renderGraphic(clean, lang, { baseName: imageName })");
  });
  it("HTML/SVG designs are drawn into the chat automatically (no file to open), with the code tucked away", () => {
    expect(md).toContain('useGraphicPreview(clean, lang, imageName, kind === "page")');
    expect(md).toContain("<GraphicStrip");
    expect(md).toMatch(/codeHidden \? "Show code" : "Hide code"/);
    expect(gp).toContain("PREVIEW_DEBOUNCE_MS");
  });
  it("iPhone path: share sheet with PNG file(s), else download/zip, else a sheet with Open image (new tab)", () => {
    expect(gp).toMatch(/prefersShareSheet\(files\[0\]\)[\s\S]*navigator\.share\(\{ files: shareable \}\)/);
    expect(gp).toContain("supportsDownloadAttribute()");
    expect(gp).toContain("buildZip(entries)");
    expect(gp).toMatch(/target="_blank"[^>]*data-testid="open-image"/);
    expect(gp).toContain('new File([r.blob], r.name, { type: "image/png" })');
    // A pre-drawn image is saved straight from the tap, so iOS still treats it as a user gesture.
    expect(md).toMatch(/if \(previewReady\) return save\(graphic\.images\)/);
  });
  it("UI copy has no vendor/model ids or banned words", () => {
    const copy = md + gp + read("lib/html-image.ts");
    expect(copy).not.toMatch(LEAK_RE);
    expect(copy).not.toMatch(/abliterat/i);
  });
});

describe("carousels", () => {
  const deck = `<!doctype html><html><body>
<section data-slide style="width:1080px;height:1350px">1</section>
<section class="s" data-slide>2</section>
<section data-slide><img data-photo></section></body></html>`;
  it("counts slides and photo slots", () => {
    expect(countSlides(deck)).toBe(3);
    expect(countSlides("<div>one graphic</div>")).toBe(0);
    expect(countPhotoSlots(deck)).toBe(1);
  });
  it("names slides in order", () => {
    expect(slideFilename("crypto.png", 0, 5)).toBe("crypto-01.png");
    expect(slideFilename("crypto.png", 9, 10)).toBe("crypto-10.png");
    expect(slideFilename("crypto.png", 0, 1)).toBe("crypto.png");
  });
  it("designs export at native size (scale 1), code cards at 2x, one image per data-slide", () => {
    const src = read("lib/html-image.ts");
    expect(src).toContain('opts.scale ?? (kind === "page" ? 1 : 2)');
    expect(src).toContain('d.querySelectorAll("[data-slide]")');
    expect(src).toMatch(/viewBox="\$\{c\.x\} \$\{c\.y\} \$\{c\.width\} \$\{c\.height\}"/);
  });
  it("only the user's own /api/images results are fetched; everything else stays offline", () => {
    expect(OWN_IMAGE_RE.test("/api/images/cm123abc")).toBe(true);
    expect(OWN_IMAGE_RE.test("/api/images/../account/export")).toBe(false);
    expect(OWN_IMAGE_RE.test("https://evil.example/api/images/x")).toBe(false);
    expect(OWN_IMAGE_RE.test("/api/videos/x")).toBe(false);
    expect(read("lib/html-image.ts")).toContain('credentials: "same-origin"');
  });
  it("the model is told it can make carousels, and how, only when the user asks for a design", () => {
    expect(systemPrompt("Citad3L V1")).toContain("You can design graphics and carousels as HTML");
    expect(GRAPHICS_GUIDE).toMatch(/never say you can't/);
    expect(GRAPHICS_GUIDE).toContain("<section data-slide>");
    expect(GRAPHICS_GUIDE).toMatch(/1080x1350/);
    expect(GRAPHICS_GUIDE).toContain("data-photo");
    expect(GRAPHICS_GUIDE).toContain("/api/images/");
    expect(GRAPHICS_GUIDE).not.toMatch(LEAK_RE);
    expect(wantsGraphicsGuide([{ role: "user", content: "make me a carousel of pictures with a border and background" }])).toBe(true);
    expect(wantsGraphicsGuide([{ role: "user", content: "Can you make this as an image, not code?" }])).toBe(true);
    expect(wantsGraphicsGuide([{ role: "user", content: "what's the capital of France?" }])).toBe(false);
    const sys = buildTurns([{ role: "user", content: "design a 5 slide IG carousel" }], null, "Citad3L V1", { customInstructions: "Be my designer." })[0].content;
    expect(sys.indexOf("The only hard lines")).toBeLessThan(sys.indexOf(GRAPHICS_GUIDE));
    expect(sys.indexOf(GRAPHICS_GUIDE)).toBeLessThan(sys.indexOf("Be my designer."));
    expect(buildTurns([{ role: "user", content: "hi" }], null, "Citad3L V1")[0].content).not.toContain(GRAPHICS_GUIDE);
  });
});
