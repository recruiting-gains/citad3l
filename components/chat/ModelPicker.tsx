"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Rook } from "@/components/Rook";
import { modelTier, planIncludesModel, type PublicModel } from "@/lib/models";
import { availableSkills } from "@/lib/skills";
import type { SkillRequest } from "@/lib/types";

export interface ModelPickerProps {
  models: PublicModel[];
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placement?: "up" | "down";
  skills?: SkillRequest;
  onSkillsChange?: (s: SkillRequest) => void;
  guest?: boolean;
  /** Signed-in customer plan ("trial" | "pro" | "max"). Rows outside it get a "Pro"/"Max" tag (server still enforces). Null for admins and guests. */
  plan?: string | null;
  swarm?: boolean;
  canOpenSettings?: boolean;
  onOpenSettings?: () => void;
}

const SPEED: Record<string, string> = { Fast: "Quick", Standard: "Steady", Slow: "Deliberate" };
const BLURB: Record<string, string> = {
  "citad3l-v1": "Our flagship. Built for deep reasoning and long work.",
  "citad3l-fast": "Quick answers for everyday questions.",
  "citad3l-private": "Encrypted chat in a verified secure enclave. Text only.",
  "citad3l-image": "Turns a description into an image.",
  "citad3l-video": "Turns a description into a short clip.",
};

function Dots({ n }: { n: number }) {
  const v = Math.max(0, Math.min(5, n || 0));
  return (
    <span className="usage-dots" aria-label={`${v} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < v ? "on" : ""} />)}
    </span>
  );
}

export function ModelPicker({
  models, selectedId, onChange, disabled, placement = "up",
  skills, onSkillsChange, guest, plan, swarm, canOpenSettings, onOpenSettings,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const selected = models.find((m) => m.id === selectedId) ?? models[0];

  const locked = (id: string) => !!plan && !planIncludesModel(plan, id);
  const ordered = useMemo(
    () => (plan ? [...models.filter((m) => planIncludesModel(plan, m.id)), ...models.filter((m) => !planIncludesModel(plan, m.id))] : models),
    [models, plan],
  );
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return ordered;
    return ordered.filter((m) =>
      m.name.toLowerCase().includes(n) ||
      (m.description ?? "").toLowerCase().includes(n) ||
      (m.role ?? "").toLowerCase().includes(n),
    );
  }, [ordered, q]);

  // The preview card follows the pointer, but the Skills toggles act on the SELECTED model only. (Bug 2026-11-19:
  // they used the hovered row, and the pointer crossing Private/Image/Video on its way down disabled Web search.)
  const preview = models.find((m) => m.id === (hovered ?? selectedId)) ?? selected;
  const avail = availableSkills(selected);
  const skillHint = !selected
    ? ""
    : selected.requiresClientE2EE || selected.comingSoon
      ? "Private runs without outside tools."
      : selected.modality === "agent"
        ? "Hermes uses its own memory and skills."
        : selected.modality !== "chat"
        ? "Skills aren't available for media models."
        : guest
          ? "Sign in to use Web search and Extended thinking."
          : swarm
          ? "In Swarm, Web search is off by default; you can turn it on. Extended thinking stays off."
          : !avail.thinking && (skills?.thinking || true)
          ? "Extended thinking runs on Citad3L V1 only."
          : "Skills apply to your next message.";

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = rootRef.current?.querySelector("button");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const width = Math.min(500, window.innerWidth - 16);
      const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
      const cssMax = Math.min(640, Math.floor(window.innerHeight * 0.82));
      const spaceBelow = window.innerHeight - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const preferDown = placement === "down";
      if (preferDown && spaceBelow >= cssMax) {
        setCoords({ top: r.bottom + 6, left, transform: "none", maxHeight: spaceBelow });
      } else if (!preferDown && spaceAbove >= cssMax) {
        setCoords({ top: r.top - 6, left, transform: "translateY(-100%)", maxHeight: spaceAbove });
      } else if (spaceBelow >= cssMax) {
        setCoords({ top: r.bottom + 6, left, transform: "none", maxHeight: spaceBelow });
      } else if (spaceAbove >= cssMax) {
        setCoords({ top: r.top - 6, left, transform: "translateY(-100%)", maxHeight: spaceAbove });
      } else {
        setCoords({ top: 8, left, transform: "none", maxHeight: window.innerHeight - 16 });
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement, selectedId, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHovered(selectedId);
    window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, selectedId]);

  if (!selected) return null;

  const toggle = (key: keyof SkillRequest) => {
    if (!onSkillsChange) return;
    onSkillsChange({ ...skills, [key]: !skills?.[key] });
  };

  const menu = open && coords && typeof document !== "undefined" ? createPortal(
    <div
      ref={menuRef}
      className="menu model-picker-menu model-picker-menu-portal model-picker-panel"
      role="dialog"
      aria-label="Choose a model"
      data-testid="model-picker-menu"
      style={{ top: coords.top, left: coords.left, transform: coords.transform, width: Math.min(500, typeof window !== "undefined" ? window.innerWidth - 16 : 500), maxHeight: coords.maxHeight }}
    >
      <div className="mp-search">
        <input ref={searchRef} type="search" placeholder="Find a model" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a model" />
      </div>
      <div className="mp-list-head"><span>Model</span><span>Cost</span></div>
      <div className="mp-list" role="menu" onMouseLeave={() => setHovered(null)}>
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            role="menuitemradio"
            aria-checked={m.id === selected.id}
            aria-selected={m.id === selected.id}
            className={`mp-row${m.id === selected.id ? " is-selected" : ""}`}
            onMouseEnter={() => setHovered(m.id)}
            onFocus={() => setHovered(m.id)}
            onClick={() => { onChange(m.id); setOpen(false); }}
          >
            <span className="mp-row-icon"><Rook size={12} /></span>
            <span>
              <span className="mp-row-name">
                {m.name}
                {m.comingSoon ? <span className="mp-tag">Soon</span> : locked(m.id) ? <span className="mp-tag" data-testid="mp-plan-tag">{modelTier(m.id) === "max" ? "Max" : "Pro"}</span> : null}
              </span>
              <span className="mp-row-meta">{m.speed ? (SPEED[m.speed] ?? m.speed) : m.role}</span>
            </span>
            <Dots n={m.usageDots ?? 3} />
          </button>
        ))}
        {filtered.length === 0 && <p className="mp-row-meta" style={{ padding: "8px 10px" }}>No models match that search.</p>}
      </div>
      {preview && (
        <div className="mp-preview">
          <div className="mp-preview-card">
            <div className="mp-preview-title">{preview.name}</div>
            <p className="mp-preview-desc">{BLURB[preview.id] ?? preview.summary ?? preview.description}</p>
            <dl className="mp-preview-facts">
              <div><dt>Context</dt><dd>{preview.context ?? "—"}</dd></div>
              <div><dt>Speed</dt><dd>{preview.speed ? (SPEED[preview.speed] ?? preview.speed) : "—"}</dd></div>
              <div><dt>Reads images</dt><dd>{preview.supportsVision ? "Yes" : "No"}</dd></div>
              <div><dt>Cost per message</dt><dd><Dots n={preview.usageDots ?? 3} /></dd></div>
            </dl>
          </div>
        </div>
      )}
      <div className="mp-skills">
        <div className="mp-skills-label">Skills</div>
        <div className="skill-toggles">
          {([
            ["webSearch", "Web search", avail.webSearch && !guest],
            ["thinking", "Extended thinking", avail.thinking && !guest && !swarm],
            ["coding", "Coding tools", avail.coding],
          ] as const).map(([key, label, on]) => (
            <button
              key={key}
              type="button"
              className={`skill-toggle${skills?.[key] && on ? " is-on" : ""}`}
              aria-pressed={!!(skills?.[key] && on)}
              disabled={!on || !onSkillsChange}
              onClick={() => toggle(key)}
              data-testid={`skill-${key}`}
              title={key === "webSearch" && swarm ? "Off by default in Swarm. Adds up to 4 search calls on top of the 4 Swarm replies." : key === "thinking" && swarm ? "Extended thinking stays off in Swarm." : undefined}
            >
              <span className="skill-toggle-switch" />
              {label}
            </button>
          ))}
        </div>
        <p className="skill-hint">{skillHint}</p>
      </div>
      <div className="mp-foot">
        {canOpenSettings && onOpenSettings ? (
          <button type="button" className="mp-settings-link" onClick={() => { onOpenSettings(); setOpen(false); }}>Model settings →</button>
        ) : (
          <span>Cost dots show how quickly a model spends your allowance.</span>
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="popover-anchor" ref={rootRef}>
      <button
        type="button"
        className="engine-pill engine-pill-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Model: ${selected.name}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        data-testid="model-picker-trigger"
      >
        <span className="engine-pill-mark"><Rook size={13} /></span>
        <span className="engine-pill-label">{selected.name}</span>
      </button>
      {menu}
    </div>
  );
}

export default ModelPicker;
