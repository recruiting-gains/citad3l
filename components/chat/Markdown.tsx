"use client";

import { memo, useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { safeImageSrc, safeLinkHref } from "@/lib/safe-url";
import { videoIdFromSrc } from "@/lib/video-content";
import { codeBlockFilename, triggerBlobDownload } from "@/lib/downloads";
import { imageKindFor, pngFilename, renderGraphic } from "@/lib/html-image";
import { GraphicStrip, SaveImageSheet, savePngs, useGraphicPreview, type PreviewImage } from "@/components/chat/GraphicPreview";

type HNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
};

function textOf(n?: HNode): string {
  if (!n) return "";
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(textOf).join("");
}

function langOf(n?: HNode): string {
  const cls = n?.properties?.className;
  const list = Array.isArray(cls) ? cls.map(String) : typeof cls === "string" ? cls.split(" ") : [];
  for (const c of list) {
    const m = /^language-(.+)$/.exec(c);
    if (m) return m[1];
  }
  return "text";
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
      <path d="M10.5 5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <circle cx="5.75" cy="6.25" r="1.25" />
      <path d="M14 10.5l-3.5-3.5L4 13.5" />
    </svg>
  );
}

function CodeBlock({ lang, text, children }: { lang: string; text: string; children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imaging, setImaging] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [sheet, setSheet] = useState<PreviewImage[] | null>(null);
  const [showCode, setShowCode] = useState(false);
  const clean = text.replace(/\n$/, "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clean);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  const download = () => {
    const filename = codeBlockFilename(lang, clean);
    triggerBlobDownload(clean + "\n", "text/plain;charset=utf-8", filename);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };
  const kind = imageKindFor(lang, clean);
  const imageName = pngFilename(codeBlockFilename(lang, clean), kind);
  // HTML/SVG designs are drawn into the chat as PNGs (one per carousel slide) once the block stops changing.
  const graphic = useGraphicPreview(clean, lang, imageName, kind === "page");
  const previewReady = kind === "page" && graphic.images.length > 0;
  const codeHidden = previewReady && !showCode;

  const save = async (imgs: PreviewImage[]) => {
    const zipName = imageName.replace(/\.png$/i, "") + "-slides.zip";
    const r = await savePngs(imgs, zipName);
    if (r === "fallback") setSheet(imgs);
    if (r === "done") { setImaging("done"); window.setTimeout(() => setImaging("idle"), 1800); }
  };
  const saveImage = async () => {
    if (imaging === "busy") return;
    // Already drawn: save right away (keeps the tap "fresh", so the iPhone share sheet opens).
    if (previewReady) return save(graphic.images);
    setImaging("busy");
    try {
      const imgs = kind === "page"
        ? await graphic.render()
        : (await renderGraphic(clean, lang, { baseName: imageName })).map((r) => ({ url: URL.createObjectURL(r.blob), file: new File([r.blob], r.name, { type: "image/png" }), width: r.width, height: r.height }));
      if (!imgs.length) throw new Error("render_failed");
      setImaging("idle");
      await save(imgs);
    } catch {
      setImaging("error");
      window.setTimeout(() => setImaging("idle"), 2200);
    }
  };
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang}</span>
        <div className="code-actions">
          <button
            type="button"
            className={`code-copy${imaging === "done" ? " is-done" : ""}`}
            onClick={() => void saveImage()}
            disabled={imaging === "busy"}
            data-testid="code-save-image"
            aria-label={kind === "page" ? "Save this page as an image" : "Save this code as an image"}
            title={imaging === "error" ? "Couldn't make an image in this browser" : `Save as image (${imageName})`}
          >
            {imaging === "done" ? <CheckIcon /> : imaging === "busy" ? <span className="spinner" /> : <ImageIcon />}
            {imaging === "busy" ? "Making image…" : imaging === "done" ? "Saved" : imaging === "error" ? "Couldn't save" : "Save as image"}
          </button>
          <button
            type="button"
            className={`code-copy${saved ? " is-done" : ""}`}
            onClick={download}
            data-testid="code-download"
            aria-label={`Download code as ${codeBlockFilename(lang, clean)}`}
            title={`Download ${codeBlockFilename(lang, clean)}`}
          >
            {saved ? <CheckIcon /> : <DownloadIcon />}
            {saved ? "Saved" : "Download"}
          </button>
          <button type="button" className={`code-copy${done ? " is-done" : ""}`} onClick={copy} aria-label="Copy code">
            {done ? <CheckIcon /> : <CopyIcon />}
            {done ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {kind === "page" && (
        <GraphicStrip
          images={graphic.images}
          status={graphic.status}
          photoSlots={graphic.photoSlots}
          photoCount={graphic.photos.length}
          onAddPhotos={(f) => void graphic.addPhotos(f)}
          onSave={(imgs) => void save(imgs)}
          onRetry={() => void graphic.render()}
        />
      )}
      {previewReady && (
        <button type="button" className="code-toggle" onClick={() => setShowCode((v) => !v)} aria-expanded={!codeHidden} data-testid="code-toggle">
          {codeHidden ? "Show code" : "Hide code"}
        </button>
      )}
      {!codeHidden && <pre>{children}</pre>}
      {sheet && <SaveImageSheet images={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

const components: Components = {
  pre({ node, children }) {
    const n = node as unknown as HNode | undefined;
    const code = n?.children?.find((c) => c.type === "element" && c.tagName === "code");
    return (
      <CodeBlock lang={langOf(code)} text={textOf(code)}>
        {children}
      </CodeBlock>
    );
  },
  table({ children }) {
    return (
      <div className="md-table-wrap">
        <table>{children}</table>
      </div>
    );
  },
  a({ href, children }) {
    const safe = safeLinkHref(href);
    if (!safe) return <span>{children}</span>;
    const external = /^https?:\/\//.test(safe);
    return (
      <a href={safe} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer nofollow" : undefined}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const url = safeImageSrc(src);
    if (!url) return null;
    const vid = videoIdFromSrc(url);
    if (vid) return <VideoReply id={vid.id} pending={vid.pending} />;
    return <img src={url} alt={alt ?? ""} className="md-image" />;
  },
};

/** Citad3L Video: a player for `/api/videos/<id>`; while pending, polls `?status=1` (which also finishes the job). */
function VideoReply({ id, pending }: { id: string; pending: boolean }) {
  const [state, setState] = useState<"processing" | "ready" | "error">(pending ? "processing" : "ready");
  useEffect(() => {
    if (state !== "processing") return;
    let alive = true;
    let tries = 0;
    const tick = async () => {
      if (!alive) return;
      tries += 1;
      try {
        const r = await fetch(`/api/videos/${id}?status=1`, { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { status?: string };
        if (!alive) return;
        if (d.status === "ready") return setState("ready");
        if (d.status === "error" || d.status === "not_found" || r.status === 403) return setState("error");
      } catch {
        /* retry */
      }
      if (alive && tries < 120) timer = setTimeout(tick, 6000);
      else if (alive) setState("error");
    };
    let timer = setTimeout(tick, 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id, state]);
  if (state === "processing") return <span className="md-video md-video-pending" role="status">Rendering video… this takes a minute or two.</span>;
  if (state === "error") return <span className="md-video md-video-error">This video couldn't be loaded (the video service failed, or the 24-hour link expired).</span>;
  return <video src={`/api/videos/${id}`} controls playsInline preload="metadata" className="md-image md-video" />;
}

/** Our own allowlist instead of react-markdown's default (which also strips data: images). */
export function markdownUrlTransform(url: string, key: string): string {
  if (key === "src") return safeImageSrc(url) ?? "";
  return safeLinkHref(url) ?? "";
}

function MarkdownImpl({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components} urlTransform={markdownUrlTransform}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
export default Markdown;
