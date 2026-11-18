NOTES
- **Page and text:** Page `--bg` is #0b0b0b, a neutral near-black with no navy tint.
  - `--fg` #ededed on bg ≈ 17:1.
  - `--fg-2` #a8a8a8 ≈ 8.3:1.
  - `--fg-3` #8f8f8f ≈ 6.1:1 on bg, 5.3:1 on `--surface`, 4.7:1 on `--surface-2`, so AA holds everywhere it sits.
  - `--fg-4` #5a5a5a is only used for disabled text.
- **Surfaces:** `--surface` #1c1c1c, `--surface-2` #242424, `--surface-3` #141414. Menus, dialogs, `.jump-latest` and toasts use an elevated #151515 with a `--line-2` edge. The step between bg and surface (≈1.15:1) mirrors the light white-to-#f2f2f2 step.
- **Hairlines:** `--line` #1f1f1f, `--line-2` #2a2a2a, `--line-3` #3a3a3a. These are soft, like the light #eee/#e4e4e4/#d4d4d4 set.
- **Ink inverts:** `--ink` becomes #ececec and `--on-ink` #0b0b0b (≈16.8:1).
  - Primary pills, send/stop, avatars, the "New" badge, usage dots, meter fill and the checked menu dot all turn light-on-dark automatically.
  - Primary hover is `--ink-3` #cfcfcf.
- **Pro card:** inverts to a light card (#ececec) on the near-black page, the strongest standout and a mirror of the reference.
  - Muted text is `--on-ink-2` #5c5c5c (≈5.7:1) and row lines are `--ink-line` #d4d4d4.
  - Usage dots are #c4c4c4 off / #141414 on.
  - The "Get Pro" (`.btn-inverse`) button becomes a dark pill (#141414 / #ededed).
  - The plan note keeps the light amber treatment.
- **Mock badge (amber):** #f5c46b on #2a1f08 with a #6a4e17 border ≈ 10:1. The dot is #f0a83a.
- **OK and danger:**
  - OK: #4ade80 on #0f2417 ≈ 9.4:1.
  - Danger text: #ff6b55 ≈ 6.6:1 on bg and 6.3:1 on #2a1210.
  - The solid danger button switches to #c8371f with white text ≈ 5.2:1.
- **Shadows and scrims:** shadows deepen to black at 0.4–0.6 alpha, and pop-overs add a 1px white 4% ring so edges read. Scrims and backdrops go to black at 0.55–0.6.
- **Art and code:**
  - Art cards keep their #05070b art and gain an inset white 7% ring so they don't melt into the page.
  - Code blocks lift slightly: #111418 body, #171b22 header, #232a33 border. The original console token colours all stay ≥7:1.
- **Other details:**
  - Skeleton shimmer drops to white 5%.
  - The footer wordmark is #1a1a1a (≈1.2:1, the same quietness as #ebebeb on white).
  - Focus rings stay `var(--fg)`, which is now light, ≈17:1.
  - Selection is white 18%.
- **Theme transition:** a 200ms colour-only transition runs only while `html.theme-anim` is present. It is hard-disabled under reduced motion with a higher-specificity rule.
- **Toggle icon:** the sun/moon is chosen by CSS from `:root[data-theme]`, so it is correct before hydration. Server and client markup are identical, which covers the "neutral icon" requirement without a flash. The aria label and pressed state are set only after mount.

=== FILE: app/round4-dark.css ===
```css
/* Round 4 — dark theme. Unlayered on purpose: beats @layer base/components/utilities. */

/* ---------- 1. Tokens ---------- */
:root[data-theme="light"] { color-scheme: light; }

:root[data-theme="dark"] {
  color-scheme: dark;

  --bg: #0b0b0b;
  --fg: #ededed;
  --fg-2: #a8a8a8;
  --fg-3: #8f8f8f;
  --fg-4: #5a5a5a;
  --line: #1f1f1f;
  --line-2: #2a2a2a;
  --line-3: #3a3a3a;
  --surface: #1c1c1c;
  --surface-2: #242424;
  --surface-3: #141414;
  --elev: #151515;

  --ink: #ececec;
  --ink-2: #dedede;
  --ink-3: #cfcfcf;
  --ink-line: #d4d4d4;
  --on-ink: #0b0b0b;
  --on-ink-2: #5c5c5c;

  --live: #22c55e;
  --ok-fg: #4ade80;
  --ok-bg: #0f2417;
  --amber-fg: #f5c46b;
  --amber-bg: #2a1f08;
  --amber-line: #6a4e17;
  --amber-solid: #f0a83a;
  --danger: #ff6b55;
  --danger-fg: #ffb4a6;
  --danger-bg: #2a1210;
  --danger-line: #5c2a22;

  --shadow-chip: 0 1px 2px rgba(0, 0, 0, 0.5), 0 6px 16px rgba(0, 0, 0, 0.45);
  --shadow-pop: 0 16px 48px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04);
  --shadow-soft: 0 2px 12px rgba(0, 0, 0, 0.4);
}

/* ---------- 2. Base ---------- */
:root[data-theme="dark"] ::selection { background: rgba(255, 255, 255, 0.18); }

/* ---------- 3. Nav + sheet ---------- */
:root[data-theme="dark"] .nav { background: rgba(11, 11, 11, 0.86); }
:root[data-theme="dark"] .sheet-backdrop { background: rgba(0, 0, 0, 0.55); }
:root[data-theme="dark"] .nav-avatar,
:root[data-theme="dark"] .avatar-lg { color: var(--on-ink); }

/* ---------- 4. Buttons + badges ---------- */
:root[data-theme="dark"] .btn-inverse { background: #141414; color: #ededed; }
:root[data-theme="dark"] .btn-inverse:hover:not(:disabled) { background: #262626; }
:root[data-theme="dark"] .btn-danger { background: #c8371f; color: #fff; }
:root[data-theme="dark"] .btn-danger:hover:not(:disabled) { background: #b02e18; }
:root[data-theme="dark"] .badge-new { color: var(--on-ink); }
:root[data-theme="dark"] .badge-dark { background: #2e2e2e; color: #ededed; }
:root[data-theme="dark"] .badge-soon { background: transparent; }
:root[data-theme="dark"] .badge-mock { border-color: var(--amber-line); }
:root[data-theme="dark"] .live-dot { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25); }

/* ---------- 5. Hero chip tiles + emblems ---------- */
:root[data-theme="dark"] .chip-tile { background: #161616; border-color: var(--line-2); }
:root[data-theme="dark"] .model-cta-mark,
:root[data-theme="dark"] .state-emblem,
:root[data-theme="dark"] .auth-emblem { background: #161616; border-color: var(--line-2); }

/* ---------- 6. Media / art ---------- */
:root[data-theme="dark"] .media::after,
:root[data-theme="dark"] .model-art::after {
  content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  border-radius: inherit; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
}
:root[data-theme="dark"] .media-tag { background: rgba(10, 10, 10, 0.62); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
:root[data-theme="dark"] a.tile:hover,
:root[data-theme="dark"] .project-card:hover,
:root[data-theme="dark"] .project-card:focus-within { box-shadow: none; }

/* ---------- 7. Pricing: Pro inverts to a light card ---------- */
:root[data-theme="dark"] .plan-card.is-highlight .text-2,
:root[data-theme="dark"] .plan-card.is-highlight .text-3,
:root[data-theme="dark"] .plan-card.is-highlight .tiny { color: var(--on-ink-2); }
:root[data-theme="dark"] .plan-card.is-highlight .usage-dots i { background: #c4c4c4; }
:root[data-theme="dark"] .plan-card.is-highlight .usage-dots i.on { background: #141414; }
:root[data-theme="dark"] .plan-card.is-highlight .plan-note { background: #fff4dc; color: #8a5300; border-color: #f2d08a; }
:root[data-theme="dark"] .plan-card.is-highlight .pill,
:root[data-theme="dark"] .plan-card.is-highlight .plan-mult,
:root[data-theme="dark"] .plan-card.is-highlight .badge-dark { background: #d9d9d9; color: #141414; }
:root[data-theme="dark"] .plan-card.is-highlight .btn-secondary { background: #d9d9d9; color: #141414; }
:root[data-theme="dark"] .plan-card.is-highlight .btn-secondary:hover:not(:disabled) { background: #cdcdcd; }
:root[data-theme="dark"] .plan-card.is-highlight :focus-visible { outline-color: #0b0b0b; }
:root[data-theme="dark"] .plan-mini.is-highlight :focus-visible { outline-color: #0b0b0b; }

/* ---------- 8. Footer ---------- */
:root[data-theme="dark"] .footer-giant { color: #1a1a1a; }

/* ---------- 9. Composer ---------- */
:root[data-theme="dark"] .composer-dock { background: linear-gradient(to bottom, rgba(11, 11, 11, 0), #0b0b0b 28px); }
:root[data-theme="dark"] .composer:focus-within { background: #1f1f1f; box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04); }
:root[data-theme="dark"] .engine-pill { background: #262626; }
:root[data-theme="dark"] .engine-pill-mark { background: #383838; color: var(--fg); }
:root[data-theme="dark"] .send-btn,
:root[data-theme="dark"] .stop-btn { color: var(--on-ink); }
:root[data-theme="dark"] .send-btn:disabled { background: #262626; color: var(--fg-3); }
:root[data-theme="dark"] .composer .project-chip.is-set,
:root[data-theme="dark"] .composer button.project-chip:hover { background: #2a2a2a; }

/* ---------- 10. Elevated surfaces: menus, dialogs, jump pill ---------- */
:root[data-theme="dark"] .menu { background: var(--elev); border-color: var(--line-2); }
:root[data-theme="dark"] .menu-item:hover,
:root[data-theme="dark"] .menu-item:focus-visible { background: var(--surface-2); }
:root[data-theme="dark"] .dialog { background: var(--elev); box-shadow: var(--shadow-pop); }
:root[data-theme="dark"] .dialog-backdrop { background: rgba(0, 0, 0, 0.6); }
:root[data-theme="dark"] .jump-latest { background: var(--elev); }
:root[data-theme="dark"] .jump-latest:hover { background: var(--surface-2); }
:root[data-theme="dark"] .limit-card { background: var(--elev); }
:root[data-theme="dark"] .chat-shell[data-sidebar="open"] .chat-scrim { background: rgba(0, 0, 0, 0.55); }
@media (max-width: 900px) {
  :root[data-theme="dark"] .chat-sidebar { background: var(--elev); }
}

/* ---------- 11. Forms ---------- */
:root[data-theme="dark"] .input:focus,
:root[data-theme="dark"] .textarea:focus,
:root[data-theme="dark"] .select:focus { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1); }
:root[data-theme="dark"] .side-search input:focus { background: var(--surface-3); }

/* ---------- 12. Toasts ---------- */
:root[data-theme="dark"] .toast { background: #1f1f1f; color: #ededed; box-shadow: var(--shadow-pop); border: 1px solid #2e2e2e; }
:root[data-theme="dark"] .toast-close { color: #9a9a9a; }
:root[data-theme="dark"] .toast-close:hover { background: #2e2e2e; color: #fff; }

/* ---------- 13. Skeletons ---------- */
:root[data-theme="dark"] .skeleton::after { background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent); }

/* ---------- 14. Banners / notices ---------- */
:root[data-theme="dark"] .banner-offline { background: #1c1c1c; border-color: var(--line-2); color: var(--fg-2); }
:root[data-theme="dark"] .banner-offline strong { color: var(--fg); }
:root[data-theme="dark"] .banner-offline .btn-secondary { background: #2e2e2e; color: var(--fg); }
:root[data-theme="dark"] .notice-ok { border-color: #1f4a2e; }

/* ---------- 15. Markdown ---------- */
:root[data-theme="dark"] .md :not(pre) > code { background: var(--surface); border-color: var(--line-2); }
:root[data-theme="dark"] .md th { background: var(--surface-3); }

/* ---------- 16. Code blocks ---------- */
:root[data-theme="dark"] .code-block { background: #111418; border-color: #232a33; }
:root[data-theme="dark"] .code-head { background: #171b22; border-bottom-color: #232a33; }
:root[data-theme="dark"] .code-copy:hover { background: #262e3a; }

/* ---------- 17. Auth ---------- */
:root[data-theme="dark"] .auth-page { background: radial-gradient(1200px 500px at 50% -10%, #171717, #0b0b0b 70%); }
:root[data-theme="dark"] .auth-card { background: var(--elev); }
:root[data-theme="dark"] .demo-box { background: #1a1408; }

/* ---------- 18. Theme toggle (nav) ---------- */
.theme-toggle {
  position: relative; display: inline-grid; place-items: center; flex: none;
  width: 32px; height: 32px; padding: 0; border: 0; border-radius: 999px;
  background: transparent; color: var(--fg);
  transition: background-color var(--dur-1), color var(--dur-1);
}
.theme-toggle:hover { background: var(--surface); }
.theme-toggle:active { transform: scale(0.94); }
.theme-toggle svg {
  grid-area: 1 / 1;
  transition: opacity 200ms var(--ease), transform 320ms var(--ease);
}
.theme-toggle .theme-icon-moon { opacity: 1; transform: none; }
.theme-toggle .theme-icon-sun { opacity: 0; transform: rotate(-60deg) scale(0.6); }
:root[data-theme="dark"] .theme-toggle .theme-icon-moon { opacity: 0; transform: rotate(45deg) scale(0.6); }
:root[data-theme="dark"] .theme-toggle .theme-icon-sun { opacity: 1; transform: none; }

/* ---------- 19. Theme segment (Account + phone sheet) ---------- */
.theme-segment {
  display: inline-flex; align-items: center; gap: 2px; padding: 3px;
  border-radius: 999px; border: 1px solid var(--line-2); background: transparent;
}
.theme-segment-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
  border: 0; border-radius: 999px; background: transparent;
  font-size: var(--t-13); font-weight: 450; color: var(--fg-2); white-space: nowrap;
  transition: background-color var(--dur-1), color var(--dur-1);
}
.theme-segment-btn:hover { color: var(--fg); }
.theme-segment-btn[aria-checked="true"] { background: var(--surface-2); color: var(--fg); }
.theme-segment-btn:focus-visible { outline: 2px solid var(--fg); outline-offset: 1px; border-radius: 999px; }
.theme-segment-btn svg { flex: none; }
.theme-segment-sm .theme-segment-btn { height: 28px; padding: 0 10px; font-size: 12.5px; gap: 5px; }

.sheet-theme {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 50px; padding: 0 4px 0 12px; margin-top: 4px;
  font-size: var(--t-lg); color: var(--fg);
}
@media (max-width: 380px) {
  .sheet-theme .theme-segment-btn span { display: none; }
  .sheet-theme .theme-segment-btn { padding: 0 10px; }
}

/* ---------- 20. Theme switch transition (only while html.theme-anim) ---------- */
html.theme-anim,
html.theme-anim *,
html.theme-anim *::before,
html.theme-anim *::after {
  transition-property: background-color, border-color, color, fill, stroke, box-shadow, outline-color, text-decoration-color !important;
  transition-duration: 200ms !important;
  transition-timing-function: ease !important;
  transition-delay: 0s !important;
}
@media (prefers-reduced-motion: reduce) {
  html.theme-anim,
  html.theme-anim *,
  html.theme-anim *::before,
  html.theme-anim *::after { transition: none !important; }
  .theme-toggle svg { transition: none !important; }
}
```
=== END FILE ===

=== FILE: components/ThemeToggle.tsx ===
```tsx
"use client";

import * as React from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const STORAGE_KEY = "citad3l-theme";
const EVENT_NAME = "citad3l-theme";
const THEME_COLOR: Record<Theme, string> = { light: "#ffffff", dark: "#0b0b0b" };
const ANIM_MS = 300;

interface ThemeEventDetail {
  preference: ThemePreference;
  theme: Theme;
}

/* ---------------- shared logic ---------------- */

function darkQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function systemTheme(): Theme {
  return darkQuery()?.matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage blocked */
  }
  return "system";
}

function readTheme(): Theme {
  const v = document.documentElement.dataset.theme;
  if (v === "light" || v === "dark") return v;
  return systemTheme();
}

function resolve(preference: ThemePreference): Theme {
  return preference === "system" ? systemTheme() : preference;
}

function setMetaThemeColor(theme: Theme) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = THEME_COLOR[theme];
    document.head.appendChild(m);
    return;
  }
  metas.forEach((m) => {
    m.removeAttribute("media");
    m.content = THEME_COLOR[theme];
  });
}

let animTimer: ReturnType<typeof setTimeout> | undefined;

function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  const changed = root.dataset.theme !== theme;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (changed && animate && !reduce) {
    root.classList.add("theme-anim");
    if (animTimer) clearTimeout(animTimer);
    animTimer = setTimeout(() => {
      root.classList.remove("theme-anim");
      animTimer = undefined;
    }, ANIM_MS);
  }
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  setMetaThemeColor(theme);
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage blocked — still apply for this session */
  }
  const theme = resolve(preference);
  applyTheme(theme, true);
  window.dispatchEvent(
    new CustomEvent<ThemeEventDetail>(EVENT_NAME, { detail: { preference, theme } }),
  );
}

interface ThemeState {
  mounted: boolean;
  preference: ThemePreference;
  theme: Theme;
}

function useThemeState(): ThemeState {
  const [state, setState] = React.useState<ThemeState>({
    mounted: false,
    preference: "system",
    theme: "light",
  });

  React.useEffect(() => {
    const sync = () =>
      setState({ mounted: true, preference: readPreference(), theme: readTheme() });
    sync();

    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<ThemeEventDetail>).detail;
      if (d) setState({ mounted: true, preference: d.preference, theme: d.theme });
      else sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      applyTheme(resolve(readPreference()), true);
      sync();
    };
    const media = darkQuery();
    const onMedia = () => {
      if (readPreference() !== "system") return;
      applyTheme(systemTheme(), true);
      sync();
    };

    window.addEventListener(EVENT_NAME, onCustom);
    window.addEventListener("storage", onStorage);
    if (media) {
      if (typeof media.addEventListener === "function") media.addEventListener("change", onMedia);
      else media.addListener(onMedia);
    }
    return () => {
      window.removeEventListener(EVENT_NAME, onCustom);
      window.removeEventListener("storage", onStorage);
      if (media) {
        if (typeof media.removeEventListener === "function") media.removeEventListener("change", onMedia);
        else media.removeListener(onMedia);
      }
    };
  }, []);

  return state;
}

/* ---------------- icons ---------------- */

function SunIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}
function MoonIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.2A8 8 0 1 1 9.8 4a6.5 6.5 0 0 0 10.2 10.2Z" />
    </svg>
  );
}
function MonitorIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  );
}

/* ---------------- ThemeToggle (nav) ---------------- */

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mounted, theme } = useThemeState();
  const isDark = theme === "dark";
  const label = mounted
    ? isDark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle theme";

  return (
    <button
      type="button"
      className={["theme-toggle", className].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={mounted ? isDark : undefined}
      title={label}
      onClick={() => setThemePreference(readTheme() === "dark" ? "light" : "dark")}
    >
      {/* Both icons always render; CSS picks one from :root[data-theme] — correct before hydration, no mismatch. */}
      <MoonIcon className="theme-icon-moon" />
      <SunIcon className="theme-icon-sun" />
    </button>
  );
}

/* ---------------- ThemeSegment (Account page / phone sheet) ---------------- */

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon size={14} /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
  { value: "system", label: "System", icon: <MonitorIcon size={14} /> },
];

export interface ThemeSegmentProps {
  className?: string;
  size?: "sm" | "md";
  labelledBy?: string;
  label?: string;
}

export function ThemeSegment({ className, size = "md", labelledBy, label = "Theme" }: ThemeSegmentProps) {
  const { mounted, preference } = useThemeState();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const found = OPTIONS.findIndex((o) => o.value === preference);
  const activeIndex = mounted && found >= 0 ? found : 0;

  const choose = (i: number, moveFocus: boolean) => {
    const opt = OPTIONS[i];
    if (moveFocus) refs.current[i]?.focus();
    if (opt.value !== readPreference()) setThemePreference(opt.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = OPTIONS.length;
    let next = -1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (i + 1) % n;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (i - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        choose(i, false);
        return;
      default:
        return;
    }
    e.preventDefault();
    choose(next, true);
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={["theme-segment", size === "sm" ? "theme-segment-sm" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {OPTIONS.map((o, i) => {
        const checked = mounted && o.value === preference;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === activeIndex ? 0 : -1}
            className="theme-segment-btn"
            onClick={() => choose(i, false)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
```
=== END FILE ===

=== PATCH: components/TopNav.tsx ===
<<<FIND
import { Rook } from "@/components/Rook";
>>>REPLACE
import { Rook } from "@/components/Rook";
import { ThemeToggle, ThemeSegment } from "@/components/ThemeToggle";
<<<END
<<<FIND
        <div className="nav-right">
>>>REPLACE
        <div className="nav-right">
          <ThemeToggle />
<<<END
<<<FIND
            {!signedIn && (
>>>REPLACE
            <div className="sheet-theme">
              <span id="sheet-theme-label">Theme</span>
              <ThemeSegment size="sm" labelledBy="sheet-theme-label" />
            </div>
            {!signedIn && (
<<<END
=== END PATCH ===

THEME_COLOR_DARK: #0b0b0b