"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  HOLIDAY_BODY_AFTER,
  HOLIDAY_BODY_BEFORE,
  HOLIDAY_BODY_PRICES,
  HOLIDAY_BODY_STRONG,
  HOLIDAY_CODE,
  HOLIDAY_CODE_AFTER,
  HOLIDAY_CODE_BEFORE,
  HOLIDAY_FIRST_MONTH,
  HOLIDAY_HEADLINE_LEAD,
  HOLIDAY_HEADLINE_REST,
} from "@/lib/holiday";

function Bow() {
  return (
    <svg viewBox="-12 -12 24 24" focusable="false" aria-hidden="true">
      <g transform="translate(0 -1.2)" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-0.6 -0.4C-2.6 -4.6 -9.6 -7.2 -10 -3.2C-10.3 0.2 -4.6 0.9 -0.6 -0.4" />
        <path d="M0.6 -0.4C2.6 -4.6 9.6 -7.2 10 -3.2C10.3 0.2 4.6 0.9 0.6 -0.4" />
        <path d="M-0.9 0.9C-2 3.6 -3.6 6.2 -5.4 8.8" />
        <path d="M0.9 0.9C2 3.6 3.6 6.2 5.4 8.8" />
        <circle r="2" fill="#3fd8ff" stroke="#15191e" strokeWidth="1.8" paintOrder="stroke" />
      </g>
    </svg>
  );
}

function Lights() {
  return (
    <>
      <div className="hb-surface" aria-hidden="true">
        <span className="hb-edge hb-edge--cw" />
      </div>
      <div className="hb-spot" aria-hidden="true" />
      <div className="hb-rim" aria-hidden="true">
        <span className="hb-rim-glow" />
        <span className="hb-sweep" />
        <span className="hb-beam hb-beam--cw" />
      </div>
    </>
  );
}

function Body() {
  return (
    <p className="hb-body">
      {HOLIDAY_BODY_BEFORE}
      <strong>{HOLIDAY_BODY_STRONG}</strong>
      {HOLIDAY_BODY_AFTER}
      <span className="hb-body-prices"> {HOLIDAY_BODY_PRICES}</span>
    </p>
  );
}

function SeePlansIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 2.5v9M3 7.5l4 4 4-4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 7h9M8 4l3 3-3 3" />
    </svg>
  );
}

export function HolidayBanner({ compact = false, showCode = true }: { compact?: boolean; showCode?: boolean }) {
  const titleId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const timerRef = useRef(0);
  const [copyState, setCopyState] = useState<"copied" | "error" | null>(null);

  useEffect(() => {
    const card = rootRef.current;
    if (!card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;

    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          card.toggleAttribute("data-paused", !entry?.isIntersecting);
        }, { rootMargin: "120px 0px" })
      : null;
    io?.observe(card);

    const step = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      card.style.setProperty("--hb-px", `${x.toFixed(1)}px`);
      card.style.setProperty("--hb-py", `${y.toFixed(1)}px`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.4 ? requestAnimationFrame(step) : 0;
    };
    const allowLight = (e: PointerEvent) => e.pointerType !== "touch" && fine.matches && !reduce.matches;
    const onEnter = (e: PointerEvent) => {
      if (!allowLight(e)) return;
      const r = card.getBoundingClientRect();
      x = tx = e.clientX - r.left;
      y = ty = e.clientY - r.top;
      if (raf) cancelAnimationFrame(raf);
      step();
      card.classList.add("is-lit");
    };
    const onMove = (e: PointerEvent) => {
      if (!card.classList.contains("is-lit")) return;
      const r = card.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => card.classList.remove("is-lit");
    const onReduce = () => { if (reduce.matches) card.classList.remove("is-lit"); };

    card.addEventListener("pointerenter", onEnter);
    card.addEventListener("pointermove", onMove, { passive: true });
    card.addEventListener("pointerleave", onLeave);
    reduce.addEventListener("change", onReduce);

    return () => {
      io?.disconnect();
      card.removeEventListener("pointerenter", onEnter);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      reduce.removeEventListener("change", onReduce);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(timerRef.current);
      card.classList.remove("is-lit");
    };
  }, []);

  function announce(msg: string) {
    const status = statusRef.current;
    if (!status) return;
    status.textContent = "";
    requestAnimationFrame(() => { status.textContent = msg; });
  }

  async function copyCode() {
    const text = codeRef.current?.textContent?.trim() || HOLIDAY_CODE;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      announce(`Code ${text} copied.`);
    } catch {
      const code = codeRef.current;
      const sel = window.getSelection();
      if (code && sel) {
        const range = document.createRange();
        range.selectNodeContents(code);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setCopyState("error");
      announce("Copy was blocked. The code is selected — press Control C or Command C to copy it.");
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopyState(null), 2400);
  }

  const title = (
    <h2 id={titleId} className="hb-title">
      <span>{HOLIDAY_HEADLINE_LEAD}</span> <span>{HOLIDAY_HEADLINE_REST}</span>
    </h2>
  );

  return (
    <aside
      ref={rootRef}
      className={`checkout-banner holiday${compact ? " holiday--compact" : ""}`}
      aria-labelledby={titleId}
      data-testid={compact ? "holiday-banner-compact" : "holiday-banner"}
    >
      <Lights />
      {compact ? null : (
        <>
          <div className="hb-ribbon" aria-hidden="true"><span className="hb-drip" /></div>
          <span className="hb-seal" aria-hidden="true"><Bow /></span>
        </>
      )}

      <div className="hb-copy">
        {compact ? <span className="hb-seal" aria-hidden="true"><Bow /></span> : null}
        {title}
        <Body />
      </div>

      <div className="hb-ledger">
        {compact ? (
          <ul className="hb-chips">
            <li className="hb-chip"><span className="p">Pro</span> <b>${HOLIDAY_FIRST_MONTH.pro}</b> <ArrowIcon /> <span>then $20 per month</span></li>
            <li className="hb-chip"><span className="p">Max</span> <b>${HOLIDAY_FIRST_MONTH.max}</b> <ArrowIcon /> <span>then $50 per month</span></li>
          </ul>
        ) : (
          <>
            <dl className="hb-rows">
              <div className="hb-row">
                <dt className="hb-plan">Pro</dt>
                <dd className="hb-now"><span className="hb-amt">${HOLIDAY_FIRST_MONTH.pro}</span><span className="hb-when">first month</span></dd>
                <dd className="hb-then">then <b>$20</b> per month</dd>
              </div>
              <div className="hb-row">
                <dt className="hb-plan">Max</dt>
                <dd className="hb-now"><span className="hb-amt">${HOLIDAY_FIRST_MONTH.max}</span><span className="hb-when">first month</span></dd>
                <dd className="hb-then">then <b>$50</b> per month</dd>
              </div>
            </dl>
            {showCode ? (
              <div className="hb-code">
                <p>{HOLIDAY_CODE_BEFORE}<code ref={codeRef}>{HOLIDAY_CODE}</code>{HOLIDAY_CODE_AFTER}</p>
                <button
                  type="button"
                  className="hb-clip"
                  data-state={copyState ?? undefined}
                  onClick={copyCode}
                >
                  <span className="sr-only">Copy code {HOLIDAY_CODE}</span>
                  <svg className="i-copy" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" /><path d="M3 10.5V4.1A1.1 1.1 0 0 1 4.1 3h6.4" /></svg>
                  <svg className="i-ok" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.6l3 3 6-7.2" /></svg>
                  <svg className="i-err" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M8 4v5" /><circle cx="8" cy="11.8" r=".6" fill="currentColor" /></svg>
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="hb-actions">
        {compact ? (
          <Link className="hb-cta" href="/pricing#plans">See plans <SeePlansIcon /></Link>
        ) : (
          <a className="hb-cta" href="#all-plans">See plans <SeePlansIcon /></a>
        )}
      </div>

      <p ref={statusRef} className="sr-only" role="status" aria-live="polite" />
    </aside>
  );
}
