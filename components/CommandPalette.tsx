"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { visibleModels } from "@/lib/models";

type Item = { id: string; group: "Chats" | "Models" | "Pages"; label: string; sub?: string; href: string; hint: string };

const PAGES: Item[] = [
  { id: "p-chat", group: "Pages", label: "Chat", href: "/chat", hint: "Go" },
  { id: "p-models", group: "Pages", label: "Models", href: "/models", hint: "Go" },
  { id: "p-pricing", group: "Pages", label: "Pricing", href: "/pricing", hint: "Go" },
  { id: "p-faq", group: "Pages", label: "FAQ", href: "/faq", hint: "Go" },
  { id: "p-projects", group: "Pages", label: "Projects", href: "/projects", hint: "Go" },
  { id: "p-account", group: "Pages", label: "Account", href: "/account", hint: "Go" },
  { id: "p-usage", group: "Pages", label: "Usage", href: "/account/usage", hint: "Go" },
  { id: "p-billing", group: "Pages", label: "Billing", href: "/account/billing", hint: "Go" },
  { id: "p-sessions", group: "Pages", label: "Sessions", href: "/account/sessions", hint: "Go" },
  { id: "p-referrals", group: "Pages", label: "Referrals", href: "/account/referrals", hint: "Go" },
  { id: "p-connect", group: "Pages", label: "Connect", href: "/connect", hint: "Go" },
];

export interface CommandPaletteProps {
  signedIn?: boolean;
  isOwner?: boolean;
}

export function CommandPalette({ signedIn, isOwner }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    if (!signedIn) return;
    void fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.conversations) setChats(j.conversations.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title || "Untitled" })));
      })
      .catch(() => {});
  }, [open, signedIn]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const models: Item[] = visibleModels().map((m) => ({
      id: `m-${m.id}`,
      group: "Models",
      label: m.name,
      sub: m.role,
      href: `/models/${m.id}`,
      hint: "Open",
    }));
    const chatItems: Item[] = chats.slice(0, 20).map((c) => ({
      id: `c-${c.id}`,
      group: "Chats",
      label: c.title,
      href: `/chat/${c.id}`,
      hint: "Open",
    }));
    const pages = [
      ...PAGES,
      ...(isOwner ? [{ id: "p-admin", group: "Pages" as const, label: "Admin", href: "/admin", hint: "Go" }] : []),
    ];
    const all = [...chatItems, ...models, ...pages];
    const filtered = needle
      ? all.filter((i) => i.label.toLowerCase().includes(needle) || (i.sub ?? "").toLowerCase().includes(needle) || i.group.toLowerCase().includes(needle))
      : all;
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const g of ["Chats", "Models", "Pages"] as const) {
      let n = 0;
      for (const i of filtered) {
        if (i.group !== g || seen.has(i.id)) continue;
        if (!needle && n >= 5) continue;
        seen.add(i.id);
        out.push(i);
        n++;
      }
    }
    return out;
  }, [q, chats, isOwner]);

  useEffect(() => { setActive(0); }, [q, items.length]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;

  const groups = ["Chats", "Models", "Pages"] as const;

  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search" data-testid="command-palette">
        <div className="cmdk-input-row">
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Jump to a chat, model, or page…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); if (items[active]) go(items[active]); }
            }}
          />
        </div>
        <div className="cmdk-list">
          {items.length === 0 ? (
            <div className="cmdk-empty">No matches. Try a shorter phrase.</div>
          ) : (
            groups.map((g) => {
              const rows = items.filter((i) => i.group === g);
              if (!rows.length) return null;
              return (
                <div key={g} className="cmdk-group">
                  <div className="cmdk-group-label">{g}</div>
                  {rows.map((i) => {
                    const idx = items.indexOf(i);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        className="cmdk-item"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(i)}
                      >
                        <span className="cmdk-item-text">
                          {i.label}
                          {i.sub ? <span className="cmdk-item-sub">{i.sub}</span> : null}
                        </span>
                        <span className="cmdk-item-hint">{i.hint}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk-foot">
          <span><span className="cmdk-kbd">↑↓</span> move</span>
          <span><span className="cmdk-kbd">↵</span> select</span>
          <span><span className="cmdk-kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
