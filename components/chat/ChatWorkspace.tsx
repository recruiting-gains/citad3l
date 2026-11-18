"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ConversationListItem, Project, ProviderInfo, UsageSummary } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { MockBadge } from "@/components/MockBadge";
import { LimitReached } from "@/components/LimitReached";
import { Markdown } from "@/components/chat/Markdown";

const MAX_CHARS = 8000;
const NEAR_CHARS = 7000;

export interface ChatWorkspaceProps {
  initialConversationId?: string | null;
  initialProjectId?: string | null;
  userLabel: string;
  provider: ProviderInfo;
  initialUsage: UsageSummary;
}

/* ---------- local icons ---------- */
function Ic({ children, size = 16, sw = 1.5 }: { children: React.ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const ISearch = () => <Ic size={14}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></Ic>;
const IPanel = () => <Ic><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M6 3v10M3.8 6h.6M3.8 8h.6" /></Ic>;
const IPen = () => <Ic><path d="M10.5 2.5l3 3L6 13H3v-3z" /></Ic>;
const IFolder = ({ size = 15 }: { size?: number }) => <Ic size={size}><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.5 1.5h4.7A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" /></Ic>;
const IPlus = () => <Ic><path d="M8 3v10M3 8h10" /></Ic>;
const ITrash = () => <Ic size={13}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></Ic>;
const IEdit = () => <Ic size={13}><path d="M10.5 2.5l3 3L6 13H3v-3z" /></Ic>;
const ICopy = () => <Ic size={14}><rect x="5" y="5" width="8.5" height="8.5" rx="2" /><path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5" /></Ic>;
const ICheck = () => <Ic size={14} sw={1.8}><path d="M3 8.5l3.2 3L13 4.5" /></Ic>;
const IRetry = () => <Ic size={14}><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.8h-2.8" /></Ic>;
const IUp = () => <Ic size={16} sw={1.8}><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></Ic>;
const IDown = () => <Ic size={14}><path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" /></Ic>;
const IChev = () => <Ic size={12}><path d="M4 6l4 4 4-4" /></Ic>;
const IClose = () => <Ic size={13}><path d="M4 4l8 8M12 4l-8 8" /></Ic>;
const IChat = () => <Ic size={15}><path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v6A1.5 1.5 0 0 1 12 11.5H6.5L3.5 14v-2.5A1.5 1.5 0 0 1 2.5 10z" /></Ic>;
const IBot = () => <Ic size={15}><rect x="2.5" y="4.5" width="11" height="8.5" rx="2.5" /><path d="M8 2v2.5M6 8.5v.5M10 8.5v.5" /></Ic>;
const ISpark = () => <Ic><path d="M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.5 3.5l2.3 2.3M10.2 10.2l2.3 2.3M12.5 3.5l-2.3 2.3M5.8 10.2l-2.3 2.3" /></Ic>;
const IArm = () => <Ic><path d="M3 14h6M5 14V11l5-5M10 6l3 1.5M10 6L8.5 3" /><circle cx="5" cy="11" r="1" /><circle cx="10" cy="6" r="1" /></Ic>;
const IShield = () => <Ic><path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z" /><path d="M6 8l1.5 1.5L10.5 6.5" /></Ic>;
const INote = () => <Ic><path d="M4 2.5h6l2.5 2.5v8.5h-8.5z" /><path d="M6 8h4.5M6 10.5h3" /></Ic>;
const IWarn = () => <Ic><path d="M8 2l6.5 11.5h-13z" /><path d="M8 6.5v3M8 11.5v.2" /></Ic>;
const IWifi = () => <Ic><path d="M2 6a9 9 0 0 1 12 0M4.3 8.5a5.5 5.5 0 0 1 7.4 0M6.5 11a2.2 2.2 0 0 1 3 0M2.5 2.5l11 11" /></Ic>;

/* ---------- helpers ---------- */
type Banner = { kind: "error" | "offline" | "warn"; title: string; text: string; retry?: () => void; login?: boolean };
type Toast = { id: number; kind: "error" | "warn" | "ok"; text: string };

const uid = () => Math.random().toString(36).slice(2, 10);

function firstName(label: string): string {
  const base = label.includes("@") ? label.split("@")[0] : label;
  const w = base.trim().split(/\s+/)[0] ?? "";
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}
function initials(label: string): string {
  const base = label.includes("@") ? label.split("@")[0] : label;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "C") + (parts[1]?.[0] ?? "")).toUpperCase();
}
function groupOf(iso: string): "Today" | "Previous 7 days" | "Older" {
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return "Today";
  if (d.getTime() >= start - 7 * 86400000) return "Previous 7 days";
  return "Older";
}

const SUGGESTIONS = [
  { kicker: "AI advancement", text: "Brief me on the most important open problems in AI reasoning right now.", icon: <ISpark /> },
  { kicker: "Robotics", text: "Compare approaches to robot manipulation: classical planning vs. learned policies.", icon: <IArm /> },
  { kicker: "AI security", text: "Outline a threat model for an LLM app that calls external tools.", icon: <IShield /> },
  { kicker: "Everyday", text: "Help me draft a clear, friendly email declining a meeting.", icon: <INote /> },
];

/* ---------- component ---------- */
export function ChatWorkspace({ initialConversationId = null, initialProjectId = null, userLabel, provider, initialUsage }: ChatWorkspaceProps) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convsLoaded, setConvsLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(!!initialConversationId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<UsageSummary>(initialUsage);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [input, setInput] = useState("");
  const [sidebar, setSidebar] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [greeting, setGreeting] = useState("Hello");

  const convRef = useRef<string | null>(initialConversationId);
  const projRef = useRef<string | null>(initialProjectId);
  const liveRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef<ChatMessage[]>([]);
  msgsRef.current = messages;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const name = firstName(userLabel);
  const limitHit = usage.limit > 0 && usage.remaining <= 0;

  /* toasts */
  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const r = await fetch("/api/usage");
      if (r.ok) {
        const j = (await r.json()) as { usage: UsageSummary };
        setUsage(j.usage);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([fetch("/api/conversations"), fetch("/api/projects")]);
      if (c.ok) setConversations(((await c.json()) as { conversations: ConversationListItem[] }).conversations);
      if (p.ok) setProjects(((await p.json()) as { projects: Project[] }).projects);
    } catch {
      /* sidebar stays empty */
    } finally {
      setConvsLoaded(true);
    }
  }, []);

  const setProject = (id: string | null) => {
    projRef.current = id;
    setProjectId(id);
  };

  const loadConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    convRef.current = id;
    setConversationId(id);
    setMessages([]);
    setErrs({});
    setBanner(null);
    setLoadError(null);
    setLoading(true);
    stickRef.current = true;
    try {
      const r = await fetch(`/api/conversations/${id}`);
      if (!r.ok) throw new Error(r.status === 404 ? "This conversation no longer exists." : "We couldn't load this conversation.");
      const j = (await r.json()) as { conversation: { id: string; title: string; projectId: string | null }; messages: ChatMessage[] };
      if (convRef.current !== id) return;
      setMessages(j.messages);
      setTitle(j.conversation.title);
      projRef.current = j.conversation.projectId;
      setProjectId(j.conversation.projectId);
    } catch (e) {
      if (convRef.current === id) setLoadError(e instanceof Error ? e.message : "We couldn't load this conversation.");
    } finally {
      if (convRef.current === id) setLoading(false);
    }
  }, []);

  const newChat = useCallback((project: string | null = null, push = true) => {
    abortRef.current?.abort();
    convRef.current = null;
    setConversationId(null);
    setMessages([]);
    setErrs({});
    setTitle(null);
    setLoadError(null);
    setLoading(false);
    setBanner(null);
    projRef.current = project;
    setProjectId(project);
    if (push) window.history.pushState(null, "", project ? `/chat?project=${encodeURIComponent(project)}` : "/chat");
    if (window.matchMedia("(max-width: 900px)").matches) setSidebar("closed");
    window.setTimeout(() => taRef.current?.focus(), 0);
  }, []);

  /* mount */
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    if (window.matchMedia("(max-width: 900px)").matches) setSidebar("closed");
    void loadLists();
    if (initialConversationId) void loadConversation(initialConversationId);
    const onPop = () => {
      const m = /^\/chat\/([^/?#]+)/.exec(window.location.pathname);
      if (m) void loadConversation(decodeURIComponent(m[1]));
      else newChat(new URLSearchParams(window.location.search).get("project"), false);
    };
    const onOffline = () => setBanner({ kind: "offline", title: "Connection lost.", text: "You appear to be offline. We'll keep your draft." });
    const onOnline = () => setBanner((b) => (b?.kind === "offline" ? null : b));
    window.addEventListener("popstate", onPop);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine) onOffline();
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Esc stops */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (abortRef.current) abortRef.current.abort();
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* close menu outside */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  /* autoscroll */
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    stickRef.current = bottom;
    setAtBottom(bottom);
  };
  const jumpLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  /* autosize */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [input]);

  /* ---------- chat ---------- */
  const patchLive = (fn: (m: ChatMessage) => ChatMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === liveRef.current ? fn(m) : m)));

  const setErr = (id: string | null, text: string | null) => {
    if (!id) return;
    setErrs((e) => {
      const n = { ...e };
      if (text) n[id] = text;
      else delete n[id];
      return n;
    });
  };

  async function runChat(text: string, retryId?: string) {
    if (abortRef.current) return;
    setBanner((b) => (b?.kind === "offline" && navigator.onLine ? null : b?.kind === "offline" ? b : null));
    const now = new Date().toISOString();
    let userTmp: string | null = null;
    if (retryId) {
      liveRef.current = retryId;
      setErr(retryId, null);
      setMessages((ms) => ms.map((m) => (m.id === retryId ? { ...m, content: "", status: "streaming" } : m)));
    } else {
      userTmp = `tmp-u-${uid()}`;
      const a = `tmp-a-${uid()}`;
      liveRef.current = a;
      setMessages((ms) => [
        ...ms,
        { id: userTmp as string, role: "user", content: text, status: "complete", createdAt: now },
        { id: a, role: "assistant", content: "", status: "streaming", createdAt: now },
      ]);
    }
    stickRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);
    let terminal = false;

    const fail = (code: string, message: string, u?: UsageSummary) => {
      terminal = true;
      const id = liveRef.current;
      patchLive((m) => ({ ...m, status: "error" }));
      setErr(id, message);
      if (u) setUsage(u);
      switch (code) {
        case "limit_reached":
          if (!u) void refreshUsage();
          break;
        case "unauthorized":
          setBanner({ kind: "error", title: "You're signed out.", text: "Sign in again to keep chatting.", login: true });
          break;
        case "rate_limited":
          toast("warn", "You're sending messages quickly. Wait a moment, then retry.");
          break;
        case "busy":
          toast("warn", "Citad3L V1 is busy right now. Try again in a few seconds.");
          break;
        case "too_large":
          toast("error", "That message is too large to send.");
          break;
        default:
          if (id) setBanner({ kind: "error", title: "Something went wrong.", text: message, retry: () => retryMessage(id) });
      }
    };

    const handle = (block: string) => {
      let ev = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (!data.length) return;
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(data.join("\n")) as Record<string, unknown>;
      } catch {
        return;
      }
      if (ev === "meta") {
        const cid = String(d.conversationId);
        const aid = String(d.assistantMessageId);
        const umid = String(d.userMessageId);
        const prev = liveRef.current;
        liveRef.current = aid;
        setMessages((ms) =>
          ms.map((m) => (m.id === prev ? { ...m, id: aid } : userTmp && m.id === userTmp ? { ...m, id: umid } : m)),
        );
        const t = typeof d.title === "string" ? d.title : "New chat";
        setTitle(t);
        if (!convRef.current) {
          convRef.current = cid;
          setConversationId(cid);
          window.history.replaceState(null, "", `/chat/${encodeURIComponent(cid)}`);
        }
        setConversations((cs) => {
          const ex = cs.find((c) => c.id === cid);
          return [{ id: cid, title: t, projectId: ex ? ex.projectId : projRef.current, updatedAt: new Date().toISOString() }, ...cs.filter((c) => c.id !== cid)];
        });
      } else if (ev === "delta") {
        const tx = typeof d.text === "string" ? d.text : "";
        if (tx) patchLive((m) => ({ ...m, content: m.content + tx }));
      } else if (ev === "done") {
        terminal = true;
        patchLive((m) => ({ ...m, status: "complete" }));
        if (d.usage) setUsage(d.usage as UsageSummary);
      } else if (ev === "error") {
        fail(String(d.code ?? "internal"), String(d.message ?? "The reply failed."), d.usage as UsageSummary | undefined);
      }
    };

    try {
      const body: Record<string, unknown> = { message: text };
      if (convRef.current) body.conversationId = convRef.current;
      else if (projRef.current) body.projectId = projRef.current;
      if (retryId) body.retryAssistantMessageId = retryId;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        let code = res.status === 402 ? "limit_reached" : res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limited" : res.status === 413 ? "too_large" : "internal";
        let message = `Request failed (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: { code?: string; message?: string } };
          if (j.error) {
            code = j.error.code ?? code;
            message = j.error.message ?? message;
          }
        } catch {
          /* non-JSON */
        }
        fail(code, message);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          handle(block);
        }
      }
      if (buf.trim()) handle(buf);
      if (!terminal) throw new Error("stream ended");
    } catch {
      if (ac.signal.aborted) {
        patchLive((m) => ({ ...m, status: "stopped" }));
      } else if (!terminal) {
        const id = liveRef.current;
        patchLive((m) => ({ ...m, status: "error" }));
        setErr(id, "Connection lost before the reply finished. You weren't charged.");
        setBanner({
          kind: "offline",
          title: "Connection lost.",
          text: "The reply was interrupted.",
          retry: id ? () => retryMessage(id) : undefined,
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  function retryMessage(id: string) {
    if (abortRef.current) return;
    setBanner(null);
    if (id.startsWith("tmp-")) {
      const ms = msgsRef.current;
      const idx = ms.findIndex((m) => m.id === id);
      const user = idx > 0 ? ms[idx - 1] : undefined;
      if (!user || user.role !== "user") return;
      setMessages(ms.filter((_, i) => i !== idx && i !== idx - 1));
      setErr(id, null);
      void runChat(user.content);
      return;
    }
    void runChat("", id);
  }

  const canSend = !streaming && !limitHit && input.trim().length > 0 && input.length <= MAX_CHARS;
  const send = () => {
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    void runChat(text);
  };
  const stop = () => abortRef.current?.abort();

  const copyMsg = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500);
    } catch {
      toast("error", "Couldn't copy to clipboard.");
    }
  };

  /* ---------- sidebar actions ---------- */
  const openConversation = (e: React.MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (window.matchMedia("(max-width: 900px)").matches) setSidebar("closed");
    if (id === convRef.current && !loadError) return;
    window.history.pushState(null, "", `/chat/${encodeURIComponent(id)}`);
    void loadConversation(id);
  };

  const deleteConversation = async (c: ConversationListItem) => {
    if (!window.confirm(`Delete “${c.title || "Untitled"}”? This can't be undone.`)) return;
    try {
      const r = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setConversations((cs) => cs.filter((x) => x.id !== c.id));
      if (convRef.current === c.id) newChat(projRef.current);
      toast("ok", "Conversation deleted.");
    } catch {
      toast("error", "Couldn't delete that conversation.");
    }
  };

  const commitRename = async () => {
    if (!renaming) return;
    const { id, value } = renaming;
    const t = value.trim();
    setRenaming(null);
    if (!t) return;
    const prev = conversations.find((c) => c.id === id)?.title;
    if (t === prev) return;
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: t } : c)));
    if (convRef.current === id) setTitle(t);
    try {
      const r = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: prev ?? c.title } : c)));
      toast("error", "Couldn't rename that conversation.");
    }
  };

  const chooseProject = async (id: string | null) => {
    setMenuOpen(false);
    const prev = projRef.current;
    setProject(id);
    const cid = convRef.current;
    if (!cid) {
      window.history.replaceState(null, "", id ? `/chat?project=${encodeURIComponent(id)}` : "/chat");
      return;
    }
    setConversations((cs) => cs.map((c) => (c.id === cid ? { ...c, projectId: id } : c)));
    try {
      const r = await fetch(`/api/conversations/${cid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setProject(prev);
      setConversations((cs) => cs.map((c) => (c.id === cid ? { ...c, projectId: prev } : c)));
      toast("error", "Couldn't move this conversation.");
    }
  };

  /* ---------- derived ---------- */
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = conversations
      .filter((c) => !q || (c.title || "").toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const out: { label: string; items: ConversationListItem[] }[] = [];
    for (const c of list) {
      const g = groupOf(c.updatedAt);
      let bucket = out.find((x) => x.label === g);
      if (!bucket) {
        bucket = { label: g, items: [] };
        out.push(bucket);
      }
      bucket.items.push(c);
    }
    return out;
  }, [conversations, search]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const currentProject = projects.find((p) => p.id === projectId) ?? null;
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const showEmpty = !conversationId && messages.length === 0 && !loading && !loadError;

  const usageText =
    usage.plan === "trial"
      ? `${usage.remaining} of ${usage.limit} trial replies left`
      : `${usage.remaining.toLocaleString()} of ${usage.limit.toLocaleString()} ${usage.unitLabel} left`;
  const usageCls = limitHit ? " is-out" : usage.limit > 0 && usage.remaining / usage.limit <= 0.2 ? " is-low" : "";

  /* ---------- render pieces ---------- */
  const composer = (
    <div className={`composer${limitHit ? " is-disabled" : ""}${input.length > MAX_CHARS ? " is-over" : ""}`}>
      <label className="sr-only" htmlFor="citadel-composer">Message Citad3L</label>
      <textarea
        id="citadel-composer"
        ref={taRef}
        className="composer-input"
        rows={showEmpty ? 2 : 1}
        placeholder={limitHit ? "You've used this period's allowance" : showEmpty ? "Ask anything — strategy, code, research…" : "Reply to Citad3L…"}
        value={input}
        disabled={limitHit}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        aria-invalid={input.length > MAX_CHARS}
      />
      <div className="composer-bar">
        <div className="composer-left">
          <div className="seg" role="group" aria-label="Mode">
            <button type="button" className="seg-btn" aria-pressed="true">
              <IChat />
              <span className="seg-label">Chat</span>
            </button>
            <button type="button" className="seg-btn" disabled title="Agents — coming soon">
              <IBot />
              <span className="seg-label">Agents</span>
            </button>
          </div>
        </div>
        <div className="composer-right">
          <span className="engine-pill" title="Huihui-Qwen3.8-27B-abliterated by huihui-ai, served by Citad3L">
            <span className="engine-pill-mark"><Rook size={13} /></span>
            <span className="engine-pill-label">Citad3L V1</span>
          </span>
          {streaming ? (
            <button type="button" className="stop-btn" onClick={stop} aria-label="Stop generating (Esc)" title="Stop (Esc)">
              <i />
            </button>
          ) : (
            <button type="button" className="send-btn" onClick={send} disabled={!canSend} aria-label="Send message">
              <IUp />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const projectChip = (
    <div className="popover-anchor" ref={menuRef}>
      <button
        type="button"
        className={`project-chip${currentProject ? " is-set" : ""}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        disabled={streaming}
      >
        <IFolder size={14} />
        <span>{currentProject ? currentProject.name : "No project"}</span>
      </button>
      {menuOpen && (
        <div className="menu menu-up" role="menu">
          <div className="menu-label">Project</div>
          <button type="button" role="menuitemradio" aria-checked={!projectId} className="menu-item" onClick={() => void chooseProject(null)}>
            No project
          </button>
          {projects.map((p) => (
            <button key={p.id} type="button" role="menuitemradio" aria-checked={projectId === p.id} className="menu-item" onClick={() => void chooseProject(p.id)}>
              <IFolder size={14} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            </button>
          ))}
          <div className="menu-sep" />
          <a className="menu-item" href="/projects" role="menuitem">
            <IPlus /> New project
          </a>
        </div>
      )}
    </div>
  );

  const charCount =
    input.length > NEAR_CHARS ? (
      <span className={`char-count${input.length > MAX_CHARS ? " is-over" : " is-near"}`} aria-live="polite">
        {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
      </span>
    ) : null;

  const bannerEl = banner ? (
    <div className={`banner banner-${banner.kind}`} role="alert">
      {banner.kind === "offline" ? <IWifi /> : <IWarn />}
      <div className="banner-text">
        <strong>{banner.title}</strong> {banner.text}
      </div>
      {banner.retry && (
        <button type="button" className="btn btn-secondary btn-xs" onClick={banner.retry} disabled={streaming}>
          <IRetry /> Retry
        </button>
      )}
      {banner.login && (
        <a className="btn btn-primary btn-xs" href={`/login?next=${encodeURIComponent(conversationId ? `/chat/${conversationId}` : "/chat")}`}>
          Sign in
        </a>
      )}
      <button type="button" className="icon-btn icon-btn-sm" onClick={() => setBanner(null)} aria-label="Dismiss">
        <IClose />
      </button>
    </div>
  ) : null;

  const renderMessage = (m: ChatMessage) => {
    const isLast = m.id === lastAssistantId || m.id === messages[messages.length - 1]?.id;
    if (m.role === "user") {
      return (
        <div key={m.id} className="msg msg-user">
          <div className="msg-bubble">{m.content}</div>
          <div className="msg-actions">
            <button type="button" className={`msg-action${copiedId === m.id ? " is-done" : ""}`} onClick={() => void copyMsg(m)} aria-label="Copy message">
              {copiedId === m.id ? <ICheck /> : <ICopy />}
            </button>
          </div>
        </div>
      );
    }
    const live = m.status === "streaming";
    const canRetry = !streaming && (m.id === lastAssistantId || m.status === "error" || m.status === "stopped");
    return (
      <div key={m.id} className={`msg msg-assistant${isLast ? " is-last" : ""}`}>
        <div className="msg-head">
          <span className="msg-avatar"><Rook size={14} /></span>
          Citad3L
        </div>
        <div className="msg-body" aria-live={live ? "polite" : undefined} aria-busy={live}>
          {live && !m.content ? (
            <span className="thinking" aria-label="Thinking"><i /><i /><i /></span>
          ) : (
            <>
              {m.content && <Markdown content={m.content} />}
              {live && <span className="stream-caret" aria-hidden="true" />}
            </>
          )}
        </div>
        {m.status === "stopped" && <div className="msg-status">Stopped — not charged.</div>}
        {m.status === "error" && (
          <div className="msg-error" role="alert">
            <span>{errs[m.id] ?? "This reply failed. Failed replies are never charged."}</span>
            {canRetry && (
              <button type="button" className="btn btn-outline btn-xs" onClick={() => retryMessage(m.id)}>
                <IRetry /> Retry
              </button>
            )}
          </div>
        )}
        {!live && (
          <div className="msg-actions">
            {m.content && (
              <button type="button" className={`msg-action${copiedId === m.id ? " is-done" : ""}`} onClick={() => void copyMsg(m)}>
                {copiedId === m.id ? <ICheck /> : <ICopy />}
                {copiedId === m.id ? "Copied" : "Copy"}
              </button>
            )}
            {canRetry && m.status !== "error" && (
              <button type="button" className="msg-action" onClick={() => retryMessage(m.id)} disabled={limitHit}>
                <IRetry /> Retry
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ---------- render ---------- */
  return (
    <div className="chat-shell" data-sidebar={sidebar}>
      <div className="chat-scrim" onClick={() => setSidebar("closed")} aria-hidden="true" />
      <aside className="chat-sidebar" aria-label="Conversations" aria-hidden={sidebar === "closed" ? true : undefined}>
        <div className="side-inner">
          <div className="side-top">
            <div className="side-search">
              <ISearch />
              <input type="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search chats and projects" />
            </div>
            <button type="button" className="icon-btn" onClick={() => setSidebar("closed")} aria-label="Close sidebar">
              <IPanel />
            </button>
          </div>
          <button type="button" className="side-action" onClick={() => newChat(null)}>
            <IPen /> New chat
          </button>

          <div className="side-scroll">
            <div className="side-section">
              <button type="button" className="side-section-head" aria-expanded={projectsOpen} onClick={() => setProjectsOpen((o) => !o)}>
                Projects <IChev />
              </button>
              {projectsOpen && (
                <div className="side-list">
                  {filteredProjects.map((p) => (
                    <div key={p.id} className={`side-item${projectId === p.id && !conversationId ? " is-active" : ""}`}>
                      <a
                        className="side-item-link"
                        href={`/chat?project=${encodeURIComponent(p.id)}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                          e.preventDefault();
                          newChat(p.id);
                        }}
                      >
                        <IFolder size={14} />
                        <span>{p.name}</span>
                      </a>
                    </div>
                  ))}
                  <a className="side-action" href="/projects" style={{ marginTop: 2 }}>
                    <IPlus /> New project
                  </a>
                </div>
              )}
            </div>

            <div className="side-section">
              <div className="side-section-head">Recents</div>
              {!convsLoaded ? (
                <div className="skel-stack" style={{ padding: "8px 10px" }}>
                  <div className="skeleton skel-line w-80" />
                  <div className="skeleton skel-line w-60" />
                  <div className="skeleton skel-line w-80" />
                </div>
              ) : groups.length === 0 ? (
                <div className="side-empty">{search ? "No chats match your search." : "Your chats show up here."}</div>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <div className="side-group-label">{g.label}</div>
                    <div className="side-list">
                      {g.items.map((c) =>
                        renaming?.id === c.id ? (
                          <div key={c.id} className="side-item is-active">
                            <form
                              className="side-rename"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void commitRename();
                              }}
                            >
                              <input
                                autoFocus
                                value={renaming.value}
                                maxLength={120}
                                aria-label="Conversation title"
                                onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                                onBlur={() => void commitRename()}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.stopPropagation();
                                    setRenaming(null);
                                  }
                                }}
                              />
                            </form>
                          </div>
                        ) : (
                          <div key={c.id} className="side-item" aria-current={c.id === conversationId ? "page" : undefined}>
                            <a className="side-item-link" href={`/chat/${encodeURIComponent(c.id)}`} onClick={(e) => openConversation(e, c.id)} title={c.title}>
                              <span>{c.title || "Untitled"}</span>
                            </a>
                            <div className="side-item-actions">
                              <button type="button" className="side-item-btn" aria-label={`Rename ${c.title}`} onClick={() => setRenaming({ id: c.id, value: c.title })}>
                                <IEdit />
                              </button>
                              <button type="button" className="side-item-btn is-danger" aria-label={`Delete ${c.title}`} onClick={() => void deleteConversation(c)}>
                                <ITrash />
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="side-foot">
            <span className={`usage-chip${usageCls}`} style={{ alignSelf: "flex-start" }}>{usageText}</span>
            <a className="side-user" href="/account">
              <span className="nav-avatar">{initials(userLabel)}</span>
              <span className="side-user-name">{userLabel}</span>
            </a>
          </div>
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-topbar">
          {sidebar === "closed" && (
            <button type="button" className="btn btn-sm btn-quiet chats-btn" onClick={() => setSidebar("open")} aria-label="Open chats sidebar">
              <IPanel /> Chats
            </button>
          )}
          <div className="chat-topbar-title">{!showEmpty ? title ?? "" : ""}</div>
          <div className="chat-topbar-actions">
            {!showEmpty && (
              <button type="button" className="icon-btn" onClick={() => newChat(projRef.current)} aria-label="New chat" title="New chat">
                <IPen />
              </button>
            )}
          </div>
        </div>

        {showEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-inner">
              <div className="chat-emblem"><Rook size={64} /></div>
              <h1 className="chat-greeting">
                {greeting}
                {name ? `, ${name}` : ""}
              </h1>
              <p className="chat-greeting-sub">
                {currentProject ? `Working in ${currentProject.name}.` : "Strategy, robotics, AI security — or whatever's on your mind."}
              </p>
              {bannerEl && <div style={{ width: "100%", marginTop: 20 }}>{bannerEl}</div>}
              {limitHit && <div style={{ width: "100%", marginTop: 20 }}><LimitReached usage={usage} /></div>}
              {composer}
              <div className="chat-empty-meta">
                {projectChip}
                <div className="row">
                  {charCount}
                  <MockBadge provider={provider} />
                  <span className={`usage-chip${usageCls}`}>{usageText}</span>
                </div>
              </div>
              <h2 className="suggestions-title">Start with a briefing</h2>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.kicker}
                    type="button"
                    className="suggestion"
                    disabled={limitHit}
                    onClick={() => {
                      setInput(s.text);
                      taRef.current?.focus();
                    }}
                  >
                    <span className="suggestion-icon">{s.icon}</span>
                    <span>
                      <span className="suggestion-kicker">{s.kicker}</span>
                      <span className="suggestion-text" style={{ display: "block" }}>{s.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
              <div className="thread">
                {loading ? (
                  <div className="skel-stack" aria-label="Loading conversation">
                    <div className="skeleton skel-bubble" />
                    <div className="skeleton skel-line w-100" />
                    <div className="skeleton skel-line w-80" />
                    <div className="skeleton skel-line w-60" />
                    <div className="skeleton skel-bubble" style={{ marginTop: 16 }} />
                    <div className="skeleton skel-line w-80" />
                    <div className="skeleton skel-line w-40" />
                  </div>
                ) : loadError ? (
                  <div className="state">
                    <div className="state-emblem"><Rook size={32} /></div>
                    <div className="state-title">Couldn&apos;t open this chat</div>
                    <p className="state-body">{loadError}</p>
                    <div className="state-actions">
                      {conversationId && (
                        <button type="button" className="btn btn-secondary" onClick={() => void loadConversation(conversationId)}>
                          <IRetry /> Try again
                        </button>
                      )}
                      <button type="button" className="btn btn-primary" onClick={() => newChat(null)}>New chat</button>
                    </div>
                  </div>
                ) : (
                  messages.map(renderMessage)
                )}
              </div>
            </div>
            {!atBottom && !loading && (
              <button type="button" className="jump-latest" onClick={jumpLatest} style={{ bottom: 150 }}>
                <IDown /> Jump to latest
              </button>
            )}
            {!loadError && (
              <div className="composer-dock">
                <div className="composer-dock-inner">
                  {bannerEl}
                  {limitHit && <LimitReached usage={usage} />}
                  {composer}
                  <div className="composer-meta">
                    {projectChip}
                    <span className="spacer" />
                    {charCount}
                    <MockBadge provider={provider} />
                    <span className={`usage-chip${usageCls}`}>{usageText}</span>
                  </div>
                  <div className="composer-hint">
                    <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span>+<span className="kbd">Enter</span> for a new line · <span className="kbd">Esc</span> to stop. Failed or stopped replies aren&apos;t charged.
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <span className="toast-dot" />
              <span>{t.text}</span>
              <button type="button" className="toast-close" onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Dismiss">
                <IClose />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChatWorkspace;
