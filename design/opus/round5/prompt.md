You are the art director for Citad3L, a strategic AI assistant site (one open-weights engine, "Citad3L V1"). The brand emblem is a rook (chess castle) rendered as photoreal luminous glass with blue/cyan/amber flowing light inside. Site UI: Ghost-like near-1:1 layout, white light theme and #0b0b0b dark theme, 16px-radius media cards, a small dark translucent status pill over the top-left of each card, captions BELOW cards.

Images attached:
- sap_contact.png: frames from the reference site's card videos (Sapient/Ghost). We want "that type" of video: realistic, cinematic, one subject per clip, slow push-ins/orbits, occasional fast motion-blur zooms, shallow DOF, film grain, crushed blacks. NOT copies of them.
- ref_contact.png: the owner's realism reference: a defense-intel dashboard look. Real darkened satellite/drone photo textures with a blue tint, glowing cyan/magenta/red tracking boxes, radar sweeps, connector lines, micro coordinates/grids, cinematic zooms with motion blur. (It contains a third-party "H" logo; never reproduce any logo.)
- before_home.jpg / before_model.jpg: our current site with flat neon SVG line art that must be replaced.

Slots to fill (all 16:9 sources, cover-cropped to ~16:10 cards; card loops 5–8 s, muted, autoplay):
1. `rook`: the engine/model media (home "The engine" strip ~700×330, model page side card ~400×225, models index card). The hero emblem: a photoreal luminous glass rook.
2. `ai`: card "Strategic briefings", tag "AI advancement".
3. `robotics`: card "Robotics" (kinematics, control loops, sensor fusion, embodied AI).
4. `cyber`: card "AI security", tag "Cybersecurity" (threat-modelling agents, prompt injection, hardening).
5. `everyday`: card "Everyday work" (writing, code review, study, research). Keep it cinematic and realistic, consistent with the set.
6. (optional) `hero`: is a hero background or inline media warranted? The reference keeps the hero clean with a small inline glyph. Advise.

Production tool constraints: the generator is Grok Imagine. It produces an image (for a still or first frame, via a text prompt, optionally with reference images) and then a video via image-to-video. It can take the same image as first AND last frame for a near-seamless loop. Durations 5–8 s; 720p for cards (1080p possible only without last_frame). It CANNOT reliably render text, so prompts must explicitly forbid text, letters, numbers, logos, watermarks and UI labels. HUD overlays should be abstract (boxes, ticks, arcs, dots, grids) with no legible characters.

Deliver, concisely:
A. A one-paragraph unified grade/look bible (palette hex values, contrast, grain, lens, light), which must work on both a white page and a near-black page.
B. For each slot: (i) concept in one line; (ii) a FIRST-FRAME IMAGE prompt (60–110 words, photoreal, 16:9, explicit "no text, no letters, no numbers, no logos, no watermark"); (iii) a VIDEO MOTION prompt for image-to-video (35–70 words: camera move, subject motion, light motion, ending so it can loop back to the first frame); (iv) loop strategy (first=last frame, or ping-pong, or crossfade) and duration; (v) poster frame choice; (vi) the status-pill text for the card (2–3 words, e.g. "● Live brief"); (vii) alt text (≤120 chars).
C. A QA checklist for reviewing frames (artifacts to reject).
D. Encoding/framing guidance (object-position per slot for phone crops, overlay gradient if any).
Output as Markdown with headings exactly `## A`, `## B`, `### rook`, `### ai`, `### robotics`, `### cyber`, `### everyday`, `### hero`, `## C`, `## D`, and inside each slot use labelled lines `IMAGE:` `MOTION:` `LOOP:` `POSTER:` `PILL:` `ALT:` `POSITION:`.
