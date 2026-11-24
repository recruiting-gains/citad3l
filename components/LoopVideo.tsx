"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Muted, looping, inline background clip with a poster underneath.
 * - The poster (<picture> AVIF → JPG) always renders, so SSR, no-JS and reduced-motion users see a still.
 * - Video sources are mounted only when the card nears the viewport (lazy). It plays while visible and pauses offscreen.
 * - Under prefers-reduced-motion or Save-Data, the video is never mounted (poster only).
 * - If the video errors, stalls or autoplay is refused (e.g. iOS Low Power Mode), the poster simply stays visible.
 * - MP4 (H.264 Main, faststart) is listed first so Safari/iOS never picks WebM; WebM is a fallback for browsers without H.264.
 * - `mobileName` (optional) swaps in a lighter clip on narrow screens via <source media>.
 * Media files live in /public/media/<name>.{mp4,webm} and <name>-poster.{avif,jpg}.
 */
/** Bump when media files are re-encoded under the same names (cache-buster for browsers and the edge). */
const MEDIA_V = "2";

const DEFAULT_POSTER = { w: 960, h: 540 };
const POSTER_SIZE: Record<string, { w: number; h: number }> = {
  "rook-hero": { w: 1280, h: 720 },
  rook: { w: 1280, h: 720 },
};

export function LoopVideo({
  name,
  alt,
  position = "50% 50%",
  eager = false,
  className,
  mobileName,
}: {
  mobileName?: string;
  name: string;
  alt: string;
  position?: string;
  eager?: boolean;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const visible = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (saveData) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting;
        if (mq.matches) return;
        if (entry.isIntersecting) {
          setMounted(true);
          vid.current?.play().catch(() => {});
        } else {
          vid.current?.pause();
        }
      },
      // Tight margin: don't start downloading looping clips that are still well offscreen.
      { rootMargin: "80px 0px" },
    );
    io.observe(el);

    const onMotionPref = () => {
      if (mq.matches) {
        vid.current?.pause();
        setMounted(false);
        setPlaying(false);
      } else if (visible.current) {
        setMounted(true);
      }
    };
    mq.addEventListener("change", onMotionPref);
    return () => {
      io.disconnect();
      mq.removeEventListener("change", onMotionPref);
    };
  }, []);

  useEffect(() => {
    const v = vid.current;
    if (!mounted || !v) return;
    // React does not render the `muted` attribute; iOS requires it (and defaultMuted) for inline autoplay.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    if (visible.current) v.play().catch(() => {});
    // If nothing plays within 10 s (stalled network, unsupported codec), drop the video and keep the poster.
    const t = window.setTimeout(() => { if (v.paused && v.readyState < 2 && visible.current) setFailed(true); }, 10000);
    return () => window.clearTimeout(t);
  }, [mounted]);

  const poster = POSTER_SIZE[name] ?? DEFAULT_POSTER;
  const style = { objectPosition: position };
  return (
    <div ref={wrap} className={`loop-media${failed ? " is-failed" : ""}${className ? ` ${className}` : ""}`} role="img" aria-label={alt}>
      <picture>
        <source srcSet={`/media/${name}-poster.avif`} type="image/avif" />
        <img
          src={`/media/${name}-poster.jpg`}
          alt=""
          width={poster.w}
          height={poster.h}
          sizes={eager ? "(max-width: 820px) 100vw, 720px" : "(max-width: 820px) 92vw, 420px"}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          style={style}
        />
      </picture>
      {mounted && !failed && (
        <video
          ref={vid}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          className={playing ? "is-playing" : undefined}
          style={style}
          onPlaying={() => setPlaying(true)}
          onError={(e) => {
            // <source> errors (e.g. a skipped media-query source) reach this handler in some browsers; only a real media error counts.
            if (e.target === e.currentTarget && e.currentTarget.error) setFailed(true);
          }}
        >
          {mobileName && <source src={`/media/${mobileName}.mp4?v=${MEDIA_V}`} type="video/mp4" media="(max-width: 820px)" />}
          <source src={`/media/${name}.mp4?v=${MEDIA_V}`} type="video/mp4" />
          <source src={`/media/${name}.webm?v=${MEDIA_V}`} type="video/webm" onError={() => setFailed(true)} />
        </video>
      )}
    </div>
  );
}

export default LoopVideo;
