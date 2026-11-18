# CRITIQUE

- **Skip link pushes the layout down.** "Skip to content" renders as visible text above the nav on every screen, pushing everything about 18px lower than the reference. I'm hiding it until it receives keyboard focus, with a selector that matches the link regardless of which class it ended up with.
- **The account width isn't applied.** Tailwind v4's own `.container` utility beats our `@layer components` max-width, so the Account page renders at 1216px instead of 880px. I'm moving the account wrapper to its own `.page-wrap` class.
- **Chat / Agents is untruthful.** The toggle advertises a feature Citad3L doesn't have. I'm replacing it with the real project picker in the same left slot of the composer bar. This keeps the reference's left-control / right-engine-pill rhythm and makes the folder control useful.
- **The meta row duplicated the project picker.** With the picker now inside the composer, the row under it becomes mock badge (left) plus usage chip (right). This mirrors the reference's "left note / right connectors" spacing.
- **The trial placeholder was wrong.** A trial account at 0 left saw "You've used this period's allowance". It now reads "Trial replies used — see plans to keep chatting". Paid plans say "Monthly allowance used — resets on your billing date".
- **The keyboard hint was clipped and wrapped.** It is shortened to "Enter to send · Shift+Enter new line · Esc to stop", gets more bottom padding on desktop, and is hidden on phones and touch devices.
- **The Recents skeleton overflowed.** Its bars ran past the 272px sidebar because of the scroll area's negative margins. It now has its own padded, clipped class with fixed bar widths.
- **The Recents empty state** now matches the reference: one quiet line at the same indent as the section heading.
- **The phone composer was too dense.** I tightened padding and the height of the bar controls. The project chip is capped so it can't push the engine pill off-screen. The meta row stays on one line with smaller badges, with the usage chip's text shortened via `.usage-chip`.
- **The send button was too heavy.** Its disabled state looked like the reference's grey circle, but the enabled ink fill read heavy, so I matched the reference's softer 36px circle. The engine pill gets the reference's lighter grey.
- **The empty-state greeting sat too low.** Top padding is reduced so the rook and greeting land where the reference's mark and greeting do. The sub-line is softened.
- **The Account "Trial / Trial" duplicate is removed.** The status badge only shows for non-trial plans or problem states.
- **Account upgrade buttons are now disabled when billing isn't configured.** The amber notice already explains why, so the buttons no longer promise a checkout that can't happen.
- **Project cards** get the reference's tile radius, padding and quieter meta, plus a hover state for the edit/delete actions.
- **The mock badge stays visible** in every chat output state: the empty state, the thread dock and Account.

=== FILE: app/round2-app.css ===
```css
/* Skip link: hidden until focused, whatever class it carries */
body > a[href="#main"]:not(:focus),
body > a[href="#content"]:not(:focus),
body > a[href="#main-content"]:not(:focus),
.skip-link:not(:focus) {
  position: absolute !important; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; top: 0; left: 0;
}

@layer components {
  /* page wrapper that Tailwind's .container can't override */
  .page-wrap { width: 100%; margin-inline: auto; padding-inline: var(--gutter); max-width: calc(1376px + var(--gutter) * 2); }
  .page-wrap.account-page { max-width: calc(880px + var(--gutter) * 2); }

  /* ---- chat empty state ---- */
  .chat-empty { padding-top: clamp(28px, 7vh, 80px); }
  .chat-emblem { width: 64px; height: 64px; }
  .chat-greeting { margin-top: 20px; }
  .chat-greeting-sub { margin-top: 8px; font-size: var(--t-base); color: var(--fg-3); }
  .chat-empty .composer { margin-top: 24px; }
  .chat-empty-meta { padding: 10px 6px 0; }

  /* ---- composer ---- */
  .composer { gap: 12px; padding: 16px 12px 12px 18px; border-color: transparent; }
  .composer:focus-within { border-color: var(--line-2); }
  .composer .project-chip { height: 34px; padding: 0 12px; border: 1px solid var(--line-2); background: transparent; }
  .composer button.project-chip:hover { background: var(--surface-2); }
  .composer .project-chip.is-set { background: var(--surface-2); border-color: transparent; }
  .engine-pill { background: #e6e6e6; }
  .send-btn:disabled { background: #e2e2e2; color: var(--fg-3); }
  .composer-meta { flex-wrap: nowrap; padding: 0 4px; }
  .composer-dock { padding-bottom: 18px; }
  .composer-dock-inner { gap: 8px; }
  .composer-hint { line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ---- sidebar ---- */
  .side-skel { display: flex; flex-direction: column; gap: 12px; padding: 10px 10px 4px; overflow: hidden; }
  .side-skel .skeleton { height: 10px; border-radius: 6px; }
  .side-skel .skeleton:nth-child(1) { width: 78%; }
  .side-skel .skeleton:nth-child(2) { width: 56%; }
  .side-skel .skeleton:nth-child(3) { width: 68%; }
  .side-empty { padding: 4px 10px; font-size: var(--t-sm); }
  .side-foot { padding-bottom: 4px; }

  /* ---- projects ---- */
  .project-card { border-radius: var(--r-lg); padding: 18px 18px 16px; min-height: 176px; }
  .project-actions { opacity: 0.55; transition: opacity var(--dur-1); }
  .project-card:hover .project-actions, .project-card:focus-within .project-actions { opacity: 1; }
  .project-new { border-radius: var(--r-lg); min-height: 176px; }

  /* ---- account ---- */
  .account-card { border-radius: var(--r-xl); }

  @media (hover: none) { .composer-hint { display: none; } }

  @media (max-width: 640px) {
    .chat-empty { padding-top: 20px; }
    .chat-greeting { font-size: 30px; margin-top: 14px; }
    .composer { gap: 10px; padding: 12px 10px 10px 14px; }
    .composer-input { min-height: 24px; }
    .composer .project-chip { height: 32px; max-width: 132px; padding: 0 10px; }
    .engine-pill { height: 32px; }
    .send-btn, .stop-btn { width: 34px; height: 34px; }
    .composer-meta { gap: 6px; }
    .composer-meta .badge-mock, .composer-meta .usage-chip,
    .chat-empty-meta .badge-mock, .chat-empty-meta .usage-chip { height: 22px; padding: 0 8px; font-size: var(--t-xs); }
    .chat-empty-meta { flex-wrap: wrap; justify-content: flex-start; padding: 8px 2px 0; }
    .composer-hint { display: none; }
    .composer-dock { padding-bottom: 10px; }
  }
}
```
=== END FILE ===

=== PATCH: components/chat/ChatWorkspace.tsx ===
<<<FIND
const IChat = () => <Ic size={15}><path d="M2.5 4A1.5 1.5 0 0 1 4 2.5h8A1.5 1.5 0 0 1 13.5 4v6A1.5 1.5 0 0 1 12 11.5H6.5L3.5 14v-2.5A1.5 1.5 0 0 1 2.5 10z" /></Ic>;
const IBot = () => <Ic size={15}><rect x="2.5" y="4.5" width="11" height="8.5" rx="2.5" /><path d="M8 2v2.5M6 8.5v.5M10 8.5v.5" /></Ic>;
>>>REPLACE
<<<END
<<<FIND
  const composer = (
>>>REPLACE
  const limitPlaceholder =
    usage.plan === "trial" ? "Trial replies used — see plans to keep chatting" : "Monthly allowance used — resets on your billing date";

  const renderComposer = () => (
<<<END
<<<FIND
        placeholder={limitHit ? "You've used this period's allowance" : showEmpty ? "Ask anything — strategy, code, research…" : "Reply to Citad3L…"}
>>>REPLACE
        placeholder={limitHit ? limitPlaceholder : showEmpty ? "Ask anything — strategy, code, research…" : "Reply to Citad3L…"}
<<<END
<<<FIND
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
>>>REPLACE
          {projectChip}
<<<END
<<<FIND
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
>>>REPLACE
              {limitHit && <div style={{ width: "100%", marginTop: 20 }}><LimitReached usage={usage} /></div>}
              {renderComposer()}
              <div className="chat-empty-meta">
                <MockBadge provider={provider} />
                <div className="row">
                  {charCount}
                  <span className={`usage-chip${usageCls}`}>{usageText}</span>
                </div>
              </div>
<<<END
<<<FIND
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
>>>REPLACE
                  {limitHit && <LimitReached usage={usage} />}
                  {renderComposer()}
                  <div className="composer-meta">
                    <MockBadge provider={provider} />
                    <span className="spacer" />
                    {charCount}
                    <span className={`usage-chip${usageCls}`} title="Failed or stopped replies aren't charged">{usageText}</span>
                  </div>
                  <div className="composer-hint">
                    <span className="kbd">Enter</span> to send · <span className="kbd">Shift</span>+<span className="kbd">Enter</span> new line · <span className="kbd">Esc</span> to stop
                  </div>
<<<END
<<<FIND
                <div className="skel-stack" style={{ padding: "8px 10px" }}>
                  <div className="skeleton skel-line w-80" />
                  <div className="skeleton skel-line w-60" />
                  <div className="skeleton skel-line w-80" />
                </div>
>>>REPLACE
                <div className="side-skel" aria-label="Loading chats">
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
<<<END
=== END PATCH ===

=== PATCH: components/account/AccountView.tsx ===
<<<FIND
    <main className="container account-page page-main">
>>>REPLACE
    <main className="page-wrap account-page page-main">
<<<END
<<<FIND
                <StatusBadge status={usage.status} />
>>>REPLACE
                {usage.plan !== "trial" && <StatusBadge status={usage.status} />}
<<<END
<<<FIND
                <button type="button" className="btn btn-primary btn-sm" onClick={() => checkout("pro")} disabled={busy !== null}>
>>>REPLACE
                <button type="button" className="btn btn-primary btn-sm" onClick={() => checkout("pro")} disabled={busy !== null || !billingConfigured}>
<<<END
<<<FIND
onClick={() => checkout("max")} disabled={busy !== null}>
>>>REPLACE
onClick={() => checkout("max")} disabled={busy !== null || !billingConfigured}>
<<<END
=== END PATCH ===