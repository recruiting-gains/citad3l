import { describe, expect, it, vi } from "vitest";
import { BRAND_KIT, designGuideFor, detectFormat, FORMAT_SIZES, TEMPLATES, type DesignFormat } from "@/lib/design-kit";
import { canvasSize, extractHtmlBlock, lintDesign, replaceHtmlBlock, shouldCritique } from "@/lib/design-lint";
import { critiqueAndFix } from "@/lib/design-check";
import { buildTurns, GRAPHICS_GUIDE } from "@/lib/prompt";

const FORMATS: DesignFormat[] = ["post", "story", "square", "landscape"];
const VENDOR_RE = /\b(venice|openai|anthropic|claude|deepseek|qwen|kimi|grok|gemma|glm|llama|mistral|e2ee|end-to-end)\b/i;

// The failed "Fort Week" post, rebuilt from the member's screenshot: heavy green frame, headline laid over a
// photo collage, the cover image twice, three small product photos, four fonts.
const BAD = `<style>
.post{width:1080px;height:1350px;border:14px solid #1f3d2b;background:#24452f;position:relative;font-family:Helvetica}
.collage{position:absolute;left:40px;top:120px;width:640px;height:1000px;background-image:url(/api/images/cover1)}
.title{position:absolute;left:40px;bottom:160px;font-family:Georgia;font-size:96px;color:#fff}
.tag{font-family:"Courier New";font-size:20px;color:#a7d7b8}
.side img{width:300px;height:300px}
.sub{font-family:Impact;font-size:30px;color:#e0e0e0}
</style>
<div class="post"><div class="tag">FORT WEEK · READ IT, BUILD IT</div><div class="collage"></div>
<div class="title"><h1>The Fort and the real thing.</h1><p class="sub">One story. Four ways to build it.</p></div>
<div class="side"><img src="/api/images/tent1"><img src="/api/images/frame2"><img src="/api/images/cover1"></div></div>`;

const reply = (html: string) => `Here's your post.\n\n\`\`\`html\n${html}\n\`\`\`\n\nOne slide: Fort Week.`;

describe("design kit", () => {
  it("every template lints clean, has its exact size, and fits the token budget", () => {
    for (const f of FORMATS) {
      expect(lintDesign(TEMPLATES[f]), f).toEqual([]);
      expect(canvasSize(TEMPLATES[f])).toBe(`${FORMAT_SIZES[f].width}x${FORMAT_SIZES[f].height}`);
      expect((TEMPLATES[f].match(/data-photo/g) ?? []).length).toBe(1);
      expect(designGuideFor(f).length).toBeLessThanOrEqual(2000);
      expect(designGuideFor(f)).not.toMatch(VENDOR_RE);
    }
  });
  it("brand kit is overridable and names no vendor", () => {
    expect(BRAND_KIT).toMatch(/use theirs instead/);
    expect(BRAND_KIT).not.toMatch(VENDOR_RE);
    expect(GRAPHICS_GUIDE).not.toMatch(VENDOR_RE);
  });
  it("detects the canvas", () => {
    expect(detectFormat("make an IG story for our sale")).toBe("story");
    expect(detectFormat("square post for the menu")).toBe("square");
    expect(detectFormat("make an X post graphic")).toBe("landscape");
    expect(detectFormat("tweet header for launch day")).toBe("landscape");
    expect(detectFormat("Make a 1080x1350 IG post for Fort Week")).toBe("post");
    expect(detectFormat("make a poster")).toBe("post");
    expect(detectFormat("a 1080x1920 graphic")).toBe("story");
  });
  it("adds only the requested layout to design turns", () => {
    const sys = buildTurns([{ role: "user", content: "make an IG story for Fort Week" }], null, "Citad3L V1")[0].content;
    expect(sys).toContain(TEMPLATES.story);
    expect(sys).not.toContain(TEMPLATES.post);
    expect(sys).toContain(BRAND_KIT);
    const plain = buildTurns([{ role: "user", content: "hi" }], null, "Citad3L V1")[0].content;
    expect(plain).not.toContain(BRAND_KIT);
    // User brand instructions come after the kit, so they win.
    const custom = buildTurns([{ role: "user", content: "make an IG post" }], null, "Citad3L V1", { customInstructions: "Brand: navy and gold." })[0].content;
    expect(custom.indexOf(BRAND_KIT)).toBeLessThan(custom.indexOf("navy and gold"));
  });
});

describe("design lint", () => {
  it("flags the failed Fort Week post", () => {
    const codes = lintDesign(BAD).map((i) => i.code);
    for (const c of ["text-over-image", "repeated-image", "too-many-images", "heavy-frame", "fonts", "tiny-text", "crowding"]) expect(codes, c).toContain(c);
    expect(lintDesign(BAD).every((i) => i.message.length <= 90)).toBe(true);
  });
  it("passes a clean layout with a scrimmed photo panel", () => {
    const clean = `<style>.g{width:1080px;height:1350px;padding:88px;background:#fff;color:#111;font-family:Helvetica}
h1{font-size:120px}.cap{position:absolute;left:88px;bottom:88px;background:#111;color:#fff;font-size:40px}</style>
<div class="g"><img src="/api/images/a"><div class="cap"><p>Caption</p></div><h1>Title</h1></div>`;
    expect(lintDesign(clean)).toEqual([]);
  });
  it("extract and replace round trip", () => {
    const t = reply("<div>old</div>");
    expect(extractHtmlBlock(t)?.html).toBe("<div>old</div>");
    const r = replaceHtmlBlock(t, "<div>new</div>");
    expect(r).toContain("<div>new</div>");
    expect(r.startsWith("Here's your post.")).toBe(true);
    expect(r.endsWith("One slide: Fort Week.")).toBe(true);
    expect(shouldCritique(reply(BAD))).toBe(true);
    expect(shouldCritique(reply(TEMPLATES.post))).toBe(false);
    expect(shouldCritique("no html here")).toBe(false);
  });
});

describe("critique and fix (one pass)", () => {
  const fixedPost = TEMPLATES.post;
  const badWithOnePhoto = BAD.replace(/<div class="side">[\s\S]*?<\/div><\/div>$/, "</div>").replace('class="collage"', 'class="collage" data-photo').replace(/background-image:url\([^)]*\)/, "background:#333");
  it("swaps in a strictly better fix that keeps size and photo slots", async () => {
    const complete = vi.fn(async () => reply(fixedPost));
    const out = await critiqueAndFix({ text: reply(badWithOnePhoto), format: "post", complete });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(out.changed).toBe(true);
    expect(out.text).toContain(fixedPost);
    expect(out.after.length).toBeLessThan(out.before.length);
  });
  it("keeps the original on garbage, errors, a fix that removes every photo slot, or one that changes the canvas", async () => {
    for (const complete of [async () => "sorry", async () => { throw new Error("down"); }, async () => reply(fixedPost.replace(" data-photo", "")), async () => reply(fixedPost.replace("width:1080px;height:1350px", "width:1080px;height:1080px"))]) {
      const out = await critiqueAndFix({ text: reply(badWithOnePhoto), format: "post", complete });
      expect(out.changed).toBe(false);
      expect(out.text).toBe(reply(badWithOnePhoto));
    }
  });
  it("accepts a fix that trims extra photos down to one focal image", async () => {
    const three = TEMPLATES.post.replace('<div class="p" data-photo></div>', '<div class="p" data-photo></div><img data-photo><img data-photo>');
    expect(lintDesign(three).map((i) => i.code)).toContain("too-many-images");
    const out = await critiqueAndFix({ text: reply(three), format: "post", complete: async () => reply(TEMPLATES.post) });
    expect(out.changed).toBe(true);
  });
  it("never calls the model when the design already passes", async () => {
    const complete = vi.fn(async () => "x");
    const out = await critiqueAndFix({ text: reply(TEMPLATES.square), format: "square", complete });
    expect(complete).not.toHaveBeenCalled();
    expect(out.changed).toBe(false);
  });
});
