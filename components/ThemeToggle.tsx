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
