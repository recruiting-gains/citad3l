"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildZip } from "@/lib/downloads";
import {
  countPhotoSlots,
  photoToDataUrl,
  prefersShareSheet,
  renderGraphic,
  supportsDownloadAttribute,
} from "@/lib/html-image";

export type PreviewImage = { url: string; file: File; width: number; height: number };

/** Wait this long after the last change before drawing (so a streaming reply isn't re-rendered on every token). */
export const PREVIEW_DEBOUNCE_MS = 1200;
/** Don't auto-render enormous blocks; the Save button still works on demand. */
export const MAX_AUTO_PREVIEW_CHARS = 250_000;

/**
 * Draws an HTML/SVG design from a reply into PNGs (one per carousel slide) once the block stops changing.
 * Images live only in this tab (object URLs); nothing is uploaded.
 */
export function useGraphicPreview(code: string, lang: string, baseName: string, enabled: boolean) {
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [photos, setPhotos] = useState<string[]>([]);
  const urls = useRef<string[]>([]);
  const run = useRef(0);

  const render = useCallback(async (): Promise<PreviewImage[]> => {
    const id = ++run.current;
    setStatus("rendering");
    try {
      const out = await renderGraphic(code, lang, { baseName, photos });
      const next = out.map((r) => ({ url: URL.createObjectURL(r.blob), file: new File([r.blob], r.name, { type: "image/png" }), width: r.width, height: r.height }));
      if (id !== run.current) { next.forEach((n) => URL.revokeObjectURL(n.url)); return next; }
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = next.map((n) => n.url);
      setImages(next);
      setStatus("ready");
      return next;
    } catch {
      if (id === run.current) setStatus("error");
      return [];
    }
  }, [code, lang, baseName, photos]);

  useEffect(() => {
    if (!enabled || code.length > MAX_AUTO_PREVIEW_CHARS || !code.trim()) return;
    const t = window.setTimeout(() => { void render(); }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [enabled, code, render]);

  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const addPhotos = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = await Promise.all(Array.from(files).slice(0, 20).filter((f) => f.type.startsWith("image/")).map((f) => photoToDataUrl(f).catch(() => "")));
    setPhotos(picked.filter(Boolean));
  }, []);

  return { images, status, render, photos, addPhotos, photoSlots: enabled ? countPhotoSlots(code) : 0 };
}

function anchorDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Save one or more PNGs the best way this device allows:
 * phone/tablet with a share sheet → share the PNG file(s) ("Save Image" puts them in Photos on iPhone);
 * desktop → download (several slides become one zip);
 * no download support or share refused → the save sheet (open in a new tab, press and hold, or download).
 * Returns "fallback" when the caller should show the save sheet.
 */
export async function savePngs(images: PreviewImage[], zipName: string): Promise<"done" | "cancelled" | "fallback"> {
  if (!images.length) return "fallback";
  const files = images.map((i) => i.file);
  if (prefersShareSheet(files[0])) {
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    const shareable = nav.canShare?.({ files }) ? files : [files[0]];
    try {
      await navigator.share({ files: shareable });
      return shareable.length === files.length ? "done" : "fallback";
    } catch (e) {
      return (e as Error)?.name === "AbortError" ? "cancelled" : "fallback";
    }
  }
  if (!supportsDownloadAttribute()) return "fallback";
  if (images.length === 1) {
    anchorDownload(images[0].url, images[0].file.name);
    return "done";
  }
  const entries = await Promise.all(images.map(async (i) => ({ name: i.file.name, content: new Uint8Array(await i.file.arrayBuffer()) })));
  const zip = buildZip(entries);
  const url = URL.createObjectURL(new Blob([zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer], { type: "application/zip" }));
  anchorDownload(url, zipName);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "done";
}

/** Save sheet: share again (fresh tap), open the PNG in a new tab, press-and-hold, or download. */
export function SaveImageSheet({ images, onClose }: { images: PreviewImage[]; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const canShare = images.length > 0 && prefersShareSheet(images[0].file);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined" || !images.length) return null;
  const shareOne = async (img: PreviewImage) => {
    try { await navigator.share({ files: [img.file] }); } catch (e) {
      if ((e as Error)?.name !== "AbortError") setNote("Sharing didn't open. Tap Open image, then press and hold it to save.");
    }
  };
  return createPortal(
    <div className="img-save-overlay" role="dialog" aria-modal="true" aria-label="Save image" data-testid="save-image-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="img-save-list">
        {images.map((img, i) => (
          <figure key={img.url} className="img-save-item">
            <img src={img.url} alt={images.length > 1 ? `Slide ${i + 1}` : "Your image"} width={img.width} height={img.height} />
            <figcaption className="img-save-actions">
              {canShare && <button type="button" className="btn btn-primary btn-sm" onClick={() => void shareOne(img)}>Save image</button>}
              <a className="btn btn-secondary btn-sm" href={img.url} target="_blank" rel="noopener" data-testid="open-image">Open image</a>
              <a className="btn btn-secondary btn-sm" href={img.url} download={img.file.name}>Download</a>
            </figcaption>
          </figure>
        ))}
      </div>
      <p>{note ?? "Press and hold an image to save it to Photos, or open it in a new tab."}</p>
      <div className="img-save-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}

/** The rendered design shown in the chat: one image, or a swipeable strip of carousel slides with Save buttons. */
export function GraphicStrip({
  images,
  status,
  photoSlots,
  photoCount,
  onAddPhotos,
  onSave,
  onRetry,
}: {
  images: PreviewImage[];
  status: "idle" | "rendering" | "ready" | "error";
  photoSlots: number;
  photoCount: number;
  onAddPhotos: (files: FileList | null) => void;
  onSave: (images: PreviewImage[]) => void;
  onRetry: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (status === "idle" && !images.length) return null;
  const many = images.length > 1;
  return (
    <div className="graphic-preview" data-testid="graphic-preview">
      {status === "error" && !images.length ? (
        <p className="graphic-note">Couldn&apos;t draw this design as an image. <button type="button" className="graphic-link" onClick={onRetry}>Try again</button></p>
      ) : !images.length ? (
        <p className="graphic-note"><span className="spinner" /> Drawing your image…</p>
      ) : (
        <div className={many ? "graphic-strip" : "graphic-single"}>
          {images.map((img, i) => (
            <figure key={img.url} className="graphic-slide" data-testid="graphic-slide">
              <img src={img.url} alt={many ? `Slide ${i + 1} of ${images.length}` : "Rendered design"} width={img.width} height={img.height} />
              <figcaption>
                <span className="graphic-size tnum">{many ? `${i + 1}/${images.length} · ` : ""}{img.width}×{img.height}</span>
                <button type="button" className="graphic-btn" data-testid="graphic-save-one" onClick={() => onSave([img])}>Save</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="graphic-actions">
          <button type="button" className="btn btn-primary btn-sm" data-testid="graphic-save-all" onClick={() => onSave(images)}>
            {many ? `Save all ${images.length} slides` : "Save image"}
          </button>
          {photoSlots > 0 && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} data-testid="graphic-add-photos">
                {photoCount ? "Change photos" : `Add photos (${photoSlots})`}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onAddPhotos(e.target.files); e.target.value = ""; }} />
            </>
          )}
          {status === "rendering" && <span className="graphic-note"><span className="spinner" /> Updating…</span>}
        </div>
      )}
    </div>
  );
}
