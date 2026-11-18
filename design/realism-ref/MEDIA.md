# Citad3L cinematic media (round 5)

**Art direction.** Opus 5.5 via the API (returned model id `claude-opus-5-5`).
- Brief: `design/opus/round5/out.md` (req_011Ch9bm8Cd2NG4ukBF6RU82)
- QA review: `design/opus/round5/review_out.md` (req_011Ch9dPJaL7SddHku5jXLiM)

**Generation.**
- First frames: Grok Imagine stills (`media-src/stills/`).
- Clips: image-to-video using the same still as first and last frame for a seamless loop, 720p. The hero rook clip is 1080p image-to-video, ping-ponged.

**Originality.** Every clip is an original generation. Nothing from thesapientdirective.com, and nothing from `ref.mp4` (which carries a Helsing logo), is used.

**Review.** Every clip was reviewed frame by frame (`media-src/qa/*_contact.png`). Rejected takes:
- `robotics_v1`: gripper morphed into a multi-finger claw.
- `rook_v1`: off-palette green tint.
- `ai_v1`: solid teal HUD rectangle, flagged by Opus.
- `cyber_v1`: spark-burst flash every loop, flagged by Opus.

| Slot | Files in `public/media/` | Shows | Used on |
|---|---|---|---|
| rook-hero | `rook-hero.{webm,mp4}` 1920×1080, 16 s ping-pong (2.8 / 3.2 MB) + `rook-hero-poster.{avif,jpg}` | Photoreal crystal-glass rook on an obsidian slab, blue/cyan light ribbons flowing up inside, amber core, slow push-in | Home, "The engine" strip |
| rook | `rook.{webm,mp4}` 1280×720, 6 s seamless (0.7 / 0.57 MB) + poster | Same emblem scene, slow orbit, light currents, amber pulse | Model page side card, Models index card |
| ai | `ai.{webm,mp4}` 960×540, 8 s seamless (0.26 / 0.36 MB) + poster | Darkened navy night-satellite coastline and harbor town, cyan radar arc sweep, corner-bracket tracking marks, magenta contact, fine grid, drone push-in | Featured: "Strategic briefings" (AI advancement) |
| robotics | `robotics.{webm,mp4}` 960×540, 6 s seamless (0.14 / 0.15 MB) + poster | Unbranded graphite 6-axis robot arm hovering over a machined part, cyan structured-light scan lines, amber wrist LED, dark lab bokeh | Featured: "Robotics" |
| cyber | `cyber.{webm,mp4}` 960×540, 6 s seamless (0.27 / 0.29 MB) + poster | Macro of fiber-optic bundles streaming cyan pulses into a rack port guarded by a glowing hexagonal lattice holding a red pulse | Featured: "AI security" (Cybersecurity) |
| everyday | `everyday.{webm,mp4}` 960×540, 7 s seamless (0.13 / 0.17 MB) + poster | Desk at blue hour: amber lamp, blank notebook and pen, steaming mug, defocused laptop glow, city bokeh through the window | Featured: "Everyday work" |
| chips | `chip-{ai,robotics,cyber,rook}.jpg` 160×160 | Photographic crops (satellite, arm, fiber, glass-rook glyph) | Hero headline chip cluster (home + pricing) |

**Playback (`components/LoopVideo.tsx`).**
- The poster `<picture>` (AVIF, falling back to JPG) always renders.
- The `<video muted loop playsinline autoplay>` with WebM first and MP4 second mounts only near the viewport (IntersectionObserver, 200 px margin). It plays while visible, pauses offscreen, and fades in once playing.
- `prefers-reduced-motion` or Save-Data shows the poster only (the video is never mounted; CSS also hides it).
- It works in both themes: the dark stage has a light-theme hairline and a dark-theme cool ring.

**Serving.**
- Workers Static Assets ignores HTTP Range, and Safari/iOS needs 206 responses to play video. `custom-worker.js` therefore serves `/media/*` worker-first (`run_worker_first`) with Range/206 support and `X-Robots-Tag: noindex`.
- Largest file is 3.2 MB, far below the 25 MiB per-asset limit. Total media is about 9.2 MB.

**Reproduce.**
- Loops: `media-src/loop/` built from `media-src/raw/` (masters are gitignored and kept on the box).
- Web encodes: `media-src/encode.sh`.
- Crossfade loop helper: `media-src/loopify.sh` (not used for the final clips).
