"use client";

import { useState } from "react";
import { IMAGE_PROMPT_CARD_LABEL, imagePromptCardModel } from "@/lib/image-prompt";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Renders one ```image-prompt fence as a card with a one-tap copy button. */
export function ImagePromptCard({ body }: { body: string }) {
  const model = imagePromptCardModel(body);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const label = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy prompt";
  const copy = async () => {
    if (!model.copyText) return;
    const ok = await writeClipboard(model.copyText);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 1600);
  };
  return (
    <article className="image-prompt-card" data-testid="image-prompt-card">
      <header className="image-prompt-head">
        <p className="image-prompt-label">{IMAGE_PROMPT_CARD_LABEL}</p>
        <button
          type="button"
          className={`btn btn-primary image-prompt-copy${state === "copied" ? " is-done" : ""}`}
          data-testid="image-prompt-copy"
          onClick={() => void copy()}
          disabled={!model.copyText}
          aria-label={label}
        >
          <span aria-live="polite">{label}</span>
        </button>
      </header>
      {model.prompt ? <div className="image-prompt-body">{model.prompt}</div> : null}
      {model.negative ? (
        <div className="image-prompt-negative">
          <span className="image-prompt-negative-k">Negative</span>
          {model.negative}
        </div>
      ) : null}
    </article>
  );
}
