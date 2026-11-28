"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Looping card video with a still poster underneath (generic: any model with `coverVideo`).
 * - The poster <img> always renders, so SSR, no-JS, reduced-motion and Save-Data users see a still.
 * - Video sources mount lazily when the card first nears the viewport, then play while at least 35% is visible and pause when it leaves.
 * - Under prefers-reduced-motion or Save-Data the video is never mounted. If the video errors, stalls or autoplay is refused, the poster stays.
 * - MP4 (H.264) is listed first so Safari/iOS never picks WebM; WebM is the fallback.
 * Files: `<video>.mp4`, `<video>.webm` (muted, no audio track). `poster` is the matching still (public path).
 */
const MEDIA_V = "3";

export function CoverVideo({ poster, video, alt, eager = false }: { poster: string; video: string; alt: string; eager?: boolean }) {
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
        const inView = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        visible.current = inView;
        if (mq.matches) return;
        if (inView) {
          setMounted(true);
          vid.current?.play().catch(() => {});
        } else {
          vid.current?.pause();
        }
      },
      { threshold: [0, 0.35, 1] },
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
    // React does not render the `muted` attribute; iOS requires it for inline autoplay.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    if (visible.current) v.play().catch(() => {});
    const t = window.setTimeout(() => { if (v.paused && v.readyState < 2 && visible.current) setFailed(true); }, 10000);
    return () => window.clearTimeout(t);
  }, [mounted]);

  return (
    <div ref={wrap} className={`cover-video${failed ? " is-failed" : ""}`}>
      <img className="art-cover" src={poster} alt={alt} width={1280} height={800} loading={eager ? "eager" : "lazy"} decoding={eager ? "sync" : "async"} />
      {mounted && !failed && (
        <video
          ref={vid}
          className={`art-cover cover-video-el${playing ? " is-playing" : ""}`}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          poster={poster}
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={(e) => {
            if (e.target === e.currentTarget && e.currentTarget.error) setFailed(true);
          }}
        >
          <source src={`${video}.mp4?v=${MEDIA_V}`} type="video/mp4" />
          <source src={`${video}.webm?v=${MEDIA_V}`} type="video/webm" onError={() => setFailed(true)} />
        </video>
      )}
    </div>
  );
}

export default CoverVideo;
