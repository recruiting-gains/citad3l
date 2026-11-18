"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Muted, looping, inline background clip with a poster underneath.
 * - The poster (<picture> AVIF → JPG) always renders, so SSR, no-JS and reduced-motion users see a still.
 * - Video sources are mounted only when the card nears the viewport (lazy). It plays while visible and pauses offscreen.
 * - Under prefers-reduced-motion or Save-Data, the video is never mounted (poster only).
 * Media files live in /public/media/<name>.{webm,mp4} and <name>-poster.{avif,jpg}.
 */
export function LoopVideo({
  name,
  alt,
  position = "50% 50%",
  eager = false,
  className,
}: {
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
      { rootMargin: "200px 0px" },
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
    if (mounted && visible.current) vid.current?.play().catch(() => {});
  }, [mounted]);

  const style = { objectPosition: position };
  return (
    <div ref={wrap} className={`loop-media${className ? ` ${className}` : ""}`} role="img" aria-label={alt}>
      <picture>
        <source srcSet={`/media/${name}-poster.avif`} type="image/avif" />
        <img
          src={`/media/${name}-poster.jpg`}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          style={style}
        />
      </picture>
      {mounted && (
        <video
          ref={vid}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          className={playing ? "is-playing" : undefined}
          style={style}
          onPlaying={() => setPlaying(true)}
        >
          <source src={`/media/${name}.webm`} type="video/webm" />
          <source src={`/media/${name}.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

export default LoopVideo;
