/**
 * Voice input via the browser's Web Speech API (Chrome/Edge/Samsung on Android, Safari on iPhone/Mac).
 * Speech is turned into text in the composer; nothing is sent until the user taps Send. Where the API is missing
 * (e.g. Firefox) the mic button is hidden and the phone keyboard's own dictation mic still works.
 */
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecCtor = new () => Rec;

function ctor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return ctor() !== null;
}

export type Dictation = { stop(): void; abort(): void };

/** Joins every result so far (final + interim) into one transcript. Pure, for tests. */
export function transcriptOf(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  let out = "";
  for (let i = 0; i < results.length; i++) out += results[i][0]?.transcript ?? "";
  return out.replace(/\s+/g, " ").trim();
}

export function createDictation(o: { lang: string; onText: (text: string) => void; onEnd: (error: string | null) => void }): Dictation | null {
  const C = ctor();
  if (!C) return null;
  let rec: Rec;
  try {
    rec = new C();
  } catch {
    return null;
  }
  let error: string | null = null;
  let ended = false;
  rec.lang = o.lang;
  rec.interimResults = true;
  rec.continuous = false; // one utterance; tap again for more
  rec.maxAlternatives = 1;
  rec.onresult = (e) => o.onText(transcriptOf(e.results));
  rec.onerror = (e) => { error = e.error; };
  rec.onend = () => {
    if (ended) return;
    ended = true;
    o.onEnd(error);
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}

/** First-use disclosure (pre-deploy review, blocker 4). Shown and accepted BEFORE the recognizer ever starts. */
export const MIC_CONSENT_KEY = "c3l-mic-consent-v1";
export const MIC_DISCLOSURE =
  "Voice input uses your browser's built-in speech recognition. Your speech audio may be sent to Apple's (Safari, iPhone) or Google's (Chrome, Android) speech services to turn it into text. Citad3L only gets the text, and nothing is sent until you tap Send.";

type KV = Pick<Storage, "getItem" | "setItem">;
export function hasMicConsent(store: KV | null | undefined): boolean {
  try { return store?.getItem(MIC_CONSENT_KEY) === "yes"; } catch { return false; }
}
export function giveMicConsent(store: KV | null | undefined): void {
  try { store?.setItem(MIC_CONSENT_KEY, "yes"); } catch { /* private mode: ask again next time */ }
}

/**
 * Binds one recognition session to one draft in one chat. cancel() (send, chat switch, sign-out, page hide, unmount)
 * makes every late callback from that session a no-op, so a result can't land in another chat or refill a sent draft.
 */
export function createDraftBinding() {
  let current = 0;
  return {
    start(convId: string | null) { return { id: ++current, convId }; },
    cancel() { current++; },
    live(b: { id: number; convId: string | null }, convIdNow: string | null) { return b.id === current && b.convId === convIdNow; },
  };
}
