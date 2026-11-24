"use client";

import { memo, useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { safeImageSrc, safeLinkHref } from "@/lib/safe-url";
import { videoIdFromSrc } from "@/lib/video-content";

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
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeBlock({ lang, text, children }: { lang: string; text: string; children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ""));
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang}</span>
        <button type="button" className={`code-copy${done ? " is-done" : ""}`} onClick={copy} aria-label="Copy code">
          {done ? <CheckIcon /> : <CopyIcon />}
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
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
