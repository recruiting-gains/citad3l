"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
/** Owner-only Hermes brain picker entries, passed in by the server page (never bundled). */
export type HermesBrainOption = { key: string; label: string; premium: boolean };
import type { ChatMessage, ConversationListItem, Project, ProviderInfo, UsageSummary } from "@/lib/types";
import { Rook } from "@/components/Rook";
import { MockBadge } from "@/components/MockBadge";
import { LimitReached } from "@/components/LimitReached";
import { Markdown } from "@/components/chat/Markdown";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { ModelSettingsModal } from "@/components/chat/ModelSettingsModal";
import { DEFAULT_MODEL_ID, isChatReady, isImageReady, isSwarmAvailable, isVideoReady, modelAllowsImageUpload, parseImageCommand, visibleModels, type PublicModel } from "@/lib/models";
import { timeOfDayGreeting, formatGreeting, type Greeting } from "@/lib/greeting";
import { UsageMeters } from "@/components/UsageMeter";
import { relevantLimitHit, usageLine } from "@/lib/usage-display";
import type { SkillRequest } from "@/lib/types";
import { planRetry, rerouteFromChatError, routeOutgoing } from "@/lib/computer/chat-guard";
import { createGate, createSyncEngine, mergeRemote, nextSyncDelay, sameMessages } from "@/lib/sync";
import { attachCaps, composeMessage, DOC_ACCEPT, MAX_FILES, MAX_IMAGES, MAX_VIDEO_IMAGES, splitMessage, type Attachment } from "@/lib/attachments";
import { createDictation, createDraftBinding, dictationSupported, giveMicConsent, hasMicConsent, MIC_DISCLOSURE, type Dictation } from "@/lib/dictation";
import { buildAnswerZip, triggerBlobDownload } from "@/lib/downloads";
import { buildChatPdf } from "@/lib/pdf-export";
import { isSlashImageCommand, looksLikeImageRequest } from "@/lib/image-intent";
import { trackFunnelEvent } from "@/lib/events-client";

const MAX_CHARS = 8000;
const NEAR_CHARS = 7000;

export interface ChatWorkspaceProps {
  initialConversationId?: string | null;
  initialProjectId?: string | null;
  userLabel: string;
  provider: ProviderInfo;
  initialUsage: UsageSummary;
  models?: PublicModel[];
  defaultModelId?: string;
  signedIn?: boolean;
  isOwner?: boolean;
  billingOpen?: boolean;
  /** @computer (Mac control). True ONLY for the OWNER_EMAIL account; the server enforces this again. */
  computerEnabled?: boolean;
  /** Owner-only Citad3L Hermes (server enforces HERMES_ALLOWED_EMAILS). */
  hermesEnabled?: boolean;
  hermesBrains?: HermesBrainOption[];
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
const IZip = () => <Ic size={14}><path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h7A1.5 1.5 0 0 1 13 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5z" /><path d="M7.5 4.5h1M7.5 6.8h1M7.5 9.2h1M6.2 11.2h3.6" /></Ic>;
const IPdf = () => <Ic size={14}><path d="M4 2h5.5L13 5.5V12.5A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-9A1.5 1.5 0 0 1 4.5 2z" /><path d="M9 2v4h4M5.5 9.5h5M5.5 11.8h3.5" /></Ic>;
const ICheck = () => <Ic size={14} sw={1.8}><path d="M3 8.5l3.2 3L13 4.5" /></Ic>;
const IRetry = () => <Ic size={14}><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.8h-2.8" /></Ic>;
const IUp = () => <Ic size={16} sw={1.8}><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></Ic>;
const IClip = () => <Ic size={16} sw={1.8}><path d="M13 7.5 8.2 12.3a3 3 0 0 1-4.3-4.2l5-5a2 2 0 0 1 2.9 2.8l-5 5a1 1 0 0 1-1.4-1.4L10 4.9" /></Ic>;
const IMic = () => <Ic size={16} sw={1.8}><path d="M8 2.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-4 0V4.5a2 2 0 0 1 2-2zM4.5 7.5a3.5 3.5 0 0 0 7 0M8 11v2.5" /></Ic>;
const IDown = () => <Ic size={14}><path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" /></Ic>;
const IChev = () => <Ic size={12}><path d="M4 6l4 4 4-4" /></Ic>;
const IClose = () => <Ic size={13}><path d="M4 4l8 8M12 4l-8 8" /></Ic>;

const ISpark = () => <Ic><path d="M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.5 3.5l2.3 2.3M10.2 10.2l2.3 2.3M12.5 3.5l-2.3 2.3M5.8 10.2l-2.3 2.3" /></Ic>;
const IArm = () => <Ic><path d="M3 14h6M5 14V11l5-5M10 6l3 1.5M10 6L8.5 3" /><circle cx="5" cy="11" r="1" /><circle cx="10" cy="6" r="1" /></Ic>;
const IShield = () => <Ic><path d="M8 1.8l5 2v4c0 3.2-2.2 5.3-5 6.4-2.8-1.1-5-3.2-5-6.4v-4z" /><path d="M6 8l1.5 1.5L10.5 6.5" /></Ic>;
const INote = () => <Ic><path d="M4 2.5h6l2.5 2.5v8.5h-8.5z" /><path d="M6 8h4.5M6 10.5h3" /></Ic>;
const IWarn = () => <Ic><path d="M8 2l6.5 11.5h-13z" /><path d="M8 6.5v3M8 11.5v.2" /></Ic>;
const IWifi = () => <Ic><path d="M2 6a9 9 0 0 1 12 0M4.3 8.5a5.5 5.5 0 0 1 7.4 0M6.5 11a2.2 2.2 0 0 1 3 0M2.5 2.5l11 11" /></Ic>;

/* ---------- helpers ---------- */
type Banner = { kind: "error" | "offline" | "warn"; title: string; text: string; retry?: () => void; login?: boolean; upgrade?: boolean };
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
const MODEL_STORAGE_KEY = "citad3l.model";
const CONTINUED_STORAGE_KEY = "citad3l.continued";

export function ChatWorkspace({ initialConversationId = null, initialProjectId = null, userLabel, provider, initialUsage, models, defaultModelId = DEFAULT_MODEL_ID, signedIn = true, isOwner = false, billingOpen = false, computerEnabled = false, hermesEnabled = false, hermesBrains = [] }: ChatWorkspaceProps) {
  const catalog = models && models.length ? models : visibleModels();
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
  const [softSaveDismissed, setSoftSaveDismissed] = useState(false);
  const [upgradeCard, setUpgradeCard] = useState<null | "pro" | "max">(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [input, setInput] = useState("");
  const [hermesBrain, setHermesBrain] = useState<string>("v1");
  const brainInfo = (k: string) => hermesBrains.find((b) => b.key === k) ?? { key: k, label: k.toUpperCase(), premium: false };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // "auto" (SSR default): CSS treats it as open on desktop and closed on phones, avoiding a pre-hydration overlay.
  const [sidebar, setSidebar] = useState<"open" | "closed" | "auto">("auto");
  const [search, setSearch] = useState("");
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [continuedMap, setContinuedMap] = useState<Record<string, number>>({});
  const [truncatedMap, setTruncatedMap] = useState<Record<string, boolean>>({});
  const [exportsMap, setExportsMap] = useState<Record<string, { zip?: { url: string; filename: string; bytes: number }; pdf?: { url: string; filename: string; bytes: number } }>>({});
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [greeting, setGreeting] = useState<Greeting>({ short: "Hello", sub: "" });
  const [modelId, setModelId] = useState(defaultModelId);
  const [swarm, setSwarm] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillRequest>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [computerPending, setComputerPending] = useState<{ pendingId: string; reason: string; action: string; expiresAt: number } | null>(null);

  const convRef = useRef<string | null>(initialConversationId);
  const projRef = useRef<string | null>(initialProjectId);
  const liveRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Any chat switch or local reply start/end makes in-flight sync responses stale (they're dropped, not applied).
  const gateRef = useRef(createGate());
  const stopDictationRef = useRef<(() => void) | null>(null);
  const msgsRef = useRef<ChatMessage[]>([]);
  msgsRef.current = messages;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONTINUED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") setContinuedMap(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const markContinued = useCallback((id: string | null, count: number) => {
    if (!id || count <= 0) return;
    setContinuedMap((prev) => {
      if ((prev[id] ?? 0) >= count) return prev;
      const next = { ...prev, [id]: count };
      try {
        const keys = Object.keys(next);
        if (keys.length > 100) delete next[keys[0]];
        window.localStorage.setItem(CONTINUED_STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const name = firstName(userLabel);

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
    stopDictationRef.current?.();
    gateRef.current.bump();
    const token = gateRef.current.begin();
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
      if (convRef.current !== id || !gateRef.current.accept(token)) return;
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
    stopDictationRef.current?.();
    gateRef.current.bump();
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
    setGreeting(timeOfDayGreeting());
    setSidebar(window.matchMedia("(max-width: 900px)").matches ? "closed" : "open");
    if (signedIn) void loadLists();
    else setConvsLoaded(true);
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

  /* live sync across devices (phone ↔ desktop ↔ Dock app): poll tiny fingerprints while this tab is visible.
     Serialized, acknowledged only after a successful apply, stale responses dropped (lib/sync.ts createSyncEngine). */
  const refreshOpenConversation = useCallback(async (id: string, signal: AbortSignal): Promise<boolean> => {
    const token = gateRef.current.begin();
    const r = await fetch(`/api/conversations/${id}`, { cache: "no-store", signal });
    if (!r.ok) return false;
    const j = (await r.json()) as { conversation: { id: string; title: string; projectId: string | null }; messages: ChatMessage[] };
    // Never touch the screen mid-reply on THIS device, after a chat switch, or if a newer fetch already landed.
    if (convRef.current !== id || abortRef.current || !gateRef.current.accept(token)) return false;
    setMessages((ms) => {
      const merged = mergeRemote(ms, j.messages);
      return sameMessages(ms, merged) ? ms : merged;
    });
    setTitle(j.conversation.title);
    return true;
  }, []);
  const refreshListsForSync = useCallback(async (signal: AbortSignal): Promise<boolean> => {
    const [c, p] = await Promise.all([fetch("/api/conversations", { cache: "no-store", signal }), fetch("/api/projects", { cache: "no-store", signal })]);
    if (!c.ok || !p.ok) return false;
    const [cj, pj] = await Promise.all([c.json() as Promise<{ conversations: ConversationListItem[] }>, p.json() as Promise<{ projects: Project[] }>]);
    if (signal.aborted) return false;
    setConversations(cj.conversations);
    setProjects(pj.projects);
    return true;
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let timer: number | undefined;
    let stopped = false;
    const engine = createSyncEngine({
      fetchStamps: async (cid, signal) => {
        const r = await fetch(`/api/sync${cid ? `?c=${encodeURIComponent(cid)}` : ""}`, { cache: "no-store", signal });
        if (!r.ok) throw new Error(`sync ${r.status}`);
        return (await r.json()) as { list: string; conv: string | null };
      },
      refreshList: refreshListsForSync,
      refreshConv: refreshOpenConversation,
      currentConvId: () => (convRef.current && !convRef.current.startsWith("guest-") ? convRef.current : null),
      busy: () => !!abortRef.current,
    });
    const tick = async () => {
      window.clearTimeout(timer);
      if (stopped) return;
      if (document.visibilityState === "visible" && navigator.onLine) await engine.tick();
      if (!stopped) {
        window.clearTimeout(timer);
        timer = window.setTimeout(tick, nextSyncDelay(Date.now() - engine.changedAt));
      }
    };
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      engine.poke(); // back to the fast interval
      void tick();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    timer = window.setTimeout(tick, 1500);
    return () => {
      stopped = true;
      engine.stop(); // also aborts any fetch already issued
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [signedIn, refreshListsForSync, refreshOpenConversation]);

  /* voice input (Web Speech API where the browser has it; the phone keyboard's own mic works everywhere).
     Opt-in disclosure before the first start(); one session per draft; aborted on send, chat switch, sign-out,
     page hide and unmount; late results from an aborted session are dropped (pre-deploy review, blocker 4). */
  const [canDictate, setCanDictate] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNotice, setMicNotice] = useState(false);
  const dictRef = useRef<Dictation | null>(null);
  const micBindRef = useRef(createDraftBinding());
  const stopDictation = useCallback(() => {
    micBindRef.current.cancel();
    const d = dictRef.current;
    dictRef.current = null;
    d?.abort();
    setListening(false);
  }, []);
  stopDictationRef.current = stopDictation;
  useEffect(() => {
    setCanDictate(dictationSupported());
    const onHide = () => { if (document.visibilityState === "hidden") stopDictation(); };
    window.addEventListener("pagehide", stopDictation);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", stopDictation);
      document.removeEventListener("visibilitychange", onHide);
      stopDictation();
    };
  }, [stopDictation]);
  useEffect(() => { if (!signedIn) stopDictation(); }, [signedIn, stopDictation]); // sign-out / account change
  const startDictation = () => {
    const base = taRef.current?.value ?? "";
    const bind = micBindRef.current.start(convRef.current);
    const d = createDictation({
      lang: navigator.language || "en-US",
      onText: (text) => {
        if (!micBindRef.current.live(bind, convRef.current)) return; // late result after send/switch: drop it
        setInput(base && text ? `${base.replace(/\s+$/, "")} ${text}` : base || text);
      },
      onEnd: (error) => {
        if (!micBindRef.current.live(bind, convRef.current)) return;
        dictRef.current = null;
        setListening(false);
        if (error === "not-allowed" || error === "service-not-allowed") toast("warn", "Microphone access is off for Citad3L. Allow it in your browser settings, or use the keyboard's mic.");
        else if (error && error !== "aborted" && error !== "no-speech") toast("warn", "Voice input stopped. Try again, or use the keyboard's mic.");
        window.setTimeout(() => taRef.current?.focus(), 0);
      },
    });
    if (!d) {
      toast("warn", "Voice input isn't available in this browser. Use the mic on your keyboard instead.");
      return;
    }
    dictRef.current = d;
    setListening(true);
  };
  const toggleDictation = () => {
    if (dictRef.current) {
      dictRef.current.stop();
      return;
    }
    let store: Storage | null = null;
    try { store = window.localStorage; } catch { store = null; }
    if (!hasMicConsent(store)) {
      setMicNotice(true); // disclosure first; nothing starts until they accept
      return;
    }
    startDictation();
  };
  const acceptMic = () => {
    let store: Storage | null = null;
    try { store = window.localStorage; } catch { store = null; }
    giveMicConsent(store);
    setMicNotice(false);
    startDictation();
  };

  /* remember last chat model (public slug only) */
  useEffect(() => {
    try {
      // /chat?model=<slug> (from a model page's "Open" button) wins over the remembered model, if this account has it.
      const asked = new URLSearchParams(window.location.search).get("model");
      if (asked && catalog.some((m) => m.id === asked)) {
        setModelId(asked);
        window.localStorage.setItem(MODEL_STORAGE_KEY, asked);
        return;
      }
      // An open Hermes chat stays on Hermes, and an open normal chat never switches to Hermes from memory.
      const isAgent = (id: string | null) => catalog.find((m) => m.id === id)?.modality === "agent";
      if (initialConversationId && isAgent(defaultModelId)) return;
      const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
      if (saved && catalog.some((m) => m.id === saved) && !(initialConversationId && isAgent(saved))) setModelId(saved);
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedModel = catalog.find((m) => m.id === modelId) ?? catalog[0];
  const chatReady = isChatReady(selectedModel);
  // Image, Video and Swarm need an account; the server enforces the plan (Image = Pro/Max, Video = Max) and shows an
  // upgrade message (402 upgrade_required) whatever this says.
  const imageReady = isImageReady(selectedModel) && signedIn;
  const videoReady = isVideoReady(selectedModel) && signedIn;
  const swarmAvailable = isSwarmAvailable(selectedModel) && signedIn;
  const hermesReady = selectedModel?.modality === "agent" && signedIn && hermesEnabled;
  const composerMode = videoReady ? "video" as const : imageReady ? "image" as const : "chat" as const;
  const limitHit = relevantLimitHit(usage, { mode: composerMode, swarm: swarm && swarmAvailable });
  const allowImageUpload = modelAllowsImageUpload(selectedModel) && signedIn;
  // Paperclip: signed-in users on V1/Fast (images + files) and Video (one starting-frame image). Private and Image stay text-only.
  const caps = signedIn ? attachCaps(selectedModel) : { images: false, files: false };
  const canOpenSettings = signedIn && (isOwner || usage.plan === "max");
  const isFreeUser = !signedIn || (usage.plan === "trial" && !isOwner && !usage.admin);

  const chooseModel = (id: string) => {
    if (!catalog.some((m) => m.id === id)) return;
    const next = catalog.find((m) => m.id === id);
    if (!isSwarmAvailable(next)) setSwarm(false);
    const nextCaps = attachCaps(next);
    setAttachments((xs) => xs.filter((a) => (a.kind === "image" ? nextCaps.images : nextCaps.files)));
    setModelId(id);
    if (isImageReady(next) && isFreeUser) {
      setUpgradeCard("pro");
      trackFunnelEvent("image_upgrade_shown", "/chat");
    } else if (isVideoReady(next) && !isOwner && !usage.admin && usage.plan !== "max") {
      setUpgradeCard("max");
    } else {
      setUpgradeCard(null);
    }
    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      /* storage blocked */
    }
  };

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

  /** Shows the user's message plus an error reply without calling any model. */
  function showLocalError(text: string, message: string) {
    const now = new Date().toISOString();
    setMessages((ms) => [
      ...ms,
      { id: `tmp-u-${uid()}`, role: "user", content: text, status: "complete", createdAt: now },
      { id: `tmp-x-${uid()}`, role: "assistant", content: `⚠️ ${message}`, status: "error", createdAt: now },
    ]);
  }

  async function runChat(text: string, retryId?: string, atts: Attachment[] = []) {
    if (abortRef.current) return;
    // Last line of defence: "@computer …" never goes to the chat model (the server refuses it too).
    if (!retryId) {
      const route = routeOutgoing(text, computerEnabled);
      if (route.kind === "computer") { void runComputer({ task: text }, text); return; }
      if (route.kind === "blocked") { showLocalError(text, route.message); return; }
    }
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
        { id: userTmp as string, role: "user", content: atts.length ? composeMessage(text, atts) : text, status: "complete", createdAt: now },
        { id: a, role: "assistant", content: "", status: "streaming", createdAt: now },
      ]);
    }
    stickRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    gateRef.current.bump();
    setStreaming(true);
    setStatusLine(null);
    let terminal = false;
    let rerouteTask: string | null = null;

    const fail = (code: string, message: string, u?: UsageSummary) => {
      terminal = true;
      const id = liveRef.current;
      if (u) setUsage(u);
      if (code === "content_policy") {
        // Fail-closed check: the message was not sent. Put the draft back so "try again" is honest.
        const retryable = message.startsWith("We couldn't finish the safety check");
        if (retryable && !retryId) {
          setInput(text);
          if (atts.length) setAttachments(atts);
          setMessages((ms) => ms.filter((m) => m.id !== id && m.id !== userTmp));
          toast("warn", message);
          return;
        }
        patchLive((m) => ({ ...m, content: message, status: "complete" }));
        setErr(id, null);
        return;
      }
      patchLive((m) => ({ ...m, status: "error" }));
      setErr(id, message);
      switch (code) {
        case "computer_command":
          break; // shown inline on the reply; never retried through chat
        case "limit_reached":
          if (!u) void refreshUsage();
          break;
        case "unauthorized":
          setBanner({ kind: "error", title: "You're signed out.", text: "Sign in again to keep chatting.", login: true });
          break;
        case "signup_required":
          setBanner({ kind: "error", title: "Create an account to continue.", text: message, login: true });
          break;
        case "upgrade_required":
          setUpgradeCard(videoReady ? "max" : "pro");
          trackFunnelEvent("image_upgrade_shown", "/chat");
          break;
        case "daily_cap":
          toast("warn", message);
          break;
        case "suspended":
          setBanner({ kind: "error", title: "This account is suspended.", text: message });
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
          // The error already shows inline on the reply, with its own Retry. No second banner.
          if (!id) setBanner({ kind: "error", title: "Something went wrong.", text: message });
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
          if (!d.guest && !cid.startsWith("guest-")) {
            window.history.replaceState(null, "", `/chat/${encodeURIComponent(cid)}`);
          }
        }
        setConversations((cs) => {
          const ex = cs.find((c) => c.id === cid);
          return [{ id: cid, title: t, projectId: ex ? ex.projectId : projRef.current, updatedAt: new Date().toISOString() }, ...cs.filter((c) => c.id !== cid)];
        });
      } else if (ev === "delta") {
        const tx = typeof d.text === "string" ? d.text : "";
        if (tx) patchLive((m) => ({ ...m, content: m.content + tx }));
      } else if (ev === "replace") {
        // Video: the pending player is swapped for the finished clip.
        const tx = typeof d.text === "string" ? d.text : "";
        if (tx) patchLive((m) => ({ ...m, content: tx }));
      } else if (ev === "done") {
        terminal = true;
        patchLive((m) => ({ ...m, status: "complete" }));
        if (typeof d.continuations === "number" && d.continuations > 0) {
          markContinued(liveRef.current, d.continuations);
        }
        if (d.truncated === true && liveRef.current) {
          const id = liveRef.current;
          setTruncatedMap((prev) => ({ ...prev, [id]: true }));
        }
        if (d.usage) setUsage(d.usage as UsageSummary);
        setStatusLine(null);
      } else if (ev === "exports") {
        const id = liveRef.current;
        if (id) {
          const zip = d.zip as { url: string; filename: string; bytes: number } | undefined;
          const pdf = d.pdf as { url: string; filename: string; bytes: number } | undefined;
          if (zip || pdf) {
            setExportsMap((prev) => ({ ...prev, [id]: { zip, pdf } }));
          }
        }
      } else if (ev === "status") {
        const detail = typeof d.detail === "string" ? d.detail : "";
        if (detail) setStatusLine(detail);
        if (typeof d.continuations === "number" && d.continuations > 0) {
          markContinued(liveRef.current, d.continuations);
        }
      } else if (ev === "refused") {
        terminal = true;
        const msg = String(d.message ?? "This request isn't allowed.");
        patchLive((m) => ({ ...m, content: msg, status: "complete" }));
        if (d.usage) setUsage(d.usage as UsageSummary);
        setStatusLine(null);
      } else if (ev === "error") {
        fail(String(d.code ?? "internal"), String(d.message ?? "The reply failed."), d.usage as UsageSummary | undefined);
      }
    };

    try {
      // "/image …" is an admin shortcut; for anyone else it is just text sent to chat.
      const parsed = videoReady || hermesReady ? { image: false, prompt: text } : signedIn ? parseImageCommand(text, imageReady) : { image: false, prompt: text };
      if (parsed.image && !parsed.prompt && !retryId) {
        fail("bad_request", "Add a prompt after /image, or describe the image you want.");
        return;
      }
      const body: Record<string, unknown> = { message: parsed.image ? parsed.prompt : text, model: parsed.image ? "citad3l-image" : modelId };
      if (convRef.current && !String(convRef.current).startsWith("guest-")) body.conversationId = convRef.current;
      else if (projRef.current && signedIn) body.projectId = projRef.current;
      if (retryId && signedIn) body.retryAssistantMessageId = retryId;
      if (!parsed.image && swarm && swarmAvailable) body.swarm = true;
      if (!parsed.image && !videoReady) body.skills = skills;
      if (!parsed.image && !retryId && atts.length) body.attachments = atts;
      if (videoReady) {
        delete body.model;
        delete body.retryAssistantMessageId;
      }
      if (hermesReady) {
        delete body.model;
        delete body.skills;
        delete body.swarm;
        delete body.attachments;
        delete body.projectId;
        body.brain = hermesBrain;
      }
      if (!signedIn) {
        body.history = msgsRef.current
          .filter((m) => m.role === "user" || m.status === "complete")
          .filter((m) => !m.id.startsWith("tmp-a-"))
          .slice(-16)
          .map((m) => ({ role: m.role, content: m.content }));
      }
      const res = await fetch(hermesReady ? "/api/hermes" : videoReady ? "/api/video" : parsed.image ? "/api/image" : "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        let code = res.status === 402 ? "limit_reached" : res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limited" : res.status === 413 ? "too_large" : res.status === 400 ? "bad_request" : "internal";
        let message = `Request failed (${res.status}).`;
        let j: { error?: { code?: string; message?: string }; task?: string } | null = null;
        try {
          j = (await res.json()) as { error?: { code?: string; message?: string }; task?: string };
          if (j.error) {
            code = j.error.code ?? code;
            message = j.error.message ?? message;
          }
        } catch {
          /* non-JSON */
        }
        // The server refused an "@computer …" message: run it on @computer instead of showing an error.
        const retryUser = retryId ? msgsRef.current[msgsRef.current.findIndex((m) => m.id === retryId) - 1] : undefined;
        const task = rerouteFromChatError(res.status, j, retryId ? (retryUser?.role === "user" ? retryUser.content : "") : text, computerEnabled);
        if (task) {
          terminal = true;
          const live = liveRef.current;
          setMessages((ms) => ms.filter((m) => m.id !== live));
          rerouteTask = task;
          return;
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
      gateRef.current.bump();
      setStatusLine(null);
      setStreaming(false);
      if (rerouteTask) void runComputer({ task: rerouteTask }, null);
    }
  }

  function retryMessage(id: string) {
    if (abortRef.current) return;
    setBanner(null);
    const ms = msgsRef.current;
    // Retry on an @computer reply, or on any reply whose user message starts with "@computer" (unsaved or loaded from
    // history), re-runs @computer. It must never reach the chat model.
    const plan = planRetry(ms, id, computerEnabled);
    setErr(id, null);
    switch (plan.kind) {
      case "computer":
        // Keep the user's message on screen; replace only the failed reply.
        setMessages((cur) => cur.filter((m) => m.id !== id));
        void runComputer({ task: plan.task }, null);
        return;
      case "blocked":
        setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, content: `⚠️ ${plan.message}`, status: "error" } : m)));
        return;
      case "chat-unsaved": {
        const idx = ms.findIndex((m) => m.id === id);
        setMessages(ms.filter((_, i) => i !== idx && i !== idx - 1));
        void runChat(plan.text);
        return;
      }
      case "chat-saved":
        void runChat("", id);
        return;
      case "none":
        return;
    }
  }

  const composerReady = chatReady || imageReady || videoReady || hermesReady;
  const attachBlocked = attachments.length > 0 && (
    attachments.some((a) => a.kind === "file" && !caps.files) ||
    attachments.some((a) => a.kind === "image" && (!caps.images || swarm))
  );
  const canSend = !streaming && !limitHit && composerReady && !attachBusy && !attachBlocked && (input.trim().length > 0 || (!videoReady && attachments.length > 0)) && input.length <= MAX_CHARS;
  const send = () => {
    if (!canSend) return;
    stopDictation(); // nothing late may refill the draft after it's sent
    const text = input.trim();
    if (isFreeUser && !imageReady && !videoReady && looksLikeImageRequest(text)) {
      setUpgradeCard("pro");
      trackFunnelEvent("image_upgrade_shown", "/chat");
      if (isSlashImageCommand(text)) {
        setInput("");
        return;
      }
    }
    setInput("");
    if (attachments.length) {
      const atts = attachments;
      setAttachments([]);
      setAttachNote(null);
      void runChat(text, undefined, atts);
      return;
    }
    const route = routeOutgoing(text, computerEnabled);
    if (route.kind === "computer") void runComputer({ task: text }, text);
    else if (route.kind === "blocked") showLocalError(text, route.message);
    else void runChat(text);
  };
  const stop = () => {
    if (computerRunning.current) void fetch("/api/computer/stop", { method: "POST" }).catch(() => null);
    abortRef.current?.abort();
  };

  /* ---------- @computer (owner only): NDJSON action log streamed into one assistant message ---------- */
  const computerRunning = useRef(false);
  async function runComputer(body: { task: string } | { confirm: string }, shownText: string | null) {
    if (abortRef.current) return;
    setComputerPending(null);
    const now = new Date().toISOString();
    const a = `tmp-c-${uid()}`;
    liveRef.current = a;
    setMessages((ms) => [
      ...ms,
      ...(shownText ? [{ id: `tmp-u-${uid()}`, role: "user" as const, content: shownText, status: "complete" as const, createdAt: now }] : []),
      { id: a, role: "assistant", content: "**@computer** · connecting to your Mac…", status: "streaming", createdAt: now },
    ]);
    stickRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    gateRef.current.bump();
    computerRunning.current = true;
    setStreaming(true);
    const lines: string[] = ["**@computer**"];
    const show = (status: ChatMessage["status"] = "streaming") =>
      setMessages((ms) => ms.map((m) => (m.id === a ? { ...m, content: lines.join("\n"), status } : m)));
    let final: ChatMessage["status"] = "complete";
    try {
      const res = await fetch("/api/computer/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        lines.push(`\n⚠️ ${j?.error?.message ?? `Couldn't start (${res.status}).`}`);
        final = "error";
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            let e: Record<string, any>;
            try { e = JSON.parse(line); } catch { continue; }
            if (e.type === "start") lines.push(`_Controlling your Mac · up to ${e.maxSteps} steps · press Stop (or ctrl+option+cmd+K on the Mac) any time._\n`);
            else if (e.type === "step") lines.push(`${e.step}. ${e.action}${e.thought ? ` — _${String(e.thought).slice(0, 160)}_` : ""}`);
            else if (e.type === "result" && !e.ok) lines.push(`   ↳ failed: ${e.error}`);
            else if (e.type === "confirm") {
              lines.push(`\n🛑 **Needs your OK:** ${e.action}\n${e.reason}${e.thought ? `\n_${e.thought}_` : ""}`);
              setComputerPending({ pendingId: e.pendingId, reason: e.reason, action: e.action, expiresAt: e.expiresAt });
            } else if (e.type === "done") lines.push(`\n✅ ${e.summary}\n\n_${e.steps} steps · about $${Number(e.usd).toFixed(3)}_`);
            else if (e.type === "stopped") lines.push(`\n⏹ ${e.reason}\n\n_${e.steps} steps · about $${Number(e.usd).toFixed(3)}_`);
            else if (e.type === "error") { lines.push(`\n⚠️ ${e.message}`); final = "error"; }
            show();
          }
        }
      }
    } catch {
      if (ac.signal.aborted) { lines.push("\n⏹ Stopped."); final = "stopped"; }
      else { lines.push("\n⚠️ Lost the connection to Citad3L. Check your Mac's screen."); final = "error"; }
    } finally {
      abortRef.current = null;
      gateRef.current.bump();
      computerRunning.current = false;
      setStreaming(false);
      show(final);
    }
  }
  const confirmComputer = (ok: boolean) => {
    const p = computerPending;
    if (!p) return;
    setComputerPending(null);
    if (ok) void runComputer({ confirm: p.pendingId }, null);
    else void fetch("/api/computer/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancel: p.pendingId }) }).then(() => toast("ok", "Cancelled. Nothing was done."));
  };

  const copyMsg = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      window.setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500);
    } catch {
      toast("error", "Couldn't copy to clipboard.");
    }
  };

  const fileSlug = () => {
    const base = (title && title !== "New chat" ? title : "citad3l-answer")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return base || "citad3l-answer";
  };

  const downloadMsgZip = (m: ChatMessage) => {
    try {
      const { bytes, fileCount } = buildAnswerZip(m.content);
      triggerBlobDownload(bytes, "application/zip", `${fileSlug()}.zip`);
      toast("ok", `Saved zip (${fileCount} ${fileCount === 1 ? "file" : "files"}).`);
    } catch {
      toast("error", "Couldn't create zip.");
    }
  };

  const downloadMsgPdf = (m: ChatMessage) => {
    try {
      const bytes = buildChatPdf(m.content, {
        title: title && title !== "New chat" ? title : "Citad3L Answer",
        createdAt: m.createdAt,
      });
      triggerBlobDownload(bytes, "application/pdf", `${fileSlug()}.pdf`);
      toast("ok", "Saved PDF.");
    } catch {
      toast("error", "Couldn't create PDF.");
    }
  };

  const createServerExportLinks = async (m: ChatMessage) => {
    if (!signedIn || exportingId) return;
    setExportingId(m.id);
    try {
      const payload = m.id.startsWith("tmp-")
        ? { title: title && title !== "New chat" ? title : "Citad3L Answer", markdown: m.content, kind: "both" }
        : { messageId: m.id, kind: "both" };
      const r = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json().catch(() => ({}))) as {
        zip?: { url: string; filename: string; bytes: number };
        pdf?: { url: string; filename: string; bytes: number };
        error?: { message?: string };
      };
      if (!r.ok) {
        toast("error", j.error?.message ?? "Couldn't create 24h download links.");
        return;
      }
      setExportsMap((prev) => ({ ...prev, [m.id]: { zip: j.zip, pdf: j.pdf } }));
      toast("ok", "24-hour download links ready.");
    } catch {
      toast("error", "Couldn't create 24h download links.");
    } finally {
      setExportingId(null);
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

  const usageText = usageLine(usage, { mode: composerMode, swarm: swarm && swarmAvailable });
  const usageLow = composerMode === "image" && usage.image
    ? usage.image.limit > 0 && usage.image.remaining / usage.image.limit <= 0.2
    : composerMode === "video" && usage.video
      ? usage.video.limit > 0 && usage.video.remaining / usage.video.limit <= 0.2
      : usage.limit > 0 && usage.remaining / usage.limit <= 0.2;
  const usageCls = limitHit ? " is-out" : usageLow ? " is-low" : "";

  /* ---------- render pieces ---------- */
  const limitPlaceholder =
    usage.guest ? "Free messages used — create an account to keep chatting" : usage.plan === "trial" ? "Free messages used — see plans to keep chatting" : "Allowance used — refreshes on the 5-hour window or weekly cap";

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length || (!caps.files && !caps.images)) return;
    setAttachBusy(true);
    setAttachNote(null);
    try {
      const { readAttachment } = await import("@/lib/attachments-client");
      const next = [...attachments];
      const imageLimit = videoReady ? MAX_VIDEO_IMAGES : MAX_IMAGES;
      for (const f of list) {
        const isImg = f.type.startsWith("image/");
        if (isImg && !caps.images) { setAttachNote(`${selectedModel?.name ?? "This model"} can't use images.`); continue; }
        if (!isImg && !caps.files) { setAttachNote(`${selectedModel?.name ?? "This model"} can start from a picture, but not from a document.`); continue; }
        if (isImg && next.filter((a) => a.kind === "image").length >= imageLimit) { setAttachNote(videoReady ? "Attach one picture as the starting frame." : `Up to ${MAX_IMAGES} images per message.`); continue; }
        if (!isImg && next.filter((a) => a.kind === "file").length >= MAX_FILES) { setAttachNote(`Up to ${MAX_FILES} files per message.`); continue; }
        try {
          next.push(await readAttachment(f, caps.images));
        } catch (e) {
          setAttachNote((e as Error).message || "That file couldn't be read.");
        }
      }
      setAttachments(next);
    } finally {
      setAttachBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const attachHint = attachBlocked
    ? attachments.some((a) => a.kind === "file" && !caps.files) && caps.images
      ? `${selectedModel?.name ?? "This model"} can start from a picture, but not from a document. Remove the file to send.`
      : !caps.files && !caps.images
        ? `${selectedModel?.name ?? "This model"} is text only. Remove the attachments to send.`
        : swarm && caps.images
          ? "Swarm can't read images. Turn Swarm off or remove the image."
          : `${selectedModel?.name ?? "This model"} can't read images. Remove the image to send.`
    : attachNote;

  const renderComposer = () => (
    <div className={`composer${limitHit ? " is-disabled" : ""}${input.length > MAX_CHARS ? " is-over" : ""}`} data-allow-image-upload={allowImageUpload ? "true" : "false"}>
      {attachments.length || attachBusy || attachHint ? (
        <div className="attach-row" data-testid="attach-row">
          {attachments.map((a, i) => (
            <span key={`${a.name}-${i}`} className={`attach-chip is-${a.kind}`}>
              {a.kind === "image" ? <img src={a.dataUrl} alt="" className="attach-thumb" /> : <span className="attach-ext">{(a.name.split(".").pop() || "file").slice(0, 4).toUpperCase()}</span>}
              <span className="attach-name">{a.name}</span>
              <button type="button" className="attach-x" aria-label={`Remove ${a.name}`} onClick={() => setAttachments((xs) => xs.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
          {attachBusy ? <span className="attach-busy">Reading…</span> : null}
          {attachHint ? <span className="attach-note" role="status">{attachHint}</span> : null}
        </div>
      ) : null}
      <label className="sr-only" htmlFor="citadel-composer">Message Citad3L</label>
      <textarea
        id="citadel-composer"
        ref={taRef}
        className="composer-input"
        rows={showEmpty ? 2 : 1}
        placeholder={limitHit ? limitPlaceholder : hermesReady ? (showEmpty ? "Ask Hermes anything — it remembers you…" : "Reply to Hermes…") : videoReady ? (showEmpty ? "Describe the video you want…" : "Describe another video…") : imageReady ? (showEmpty ? "Describe the image you want…" : "Describe another image…") : !chatReady ? (selectedModel?.comingSoon ? `${selectedModel.name} is coming soon` : `${selectedModel?.name ?? "This model"} isn't available in chat yet`) : showEmpty ? "Ask anything — strategy, code, research…" : "Reply to Citad3L…"}
        value={input}
        disabled={limitHit || !composerReady}
        onChange={(e) => setInput(e.target.value)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.files ?? []);
          if (files.length && (caps.files || caps.images)) { e.preventDefault(); void addFiles(files); }
        }}
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
          {projectChip}
          {hermesReady ? (
            <label className="hermes-brain" title="Which brain Hermes uses for this message. Premium brains cost more and share a daily limit.">
              <span className="sr-only">Hermes brain</span>
              <select value={hermesBrain} onChange={(e) => setHermesBrain(e.target.value)} disabled={streaming} data-testid="hermes-brain">
                {hermesBrains.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}{b.premium ? " ★" : ""}</option>
                ))}
              </select>
            </label>
          ) : null}
          {swarmAvailable ? (
            <>
            <button
              type="button"
              className={`swarm-toggle${swarm ? " is-on" : ""}`}
              aria-pressed={swarm}
              data-testid="swarm-toggle"
              disabled={streaming}
              title="V1 plans, Fast workers run up to 3 tasks, V1 writes the answer. Uses 4 replies of allowance."
              onClick={() => setSwarm((s) => !s)}
            >
              Swarm
            </button>
            {swarm ? (
              <button
                type="button"
                className={`swarm-toggle${skills.webSearch ? " is-on" : ""}`}
                aria-pressed={!!skills.webSearch}
                data-testid="swarm-websearch-toggle"
                disabled={streaming}
                title="Look up current facts during this Swarm run. Off by default. Adds up to 4 search calls on top of the 4 Swarm replies."
                onClick={() => setSkills((prev) => ({ ...prev, webSearch: !prev.webSearch }))}
              >
                Web search
              </button>
            ) : null}
            </>
          ) : null}
        </div>
        <div className="composer-right">
          {(caps.files || caps.images) && (chatReady || videoReady) ? (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple={!!caps.files}
                hidden
                accept={caps.files && caps.images ? `image/png,image/jpeg,image/webp,image/gif,${DOC_ACCEPT}` : caps.images ? "image/png,image/jpeg,image/webp,image/gif" : DOC_ACCEPT}
                data-testid="attach-input"
                onChange={(e) => { if (e.target.files) void addFiles(e.target.files); }}
              />
              <button
                type="button"
                className="attach-btn"
                data-testid="attach-button"
                onClick={() => fileRef.current?.click()}
                disabled={streaming || attachBusy || limitHit}
                aria-label={videoReady ? "Attach a picture to start the video" : caps.images ? "Attach images or files" : "Attach files"}
                title={videoReady ? "Attach a picture to start the video from" : caps.images ? "Attach images, PDFs, Word or text files" : "Attach PDFs, Word or text files"}
              >
                <IClip />
              </button>
            </>
          ) : null}
          {canDictate && (!streaming || listening) ? (
            <button
              type="button"
              className={`mic-btn${listening ? " is-on" : ""}`}
              onClick={toggleDictation}
              disabled={!listening && (limitHit || !composerReady)}
              aria-pressed={listening}
              aria-label={listening ? "Stop voice input" : "Speak your message"}
              title={listening ? "Listening… tap to stop" : "Speak your message"}
              data-testid="mic-button"
            >
              <IMic />
            </button>
          ) : null}
          <ModelPicker models={catalog} selectedId={selectedModel?.id ?? defaultModelId} onChange={chooseModel} disabled={streaming} placement={showEmpty ? "down" : "up"} skills={skills} onSkillsChange={setSkills} guest={!signedIn} swarm={swarm && swarmAvailable} canOpenSettings={canOpenSettings} onOpenSettings={() => setSettingsOpen(true)} />
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
      {micNotice ? (
        <div className="notice mic-notice" role="dialog" aria-label="Voice input" data-testid="mic-notice">
          <p>{MIC_DISCLOSURE}</p>
          <div className="mic-notice-actions">
            <button type="button" className="btn btn-primary" onClick={acceptMic}>Turn on voice input</button>
            <button type="button" className="btn btn-secondary" onClick={() => setMicNotice(false)}>Not now</button>
          </div>
        </div>
      ) : null}
      {selectedModel?.comingSoon ? (
        <p className="composer-hint">{selectedModel.name} is coming soon.</p>
      ) : selectedModel?.requiresClientE2EE ? (
        <p className="composer-hint">Private: encrypted to a verified secure enclave. Text only; no images, web search or Swarm.</p>
      ) : hermesReady ? (
        <p className="composer-hint">Hermes remembers you across chats. {brainInfo(hermesBrain).premium ? `${brainInfo(hermesBrain).label} is premium (★): costs more per message, 10 premium a day.` : `${brainInfo(hermesBrain).label} is a low-cost brain.`} Start a message with /{hermesBrains.map((b) => b.key).filter((k) => k !== hermesBrain).slice(0, 3).join(", /")} … to switch for one message.</p>
      ) : videoReady ? (
        <p className="composer-hint">Citad3L Video renders a 5-second 720p clip with sound from your description (Max plan, a few clips per day). It takes a minute or two.</p>
      ) : imageReady ? (
        <p className="composer-hint">Citad3L Image turns your prompt into a picture. You can also type /image from a chat model.</p>
      ) : swarm && swarmAvailable ? (
        <p className="composer-hint">Swarm on — uses 4 replies of allowance. V1 plans, Fast workers, V1 writes the answer. Web search is off by default; turn it on to look up current facts (up to 4 search calls). Extended thinking stays off.</p>
      ) : null}
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

  const startUpgradeCheckout = async (plan: "pro" | "max") => {
    trackFunnelEvent("image_upgrade_clicked", "/chat");
    if (!signedIn) {
      window.location.assign("/login?next=/pricing");
      return;
    }
    if (!billingOpen) {
      window.location.assign("/pricing#plans");
      return;
    }
    setUpgradeBusy(true);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = (await r.json().catch(() => null)) as { url?: string } | null;
      if (r.ok && j?.url) {
        window.location.assign(j.url);
        return;
      }
      window.location.assign("/pricing#plans");
    } catch {
      window.location.assign("/pricing#plans");
    } finally {
      setUpgradeBusy(false);
    }
  };

  const upgradeCardEl = upgradeCard ? (
    <div className="upgrade-card chat-upgrade-card" role="region" aria-label="Upgrade for Citad3L Image" data-testid="image-upgrade-card">
      <div className="upgrade-card-top">
        <div>
          <p className="upgrade-card-title">{upgradeCard === "max" ? "Citad3L Video comes with Max ($50/mo)" : "Citad3L Image comes with Pro ($20/mo)"}</p>
          <p className="upgrade-card-sub">
            {upgradeCard === "max"
              ? "Render 5-second 720p clips with sound, plus Image, Private mode, and higher allowances."
              : "Generate detailed pictures with clean, legible text, plus Private mode, Swarm, and 25 replies every 5 hours."}
          </p>
        </div>
        <button type="button" className="upgrade-card-close" aria-label="Dismiss upgrade card" onClick={() => setUpgradeCard(null)}>×</button>
      </div>
      <div className="upgrade-card-actions">
        {signedIn && billingOpen ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={upgradeBusy} onClick={() => void startUpgradeCheckout(upgradeCard)}>
            {upgradeBusy ? "Opening checkout…" : upgradeCard === "max" ? "Upgrade to Max — $50/mo" : "Upgrade to Pro — $20/mo"}
          </button>
        ) : (
          <a className="btn btn-primary btn-sm" href={signedIn ? "/pricing#plans" : "/login?next=/pricing"} onClick={() => trackFunnelEvent("image_upgrade_clicked", "/chat")}>
            {signedIn ? (upgradeCard === "max" ? "See Max ($50/mo)" : "See Pro ($20/mo)") : "Sign in to upgrade"}
          </a>
        )}
        <a className="btn btn-secondary btn-sm" href="/pricing#plans">Compare plans</a>
      </div>
    </div>
  ) : null;

  const showSoftSave = !signedIn && !limitHit && !softSaveDismissed && usage.used >= 2 && messages.some((m) => m.role === "assistant" && m.status === "complete");
  const softSaveEl = showSoftSave ? (
    <div className="try-soft-save chat-soft-save" role="region" aria-label="Save your chat">
      <div className="try-soft-save-row">
        <p className="try-soft-save-text"><strong>Save your chat</strong> — sign in with a 6-digit email code to keep this thread and unlock Private mode.</p>
        <div className="try-soft-save-actions">
          <a className="btn btn-secondary btn-sm" href="/login?next=/chat" onClick={() => trackFunnelEvent("soft_save_clicked", "/chat")}>Save my chat</a>
          <button type="button" className="try-soft-save-dismiss" onClick={() => setSoftSaveDismissed(true)}>Not now</button>
        </div>
      </div>
    </div>
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
      {banner.upgrade && (
        <a className="btn btn-primary btn-xs" href="/pricing#plans">
          See plans
        </a>
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
          {(() => {
            const sp = splitMessage(m.content);
            return (
              <>
                {sp.images.length || sp.files.length ? (
                  <div className="msg-attachments">
                    {sp.images.map((n, i) => <span key={`i${i}`} className="attach-chip is-image is-sent">🖼 <span className="attach-name">{n}</span></span>)}
                    {sp.files.map((f, i) => <span key={`f${i}`} className="attach-chip is-file is-sent" title={`${f.chars.toLocaleString("en-US")} characters`}>📄 <span className="attach-name">{f.name}</span></span>)}
                  </div>
                ) : null}
                {sp.text ? <div className="msg-bubble">{sp.text}</div> : null}
              </>
            );
          })()}
          <div className="msg-actions">
            <button type="button" className={`msg-action${copiedId === m.id ? " is-done" : ""}`} onClick={() => void copyMsg(m)} aria-label="Copy message">
              {copiedId === m.id ? <ICheck /> : <ICopy />}
            </button>
          </div>
        </div>
      );
    }
    const live = m.status === "streaming";
    const checkFailed = m.content.startsWith("We couldn't finish the safety check");
    const refused = m.content.startsWith("This message was blocked") || m.content.startsWith("This request isn't allowed.");
    const canRetry = (checkFailed || !refused) && !streaming && (m.id === lastAssistantId || m.status === "error" || m.status === "stopped" || checkFailed);
    const contCount = continuedMap[m.id] ?? 0;
    return (
      <div key={m.id} className={`msg msg-assistant${isLast ? " is-last" : ""}`}>
        <div className="msg-head">
          <span className="msg-avatar"><Rook size={14} /></span>
          Citad3L
          {contCount > 0 && (
            <span
              className="msg-continued"
              data-testid="msg-continued"
              title={`Auto-continued ${contCount} ${contCount === 1 ? "time" : "times"} to finish a long reply`}
            >
              continued{contCount > 1 ? ` ×${contCount}` : ""}
            </span>
          )}
        </div>
        <div className="msg-body" aria-live={live ? "polite" : undefined} aria-busy={live}>
          {live && !m.content ? (
            <span className="thinking" aria-label={statusLine ?? "Thinking"}>{statusLine ? <span className="thinking-label">{statusLine}</span> : null}<i /><i /><i /></span>
          ) : (
            <>
              {m.content && <Markdown content={m.content} />}
              {live && <span className="stream-caret" aria-hidden="true" />}
            </>
          )}
        </div>
        {m.status === "stopped" && <div className="msg-status">Stopped — not charged.</div>}
        {m.status === "complete" && truncatedMap[m.id] && (
          <div className="msg-status">Reached max auto-continue limit — reply may be incomplete.</div>
        )}
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
              <>
                <button type="button" className={`msg-action${copiedId === m.id ? " is-done" : ""}`} onClick={() => void copyMsg(m)}>
                  {copiedId === m.id ? <ICheck /> : <ICopy />}
                  {copiedId === m.id ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className="msg-action"
                  onClick={() => downloadMsgZip(m)}
                  data-testid="msg-download-zip"
                  title="Download all code blocks and this answer as a zip"
                >
                  <IZip /> Download zip
                </button>
                <button
                  type="button"
                  className="msg-action"
                  onClick={() => downloadMsgPdf(m)}
                  data-testid="msg-download-pdf"
                  title="Download this answer as a PDF"
                >
                  <IPdf /> Download PDF
                </button>
                {signedIn && (exportsMap[m.id]?.zip || exportsMap[m.id]?.pdf) ? (
                  <>
                    {exportsMap[m.id]?.zip && (
                      <a
                        className="msg-action"
                        href={exportsMap[m.id]!.zip!.url}
                        download={exportsMap[m.id]!.zip!.filename}
                        data-testid="msg-signed-zip"
                        title="Signed 24-hour zip link"
                      >
                        <IZip /> 24h zip
                      </a>
                    )}
                    {exportsMap[m.id]?.pdf && (
                      <a
                        className="msg-action"
                        href={exportsMap[m.id]!.pdf!.url}
                        download={exportsMap[m.id]!.pdf!.filename}
                        data-testid="msg-signed-pdf"
                        title="Signed 24-hour PDF link"
                      >
                        <IPdf /> 24h PDF
                      </a>
                    )}
                  </>
                ) : signedIn ? (
                  <button
                    type="button"
                    className="msg-action"
                    onClick={() => void createServerExportLinks(m)}
                    disabled={exportingId === m.id}
                    data-testid="msg-create-export-links"
                    title="Create signed 24-hour zip and PDF download links"
                  >
                    <IZip /> {exportingId === m.id ? "Saving…" : "24h links"}
                  </button>
                ) : null}
              </>
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
                <div className="side-skel" aria-label="Loading chats">
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              ) : groups.length === 0 ? (
                <div className="side-empty">{search ? "No chats match your search." : signedIn ? "No conversations yet. Your first one starts the record." : "Nothing saved yet. Guest chats stay in this tab until you sign up."}</div>
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
            <a href={signedIn ? "/account/usage" : "/pricing"} className="usage-meter-link">
              <UsageMeters usage={usage} compact />
            </a>
            {signedIn ? (
              <a className="side-user" href="/account">
                <span className="nav-avatar">{initials(userLabel)}</span>
                <span className="side-user-name">{userLabel}</span>
              </a>
            ) : (
              <a className="side-user" href="/login?next=/chat">
                <span className="nav-avatar">?</span>
                <span className="side-user-name">Sign in</span>
              </a>
            )}
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
                {formatGreeting(greeting, name)}
              </h1>
              <p className="chat-greeting-sub">
                {currentProject ? `Working in ${currentProject.name}.` : greeting.sub || "Strategy, robotics, AI security — or whatever's on your mind."}
              </p>
              {bannerEl && <div style={{ width: "100%", marginTop: 20 }}>{bannerEl}</div>}
              {upgradeCardEl && <div style={{ width: "100%", marginTop: 16 }}>{upgradeCardEl}</div>}
              {limitHit && <div style={{ width: "100%", marginTop: 20 }}><LimitReached usage={usage} /></div>}
              {renderComposer()}
              <div className="chat-empty-meta">
                <MockBadge provider={provider} />
                <div className="row">
                  {charCount}
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
                  {upgradeCardEl}
                  {softSaveEl}
                  {computerPending && (
                    <div className="notice notice-warn" role="alertdialog" aria-label="Confirm @computer action" data-testid="computer-confirm" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ flex: 1, minWidth: 200 }}><strong>@computer wants to:</strong> {computerPending.action}. {computerPending.reason}</span>
                      <button type="button" className="btn btn-primary btn-xs" onClick={() => confirmComputer(true)}>Confirm</button>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => confirmComputer(false)}>Cancel</button>
                    </div>
                  )}
                  {limitHit && <LimitReached usage={usage} />}
                  {renderComposer()}
                  <div className="composer-meta">
                    <MockBadge provider={provider} />
                    <span className="spacer" />
                    {charCount}
                    <span className={`usage-chip${usageCls}`} title="Failed or stopped replies aren't charged. This is your remaining allowance before you send.">{usageText}</span>
                  </div>
                  <div className="composer-hint">
                    <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span>+<span className="kbd">Enter</span> new line · <span className="kbd">Esc</span> to stop
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {settingsOpen && (
        <ModelSettingsModal
          modelId={selectedModel?.id ?? defaultModelId}
          modelName={selectedModel?.name ?? "Citad3L"}
          onClose={() => setSettingsOpen(false)}
        />
      )}

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
