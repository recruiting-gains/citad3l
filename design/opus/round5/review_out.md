## 1. Clip verdicts

| Clip | Verdict | Reason |
|---|---|---|
| **rook (6 s)** | **PASS** | Stable silhouette, swirl motion only, no morphing in the crenellations, base glow consistent. First and last frames match, so the loop seam is clean. |
| **rook strip (16 s, ping-pong)** | **PASS** | Same scene. Ping-pong suits it because the motion is symmetric. Confirm there is no visible "stall" at the turnaround. If there is, ease the playbackRate near the ends or trim 2 frames. |
| **ai (8 s)** | **REJECT** | Frame 5 has a solid teal rectangle (a HUD box artifact), and the corner brackets pop in and out between frames, which breaks the "no UI text/overlays" rule. **Fix:** regenerate with "no interface elements, no boxes" in the prompt. **Fallback:** trim to frames 6–8 plus 1–4 with a crossfade. |
| **robotics (6 s)** | **PASS** | Arm pose drifts slightly but reads as a deliberate motion. Cyan stripes animate cleanly and the seam matches. |
| **cyber (6 s)** | **REJECT** | Frame 6 is a spark burst. It is a one-off event, so it flashes every loop and violates the "no sudden events" rule. **Fix:** regenerate, or cut that segment and crossfade frames 5 → 7. Everything else (hex grid, red core, fiber flow) is on-bible. |
| **everyday (7 s)** | **PASS** | Steam and city bokeh are the only motion. Warm/cool split matches the bible. The laptop screen stays abstract with no legible text. |

## 2. CSS refinements

```css
/* 1. Consistent bottom scrim so tags/titles read over bright frames */
.loop-media::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 28%,transparent 70%,rgba(0,0,0,.25) 100%);}

/* 2. Tag legibility: it ghosts under the translucent header on phone (shot3) */
.media-tag{background:rgba(8,12,18,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.08);z-index:1;}
.media-dot{box-shadow:0 0 6px currentColor;}

/* 3. Subtle hover push-in, motion-safe only */
@media (prefers-reduced-motion:no-preference){
  .loop-media img,.loop-media video{transition:transform .8s cubic-bezier(.2,.7,.2,1);}
  .media:hover .loop-media img,.media:hover .loop-media video{transform:scale(1.035);}
}

/* 4. Hero chips: tighter crop, inner rim, calmer rook bloom */
.chip-tile.chip-photo{box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 4px 14px rgba(0,0,0,.18);
  background-size:180%;filter:saturate(1.05) contrast(1.05);}

/* 5. Engine strip/model art: seat the dark scene on light theme (shot3) */
.model-strip-art,.model-art{background:#05070b;box-shadow:inset 0 -40px 60px -30px rgba(0,0,0,.6);}

/* 6. Dark theme: lift card edges off the near-black page */
:root[data-theme="dark"] .media{box-shadow:0 0 0 1px rgba(120,170,255,.08);}
```

## 3. object-position changes

| Slot | Value | Reason |
|---|---|---|
| ai card | `50% 40%` | Keeps the arc in frame, not just landmass (shot2 top crop). |
| robotics card | `55% 30%` | The gripper is cut at the top in shot2. Bias upward. |
| cyber card | `70% 45%` | Keeps the hex grid and red core in view. It currently hugs the right edge. |
| everyday card | `45% 55%` | Keeps the lamp, mug and notebook together. |
| rook (model-art / strip) | `50% 45%` | Desktop strip is fine. On phone, use `50% 40%` so the crenellations keep headroom. |
| hero chips | satellite `40% 50%`, arm `55% 25%`, fiber `70% 45%`, rook `50% 40%` | Centers the main subject in each small crop. |