=== CSS CONTINUATION ===
```css
  .chats-btn:hover { background: var(--surface-3); }
  .chat-topbar-title {
    flex: 1; min-width: 0; font-size: var(--t-base); font-weight: 500; color: var(--fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .chat-topbar-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .chat-scroll { position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; }
  .thread { width: 100%; max-width: calc(var(--thread-w) + 48px); margin: 0 auto; padding: 24px 24px 32px; display: flex; flex-direction: column; gap: 28px; }

  /* ---------- Chat empty state ---------- */
  .chat-empty {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; align-items: center;
    padding: clamp(32px, 9vh, 96px) 24px 32px;
  }
  .chat-empty-inner { width: 100%; max-width: var(--thread-w); display: flex; flex-direction: column; align-items: center; }
  .chat-emblem { display: grid; place-items: center; width: 72px; height: 72px; color: var(--ink); animation: rise var(--dur-3) var(--ease) both; }
  .chat-greeting {
    margin-top: 18px; font-size: var(--t-4xl); line-height: 1.08; font-weight: 500;
    letter-spacing: -0.04em; text-align: center; text-wrap: balance;
    animation: rise var(--dur-3) var(--ease) 60ms both;
  }
  .chat-greeting-sub { margin-top: 10px; font-size: var(--t-md); color: var(--fg-2); text-align: center; }
  .chat-empty .composer { margin-top: 28px; width: 100%; }
  .chat-empty-meta { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 10px 0; font-size: var(--t-13); color: var(--fg-2); }
  .suggestions-title { width: 100%; margin-top: 40px; margin-bottom: 12px; font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.02em; }
  .suggestions { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .suggestion {
    display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; align-items: start;
    padding: 14px; border: 1px solid var(--line); border-radius: var(--r-md);
    background: var(--bg); text-align: left; color: var(--fg);
    transition: border-color var(--dur-2) var(--ease), background-color var(--dur-2), transform var(--dur-1);
  }
  .suggestion:hover { border-color: var(--line-3); background: var(--surface-3); }
  .suggestion:active { transform: scale(0.99); }
  .suggestion-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--surface); color: var(--ink); }
  .suggestion-kicker { font-size: var(--t-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-3); }
  .suggestion-text { margin-top: 3px; font-size: var(--t-13); line-height: 1.45; color: var(--fg); }
  .chip-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
    border-radius: var(--r-pill); border: 1px solid var(--line-2); background: var(--bg);
    font-size: var(--t-13); color: var(--fg-2); transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-1);
  }
  .chip:hover { background: var(--surface-3); color: var(--fg); border-color: var(--line-3); }

  /* ---------- Messages ---------- */
  .msg { display: flex; flex-direction: column; min-width: 0; animation: rise var(--dur-2) var(--ease) both; }
  .msg-user { align-items: flex-end; }
  .msg-bubble {
    max-width: min(85%, 600px); padding: 10px 16px; border-radius: 20px 20px 6px 20px;
    background: var(--surface); color: var(--fg); font-size: var(--t-md); line-height: 1.55;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }
  .msg-assistant { align-items: stretch; }
  .msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: var(--t-13); font-weight: 500; color: var(--fg); }
  .msg-avatar { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; border: 1px solid var(--line); color: var(--ink); background: var(--bg); }
  .msg-body { font-size: var(--t-md); line-height: 1.65; color: var(--fg); min-width: 0; }
  .msg-actions { display: flex; align-items: center; gap: 2px; margin-top: 8px; opacity: 0.0; transition: opacity var(--dur-1); }
  .msg:hover .msg-actions, .msg:focus-within .msg-actions, .msg.is-last .msg-actions, .msg-actions.is-visible { opacity: 1; }
  .msg-user .msg-actions { justify-content: flex-end; }
  .msg-action {
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border-radius: 8px;
    font-size: var(--t-sm); color: var(--fg-3); transition: background-color var(--dur-1), color var(--dur-1);
  }
  .msg-action:hover:not(:disabled) { background: var(--surface); color: var(--fg); }
  .msg-action:disabled { opacity: 0.4; }
  .msg-action.is-done { color: var(--ok-fg); }
  .msg-status { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: var(--t-sm); color: var(--fg-3); }
  .msg-status.is-error { color: var(--danger); }
  .msg-error {
    margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 12px; border: 1px solid var(--danger-line); border-radius: var(--r-md);
    background: var(--danger-bg); color: var(--danger-fg); font-size: var(--t-13);
  }
  .stream-caret {
    display: inline-block; width: 8px; height: 1.05em; margin-left: 2px; vertical-align: -0.15em;
    background: var(--fg); border-radius: 1px; animation: caret 1s steps(1) infinite;
  }
  .thinking { display: inline-flex; align-items: center; gap: 4px; height: 24px; }
  .thinking i { width: 6px; height: 6px; border-radius: 50%; background: var(--fg-3); animation: bounce 1.2s var(--ease) infinite; }
  .thinking i:nth-child(2) { animation-delay: 0.15s; }
  .thinking i:nth-child(3) { animation-delay: 0.3s; }

  .jump-latest {
    position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 5;
    display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
    border-radius: var(--r-pill); background: var(--bg); border: 1px solid var(--line-2);
    box-shadow: var(--shadow-chip); font-size: var(--t-13); color: var(--fg);
    animation: fade-in var(--dur-2) var(--ease);
  }
  .jump-latest:hover { background: var(--surface-3); }

  /* ---------- Composer ---------- */
  .composer-dock { position: relative; padding: 0 24px 14px; background: linear-gradient(to bottom, rgba(255,255,255,0), #fff 28px); }
  .composer-dock-inner { max-width: var(--thread-w); margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
  .composer {
    display: flex; flex-direction: column; gap: 10px;
    padding: 16px 16px 12px 20px; border-radius: var(--r-xl);
    background: var(--surface); border: 1px solid var(--line-2);
    transition: border-color var(--dur-1), background-color var(--dur-1), box-shadow var(--dur-2);
  }
  .composer:focus-within { border-color: var(--line-3); background: #efefef; box-shadow: 0 0 0 4px rgba(20, 20, 20, 0.04); }
  .composer.is-disabled { opacity: 0.6; }
  .composer.is-over { border-color: var(--danger-line); }
  .composer-input {
    width: 100%; min-height: 28px; max-height: 240px; resize: none; padding: 0; margin: 0;
    border: 0; outline: none; background: transparent; color: var(--fg);
    font: inherit; font-size: var(--t-lg); line-height: 1.5; letter-spacing: -0.01em;
  }
  .composer-input::placeholder { color: var(--fg-3); }
  .composer-input:focus-visible { outline: none; }
  .composer-bar { display: flex; align-items: center; gap: 8px; }
  .composer-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .composer-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .seg { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border-radius: var(--r-pill); border: 1px solid var(--line-2); background: transparent; }
  .seg-btn {
    display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
    border-radius: var(--r-pill); font-size: var(--t-base); color: var(--fg-2);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .seg-btn:hover:not(:disabled) { color: var(--fg); }
  .seg-btn[aria-pressed="true"], .seg-btn.is-active { background: var(--surface-2); color: var(--fg); }
  .seg-btn:disabled { color: var(--fg-4); }
  .engine-pill {
    display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px 0 6px;
    border-radius: var(--r-pill); background: var(--surface-2); font-size: var(--t-13); font-weight: 500; color: var(--fg); white-space: nowrap;
  }
  .engine-pill-mark { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #fff; color: var(--ink); }
  .send-btn {
    display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 0;
    background: var(--ink); color: #fff; transition: background-color var(--dur-1), opacity var(--dur-1), transform var(--dur-1);
  }
  .send-btn:hover:not(:disabled) { background: var(--ink-3); }
  .send-btn:active:not(:disabled) { transform: scale(0.94); }
  .send-btn:disabled { background: var(--surface-2); color: var(--fg-3); opacity: 1; }
  .stop-btn { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--ink); color: #fff; }
  .stop-btn:hover { background: var(--ink-3); }
  .stop-btn i { width: 11px; height: 11px; border-radius: 2px; background: currentColor; }
  .composer-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 0 6px; font-size: var(--t-sm); color: var(--fg-3); }
  .composer-meta .spacer { min-width: 4px; }
  .char-count { font-family: var(--font-mono); font-size: var(--t-xs); color: var(--fg-3); font-variant-numeric: tabular-nums; }
  .char-count.is-near { color: var(--amber-fg); }
  .char-count.is-over { color: var(--danger); font-weight: 600; }
  .usage-chip {
    display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px;
    border-radius: var(--r-pill); background: var(--surface); color: var(--fg-2);
    font-size: var(--t-sm); font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .usage-chip.is-low { background: var(--amber-bg); color: var(--amber-fg); }
  .usage-chip.is-out { background: var(--danger-bg); color: var(--danger); }
  .project-chip {
    display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; max-width: 220px;
    border-radius: var(--r-pill); color: var(--fg-2); font-size: var(--t-13);
    transition: background-color var(--dur-1), color var(--dur-1);
  }
  .project-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.project-chip:hover, a.project-chip:hover { background: var(--surface); color: var(--fg); }
  .project-chip.is-set { background: var(--surface); color: var(--fg); }
  .composer-hint { text-align: center; font-size: var(--t-xs); color: var(--fg-3); }

  /* ---------- Menus / popovers ---------- */
  .popover-anchor { position: relative; }
  .menu {
    position: absolute; z-index: 40; min-width: 220px; max-height: 320px; overflow-y: auto;
    padding: 6px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--bg);
    box-shadow: var(--shadow-pop); animation: pop-in var(--dur-1) var(--ease);
  }
  .menu-up { bottom: calc(100% + 6px); left: 0; }
  .menu-down { top: calc(100% + 6px); right: 0; }
  .menu-label { padding: 8px 10px 4px; font-size: var(--t-xs); color: var(--fg-3); }
  .menu-item {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 34px; padding: 0 10px;
    border-radius: 8px; font-size: var(--t-13); color: var(--fg); text-align: left; white-space: nowrap;
  }
  .menu-item:hover, .menu-item:focus-visible { background: var(--surface); outline: none; }
  .menu-item[aria-checked="true"]::after { content: ""; margin-left: auto; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); }
  .menu-item.is-danger { color: var(--danger); }
  .menu-sep { height: 1px; margin: 4px 0; background: var(--line); }

  /* ---------- Banners / notices ---------- */
  .banner {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--r-md);
    border: 1px solid var(--line-2); background: var(--surface-3); font-size: var(--t-13); color: var(--fg-2);
    animation: fade-in var(--dur-2) var(--ease);
  }
  .banner > svg { flex: none; }
  .banner-text { flex: 1; min-width: 0; }
  .banner-text strong { color: var(--fg); font-weight: 500; }
  .banner-error { background: var(--danger-bg); border-color: var(--danger-line); color: var(--danger-fg); }
  .banner-error strong { color: var(--danger-fg); }
  .banner-warn { background: var(--amber-bg); border-color: var(--amber-line); color: var(--amber-fg); }
  .banner-warn strong { color: var(--amber-fg); }
  .banner-offline { background: var(--ink); border-color: var(--ink); color: var(--on-ink-2); }
  .banner-offline strong { color: #fff; }
  .banner-offline .btn-secondary { background: #2e2e2e; color: #fff; }
  .notice { padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--line-2); background: var(--surface-3); font-size: var(--t-13); line-height: 1.5; color: var(--fg-2); }
  .notice strong { color: var(--fg); font-weight: 500; }
  .notice-warn { background: var(--amber-bg); border-color: var(--amber-line); color: var(--amber-fg); }
  .notice-warn strong { color: var(--amber-fg); }
  .notice-danger { background: var(--danger-bg); border-color: var(--danger-line); color: var(--danger-fg); }
  .notice-danger strong { color: var(--danger-fg); }
  .notice-ok { background: var(--ok-bg); border-color: #bfe8cd; color: var(--ok-fg); }

  /* ---------- Markdown ---------- */
  .md { font-size: var(--t-md); line-height: 1.65; color: var(--fg); overflow-wrap: anywhere; }
  .md > :first-child { margin-top: 0; }
  .md > :last-child { margin-bottom: 0; }
  .md p { margin: 0 0 14px; }
  .md h1, .md h2, .md h3, .md h4 { margin: 26px 0 10px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
  .md h1 { font-size: 24px; }
  .md h2 { font-size: 20px; }
  .md h3 { font-size: 17px; }
  .md h4 { font-size: 15px; }
  .md ul, .md ol { margin: 0 0 14px; padding-left: 22px; }
  .md li { margin: 4px 0; }
  .md li::marker { color: var(--fg-3); }
  .md li > p { margin: 0 0 6px; }
  .md ul ul, .md ol ol, .md ul ol, .md ol ul { margin: 4px 0; }
  .md a { text-decoration: underline; text-decoration-color: var(--line-3); text-underline-offset: 3px; }
  .md a:hover { text-decoration-color: currentColor; }
  .md strong { font-weight: 600; }
  .md blockquote { margin: 0 0 14px; padding: 2px 0 2px 14px; border-left: 2px solid var(--line-3); color: var(--fg-2); }
  .md hr { border: 0; border-top: 1px solid var(--line); margin: 22px 0; }
  .md img { max-width: 100%; border-radius: var(--r-sm); }
  .md :not(pre) > code {
    font-family: var(--font-mono); font-size: 0.86em; padding: 1px 5px; border-radius: 5px;
    background: var(--surface); border: 1px solid var(--line); color: var(--fg);
  }
  .md-table-wrap { margin: 0 0 14px; overflow-x: auto; border: 1px solid var(--line); border-radius: var(--r-md); }
  .md table { width: 100%; border-collapse: collapse; font-size: var(--t-13); }
  .md th, .md td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
  .md th { font-weight: 500; background: var(--surface-3); color: var(--fg); }
  .md tr:last-child td { border-bottom: 0; }
  .md input[type="checkbox"] { margin: 0 6px 0 0; accent-color: var(--ink); }

  /* ---------- Code blocks ---------- */
  .code-block { margin: 0 0 16px; border-radius: var(--r-md); overflow: hidden; background: #0d1014; border: 1px solid #1c2128; }
  .code-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    height: 36px; padding: 0 6px 0 14px; background: #141920; border-bottom: 1px solid #1c2128;
  }
  .code-lang { font-family: var(--font-mono); font-size: var(--t-xs); letter-spacing: 0.04em; text-transform: lowercase; color: #8a96a8; }
  .code-copy {
    display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: 7px;
    font-size: var(--t-sm); color: #aab4c3; transition: background-color var(--dur-1), color var(--dur-1);
  }
  .code-copy:hover { background: #222a35; color: #fff; }
  .code-copy.is-done { color: var(--art-cyan); }
  .code-block pre { margin: 0; padding: 14px 16px 16px; overflow-x: auto; scrollbar-width: thin; scrollbar-color: #2b3340 transparent; }
  .code-block pre code, .code-block code.hljs {
    display: block; background: transparent; padding: 0; border: 0;
    font-family: var(--font-mono); font-size: 13px; line-height: 1.6; color: #dfe5ee; tab-size: 2; white-space: pre;
  }

  /* syntax tokens — original "console" theme */
  .hljs-comment, .hljs-quote { color: #6b7686; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag, .hljs-meta .hljs-keyword { color: #a99cff; }
  .hljs-string, .hljs-regexp, .hljs-addition, .hljs-meta .hljs-string { color: #7ee8c8; }
  .hljs-number, .hljs-symbol, .hljs-bullet, .hljs-link { color: #ffc46b; }
  .hljs-title, .hljs-title.function_, .hljs-section { color: #7fc8ff; }
  .hljs-title.class_, .hljs-type, .hljs-built_in, .hljs-class .hljs-title { color: #ffd98a; }
  .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable, .hljs-property { color: #ff9f8a; }
  .hljs-params { color: #dfe5ee; }
  .hljs-tag, .hljs-name, .hljs-selector-id, .hljs-selector-class { color: #8fb8ff; }
  .hljs-meta, .hljs-subst, .hljs-operator, .hljs-punctuation { color: #9aa6b8; }
  .hljs-deletion { color: #ff8a8a; background: rgba(255, 90, 90, 0.08); }
  .hljs-addition { background: rgba(94, 230, 208, 0.08); }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }

  /* ---------- Forms ---------- */
  .field { display: flex; flex-direction: column; gap: 6px; }
  .label { font-size: var(--t-13); font-weight: 500; color: var(--fg); }
  .label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .input, .textarea, .select {
    width: 100%; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-2);
    background: var(--bg); color: var(--fg); font: inherit; font-size: var(--t-base); outline: none;
    transition: border-color var(--dur-1), box-shadow var(--dur-1);
  }
  .input, .select { height: 42px; }
  .textarea { min-height: 120px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
  .input::placeholder, .textarea::placeholder { color: var(--fg-3); }
  .input:focus, .textarea:focus, .select:focus { border-color: var(--fg); box-shadow: 0 0 0 3px rgba(20, 20, 20, 0.08); }
  .input[aria-invalid="true"], .textarea[aria-invalid="true"] { border-color: var(--danger); }
  .input-filled { background: var(--surface); border-color: transparent; }
  .field-hint { font-size: var(--t-sm); color: var(--fg-3); }
  .field-error { font-size: var(--t-sm); color: var(--danger); }
  .form { display: flex; flex-direction: column; gap: 16px; }
  .form-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

  /* ---------- Dialog ---------- */
  .dialog-backdrop {
    position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px;
    background: rgba(10, 10, 10, 0.32); animation: fade-in var(--dur-2) var(--ease);
  }
  .dialog {
    width: 100%; max-width: 480px; max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 24px; border-radius: var(--r-xl); background: var(--bg); box-shadow: var(--shadow-pop);
    animation: pop-in var(--dur-2) var(--ease);
  }
  .dialog-lg { max-width: 600px; }
  .dialog-title { font-size: var(--t-xl); font-weight: 500; letter-spacing: -0.025em; line-height: 1.2; }
  .dialog-body { margin-top: 8px; font-size: var(--t-base); line-height: 1.55; color: var(--fg-2); }
  .dialog-form { margin-top: 20px; }
  .dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 22px; }

  /* ---------- Toasts ---------- */
  .toast-stack {
    position: fixed; z-index: 100; left: 50%; bottom: 24px; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; width: max-content; max-width: calc(100vw - 32px);
  }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 10px;
    min-height: 40px; padding: 8px 8px 8px 14px; border-radius: var(--r-md);
    background: var(--ink); color: #fff; box-shadow: var(--shadow-pop);
    font-size: var(--t-13); animation: toast-in var(--dur-2) var(--ease);
  }
  .toast-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--art-cyan); flex: none; }
  .toast-warn .toast-dot { background: var(--art-amber); }
  .toast-error .toast-dot { background: #ff6b55; }
  .toast-ok .toast-dot { background: var(--live); }
  .toast-close { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; color: #9a9a9a; }
  .toast-close:hover { background: #2a2a2a; color: #fff; }

  /* ---------- Skeletons + states ---------- */
  .skeleton {
    position: relative; overflow: hidden; border-radius: 8px; background: var(--surface);
  }
  .skeleton::after {
    content: ""; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent);
    animation: shimmer 1.4s infinite;
  }
  .skel-line { height: 12px; }
  .skel-line.w-40 { width: 40%; }
  .skel-line.w-60 { width: 60%; }
  .skel-line.w-80 { width: 80%; }
  .skel-line.w-100 { width: 100%; }
  .skel-bubble { align-self: flex-end; width: 46%; height: 40px; border-radius: 20px; }
  .skel-block { height: 120px; border-radius: var(--r-md); }
  .skel-stack { display: flex; flex-direction: column; gap: 10px; }
  .state {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    padding: 56px 24px; text-align: center;
  }
  .state-emblem { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--r-lg); border: 1px solid var(--line); box-shadow: var(--shadow-chip); color: var(--ink); background: #fff; margin-bottom: 6px; }
  .state-title { font-size: var(--t-xl); font-weight: 500; letter-spacing: -0.025em; }
  .state-body { max-width: 420px; font-size: var(--t-base); line-height: 1.55; color: var(--fg-2); text-wrap: balance; }
  .state-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px; }

  /* ---------- Projects ---------- */
  .projects-page { padding-bottom: 64px; }
  .projects-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .project-card {
    position: relative; display: flex; flex-direction: column; gap: 10px; min-height: 180px;
    padding: 18px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg);
    transition: border-color var(--dur-2) var(--ease), box-shadow var(--dur-2) var(--ease);
  }
  .project-card:hover, .project-card:focus-within { border-color: var(--line-3); box-shadow: var(--shadow-soft); }
  .project-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .project-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--surface); color: var(--ink); flex: none; }
  .project-name { font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.02em; line-height: 1.25; overflow-wrap: anywhere; }
  .project-name a::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
  .project-instructions {
    font-size: var(--t-13); line-height: 1.5; color: var(--fg-2);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .project-instructions.is-empty { color: var(--fg-3); font-style: italic; }
  .project-meta { margin-top: auto; display: flex; align-items: center; gap: 10px; font-size: var(--t-sm); color: var(--fg-3); }
  .project-actions { position: relative; z-index: 1; display: flex; gap: 2px; }
  .project-new {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 180px;
    border: 1px dashed var(--line-3); border-radius: var(--r-md); color: var(--fg-2); font-size: var(--t-base);
    transition: background-color var(--dur-1), color var(--dur-1), border-color var(--dur-1);
  }
  .project-new:hover { background: var(--surface-3); color: var(--fg); border-color: var(--fg-4); }
  .empty-state { border: 1px dashed var(--line-3); border-radius: var(--r-lg); }

  /* ---------- Account ---------- */
  .account-page { max-width: calc(880px + var(--gutter) * 2); padding-bottom: 64px; }
  .account-grid { display: grid; gap: 16px; }
  .account-card { padding: 24px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--bg); }
  .account-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .account-card-title { font-size: var(--t-lg); font-weight: 500; letter-spacing: -0.02em; }
  .account-card-sub { margin-top: 4px; font-size: var(--t-13); color: var(--fg-2); }
  .account-plan { display: flex; align-items: center; gap: 14px; }
  .account-plan-name { font-size: var(--t-2xl); font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; }
  .account-row {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 0; border-top: 1px solid var(--line); font-size: var(--t-base);
  }
  .account-row:first-of-type { border-top: 0; padding-top: 0; }
  .account-row-label { font-weight: 500; }
  .account-row-desc { margin-top: 2px; font-size: var(--t-13); color: var(--fg-2); }
  .account-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .avatar-lg { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--ink); color: #fff; font-size: 15px; font-weight: 600; flex: none; }
  .meter { display: flex; flex-direction: column; gap: 8px; }
  .meter-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .meter-value { font-size: var(--t-3xl); font-weight: 500; letter-spacing: -0.035em; line-height: 1; font-variant-numeric: tabular-nums; }
  .meter-value small { font-size: var(--t-base); font-weight: 400; letter-spacing: 0; color: var(--fg-3); margin-left: 4px; }
  .meter-bar { position: relative; height: 8px; border-radius: var(--r-pill); background: var(--surface); overflow: hidden; }
  .meter-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--ink); transition: width var(--dur-3) var(--ease); }
  .meter-fill.is-warn { background: var(--amber-solid); }
  .meter-fill.is-full { background: var(--danger); }
  .meter-foot { display: flex; justify-content: space-between; gap: 12px; font-size: var(--t-sm); color: var(--fg-3); }
  .meter-sm .meter-bar { height: 4px; }
  .danger-zone { border-color: var(--danger-line); }
  .danger-zone .account-card-title { color: var(--danger-fg); }
  .confirm-input { font-family: var(--font-mono); }

  /* ---------- Login ---------- */
  .auth-page {
    min-height: calc(100dvh - var(--nav-h)); display: grid; place-items: center;
    padding: 48px var(--gutter); background: radial-gradient(1200px 500px at 50% -10%, #f6f6f6, #fff 70%);
  }
  .auth-card {
    width: 100%; max-width: 400px; padding: 32px; border: 1px solid var(--line); border-radius: var(--r-xl);
    background: var(--bg); box-shadow: var(--shadow-soft); display: flex; flex-direction: column; gap: 20px;
  }
  .auth-head { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
  .auth-emblem { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--r-lg); border: 1px solid var(--line); box-shadow: var(--shadow-chip); color: var(--ink); background: #fff; }
  .auth-title { font-size: 26px; font-weight: 500; letter-spacing: -0.035em; line-height: 1.15; }
  .auth-sub { font-size: var(--t-base); color: var(--fg-2); }
  .auth-providers { display: flex; flex-direction: column; gap: 8px; }
  .provider-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 44px;
    border-radius: var(--r-pill); border: 1px solid var(--line-2); background: var(--bg);
    font-size: var(--t-base); font-weight: 500; color: var(--fg);
    transition: background-color var(--dur-1), border-color var(--dur-1), transform var(--dur-1);
  }
  .provider-btn:hover:not(:disabled) { background: var(--surface-3); border-color: var(--line-3); }
  .provider-btn:active:not(:disabled) { transform: scale(0.99); }
  .provider-btn:disabled { opacity: 0.5; }
  .auth-divider { display: flex; align-items: center; gap: 12px; font-size: var(--t-sm); color: var(--fg-3); }
  .auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  .demo-box { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: var(--r-md); border: 1px dashed var(--amber-line); background: #fffbf1; }
  .demo-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--t-sm); font-weight: 500; color: var(--amber-fg); }
  .auth-foot { font-size: var(--t-sm); line-height: 1.5; color: var(--fg-3); text-align: center; }
  .auth-foot a { color: var(--fg-2); text-decoration: underline; text-underline-offset: 2px; }

  /* ---------- Art animation hooks (used by Art.tsx) ---------- */
  .art-sweep { transform-box: view-box; transform-origin: center; animation: sweep 6s linear infinite; }
  .art-blink { animation: blink 2.4s ease-in-out infinite; }
  .art-blink.d1 { animation-delay: 0.6s; }
  .art-blink.d2 { animation-delay: 1.2s; }
  .art-blink.d3 { animation-delay: 1.8s; }
  .art-flow { stroke-dasharray: 4 10; animation: dash 3s linear infinite; }
  .art-scan { animation: scan 5s var(--ease) infinite; }
  .art-float { animation: float 6s ease-in-out infinite; }
  .art-pulse { transform-box: fill-box; transform-origin: center; animation: pulse 3s ease-out infinite; }

  /* ---------- Responsive ---------- */
  @media (max-width: 1200px) {
    .tile-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .footer-grid { grid-template-columns: 1.4fr repeat(2, minmax(0, 1fr)); }
    .footer-grid > :first-child { grid-row: span 2; }
  }

  @media (max-width: 1024px) {
    .nav-links .nav-link { padding: 0 8px; }
    .model-layout { grid-template-columns: 320px minmax(0, 1fr); }
    .model-side-inner { width: 320px; }
    .pricing-grid { grid-template-columns: 1fr; max-width: 560px; margin-inline: auto; }
    .projects-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .models-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .carousel { grid-auto-columns: calc((100% - 20px) / 2); }
  }

  @media (max-width: 900px) {
    .nav-links, .nav-desktop { display: none; }
    .nav-burger { display: inline-grid; }
    .nav-inner { padding: 0 12px 0 16px; gap: 8px; }

    .model-strip { grid-template-columns: 1fr; }
    .model-strip-art { min-height: 240px; }
    .steps, .plan-teaser { grid-template-columns: 1fr; }

    .model-layout, .model-layout[data-collapsed="true"] { grid-template-columns: 1fr; }
    .model-side { position: static; height: auto; overflow: visible; border-right: 0; border-bottom: 1px solid var(--line); }
    .model-side-inner { width: 100%; max-width: 640px; margin: 0 auto; }
    .model-panel { padding: 48px 20px 64px; }
    .model-panel-toggle { display: none; }

    .chat-shell, .chat-shell[data-sidebar="closed"], .chat-shell[data-sidebar="open"] { grid-template-columns: minmax(0, 1fr); }
    .chat-sidebar {
      position: fixed; top: var(--nav-h); left: 0; bottom: 0; z-index: 60; width: min(86vw, var(--sidebar-w));
      border-right: 1px solid var(--line); box-shadow: var(--shadow-pop);
      transform: translateX(-102%); transition: transform var(--dur-3) var(--ease); visibility: hidden;
    }
    .chat-shell[data-sidebar="open"] .chat-sidebar { transform: none; visibility: visible; }
    .chat-shell[data-sidebar="open"] .chat-scrim {
      display: block; position: fixed; inset: var(--nav-h) 0 0 0; z-index: 59;
      background: rgba(0, 0, 0, 0.22); animation: fade-in var(--dur-2) var(--ease);
    }
    .side-inner { width: 100%; }
    .side-item-actions { opacity: 1; }
    .msg-actions { opacity: 1; }
  }

  @media (max-width: 640px) {
    .section { padding-block: 36px; }
    .section-lg { padding-block: 48px; }
    .hero { padding: 56px 0 48px; }
    .hero-sub { font-size: 16px; margin-top: 18px; }
    .hero-ctas { margin-top: 28px; }
    .hero-ctas .btn { flex: 1 1 160px; }
    .tile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .tile { min-height: 116px; padding: 14px; }
    .tile-title { padding-top: 20px; }
    .section-title, .h2 { font-size: 26px; }
    .page-title, .h1 { font-size: 32px; }
    .page-head { padding: 36px 0 20px; }
    .carousel { grid-auto-columns: 86%; gap: 12px; }
    .carousel-ctrls { display: none; }
    .model-strip-body { padding: 20px; }
    .mini-stat { padding: 10px; }
    .mini-stat-value { font-size: var(--t-lg); }
    .plan-card { padding: 20px; }
    .plan-amount { font-size: 38px; }
    .pricing-head { flex-direction: column; align-items: flex-start; }
    .projects-grid, .models-grid { grid-template-columns: 1fr; }
    .footer { margin-top: 64px; }
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 28px 16px; padding: 44px 0 32px; }
    .footer-grid > :first-child { grid-column: 1 / -1; grid-row: auto; }
    .footer-bottom { flex-direction: column; align-items: flex-start; }

    .chat-topbar { padding: 8px 12px 0; min-height: 48px; }
    .chat-empty { padding: 28px 16px 20px; }
    .chat-emblem { width: 56px; height: 56px; }
    .chat-greeting { font-size: var(--t-3xl); }
    .suggestions { grid-template-columns: 1fr; }
    .suggestions-title { margin-top: 28px; }
    .thread { padding: 16px 16px 24px; gap: 22px; }
    .msg-bubble { max-width: 90%; font-size: var(--t-base); }
    .msg-body, .md { font-size: var(--t-base); }
    .composer-dock { padding: 0 10px 10px; }
    .composer { padding: 12px 12px 10px 14px; border-radius: 18px; }
    .composer-input { font-size: 16px; }
    .engine-pill { padding: 0 10px 0 4px; }
    .engine-pill-label { display: none; }
    .seg-btn { padding: 0 10px; }
    .code-block pre code { font-size: 12.5px; }

    .account-card { padding: 18px; }
    .account-card-head, .account-row { flex-direction: column; align-items: stretch; }
    .account-row .btn { align-self: flex-start; }
    .auth-card { padding: 24px 20px; border: 0; box-shadow: none; }
    .dialog { padding: 20px; border-radius: var(--r-lg); }
    .dialog-actions .btn { flex: 1 1 auto; }
    .toast-stack { bottom: 16px; }
  }

  @media (max-width: 420px) {
    .nav-brand { font-size: 17px; }
    .chip-tile { margin-left: -0.26em; }
    .tile-sub { font-size: var(--t-sm); }
    .media-meta { grid-template-columns: 32px minmax(0, 1fr); }
    .media-aside { display: none; }
    .media-icon { width: 32px; height: 32px; }
    .mini-stats { grid-template-columns: 1fr; }
    .mini-stat + .mini-stat { border-left: 0; border-top: 1px solid var(--line); }
    .stat-grid { grid-template-columns: 1fr; }
    .stat-grid > .stat:nth-child(2n) { border-left: 0; }
    .model-side-inner { padding: 16px; }
    .model-cta-title { font-size: 24px; }
    .seg-btn .seg-label { display: none; }
    .composer-meta { padding: 0 2px; gap: 6px; }
    .project-chip { max-width: 140px; }
    .sheet-actions { grid-template-columns: 1fr; }
  }
}

/* =========================================================
   3. KEYFRAMES
   ========================================================= */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes sheet-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@keyframes pop-in { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes shimmer { to { transform: translateX(100%); } }
@keyframes caret { 50% { opacity: 0; } }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.45; } 40% { transform: translateY(-4px); opacity: 1; } }
@keyframes sweep { to { transform: rotate(360deg); } }
@keyframes blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes dash { to { stroke-dashoffset: -56; } }
@keyframes scan { 0% { transform: translateY(-10%); opacity: 0; } 15% { opacity: 0.8; } 85% { opacity: 0.8; } 100% { transform: translateY(110%); opacity: 0; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes pulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.2); opacity: 0; } }

/* =========================================================
   4. REDUCED MOTION
   ========================================================= */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .art-sweep, .art-blink, .art-flow, .art-scan, .art-float, .art-pulse, .stream-caret, .skeleton::after { animation: none !important; }
  .art-blink { opacity: 0.8; }
  .spinner { animation: spin 1.6s linear infinite !important; }
}
```
=== END CSS ===

CLASS MAP FOR PART B

**ChatWorkspace — shell and sidebar**
- `chat-shell[data-sidebar="open"|"closed"]` — grid root. It is a collapsible column on desktop and off-canvas at ≤900px. Set it to `closed` by default on phones.
- `chat-scrim` — click-to-close backdrop on phones. It is only shown while the sidebar is open.
- `chat-sidebar > side-inner` — sidebar container.
- `side-top`, `side-search` (wraps an icon and an `input`), `icon-btn` — search row plus collapse toggle.
- `side-action` — "New chat" and "New project" rows.
- `side-scroll` — scrolling region.
- `side-section` and `side-section-head` — the Projects/Recents header. When it is a toggle, use a button with `aria-expanded`.
- `side-list` — list container.
- `side-item[aria-current="page"]` (or `.is-active`) — a list row.
- `side-item-link` — the row's text, wrapped in a `span`.
- `side-item-actions` and `side-item-btn` (`.is-danger`) — hover actions.
- `side-rename` — inline rename input.
- `side-group-label` — Today / Previous 7 days / Older.
- `side-empty` — "Your chats show up here."
- `side-foot`, `side-user`, `side-user-name`, `nav-avatar` — user block.

**ChatWorkspace — main area**
- `chat-main` — main column.
- `chat-topbar`, `chats-btn` (mobile sidebar opener), `chat-topbar-title`, `chat-topbar-actions` — top bar.
- `chat-scroll` — message scroller.
- `thread` — centred column.
- `jump-latest` — floating "Jump to latest" pill.

**ChatWorkspace — empty state**
- `chat-empty > chat-empty-inner` — wrapper.
- `chat-emblem` — Rook at 64px.
- `chat-greeting` and `chat-greeting-sub` — greeting text.
- `chat-empty-meta` — project chip and MockBadge row under the composer.
- `suggestions-title` and `suggestions` — suggestion section.
- `suggestion` — a card containing `suggestion-icon`, `suggestion-kicker` and `suggestion-text`.
- `chip-row` and `chip` — compact chips.

**ChatWorkspace — messages**
- `msg msg-user` + `msg-bubble` — user message.
- `msg msg-assistant` (add `is-last` on the newest message) — assistant message.
- `msg-head`, `msg-avatar`, `msg-body` — assistant header and body. Put the Markdown output inside `msg-body`.
- `msg-actions` (`.is-visible`) — action row.
- `msg-action` (`.is-done` after a copy) — individual action buttons.
- `msg-status` (`.is-error`) — status line for stopped or failed messages.
- `msg-error` — inline error with retry.
- `stream-caret` — caret while streaming.
- `thinking` with three `<i>` — dots before the first delta.

**ChatWorkspace — composer**
- `composer-dock > composer-dock-inner` — docked wrapper at the bottom.
- `composer` (`.is-disabled`, `.is-over`) — the composer box.
- `composer-input` — the textarea.
- `composer-bar`, `composer-left`, `composer-right` — control row.
- `seg`, `seg-btn[aria-pressed]`, `seg-label` — Chat/Agents style toggle.
- `engine-pill`, `engine-pill-mark`, `engine-pill-label` — "Citad3L V1" pill.
- `send-btn` — send button.
- `stop-btn` with an `<i>` — stop button.
- `composer-meta` — meta row.
- `usage-chip` (`.is-low`, `.is-out`) — usage indicator.
- `project-chip` (`.is-set`) — project indicator.
- `char-count` (`.is-near`, `.is-over`) — character counter.
- `composer-hint` — hint line.
- `kbd` — keyboard key style.
- `spacer` — flexible gap.

**ChatWorkspace — menus**
- `popover-anchor` — positioning wrapper.
- `menu` + `menu-up` / `menu-down` — menu panel and direction.
- `menu-label`, `menu-item[aria-checked]` (`.is-danger`), `menu-sep` — menu contents.

**ChatWorkspace — states**
- `banner` — base banner. Variants: `banner-error`, `banner-warn`, `banner-offline` ("Connection lost").
- `banner-text` — banner copy.
- `skel-stack` + `skeleton` with `skel-line w-40|w-60|w-80|w-100` and `skel-bubble` — loading skeleton.
- `LimitReached` component (`limit-card`) — limit-reached card.
- `toast-stack` > `toast` (`toast-error`, `toast-warn`, `toast-ok`) with `toast-dot` and `toast-close` — toasts.
- `spinner` — loading spinner.

**Markdown**
- `md` — root wrapper.
- `md-table-wrap` — wrapper around each `table`.
- `code-block` — block container.
- `code-head` with `code-lang` and `code-copy` (`.is-done`) — block header.
- `pre > code.hljs` — the code itself.
- Token colours are covered by the built-in `hljs-*` theme.

**ProjectsView**
- `container projects-page` — page wrapper.
- `page-head`, `page-title`, `page-sub`, `page-toolbar` — page header.
- `projects-grid` — grid.
- `project-card` — card containing:
  - `project-card-head` and `project-icon`;
  - `project-name` with an `a`, whose `::after` makes the whole card clickable;
  - `project-instructions` (`.is-empty`);
  - `project-meta`;
  - `project-actions` (above the overlay).
- `project-new` — dashed create tile.
- `state empty-state` with `state-emblem`, `state-title`, `state-body`, `state-actions` — empty state.
- `dialog-backdrop > dialog` with `dialog-title`, `dialog-body`, `dialog-form`, `dialog-actions` — create/edit dialog.
- Form fields: `form`, `field`, `label`, `label-row`, `input`, `textarea`, `field-hint`, `field-error`, `form-actions`.

**AccountView**
- `container account-page` — page wrapper.
- `page-head` — page header.
- `account-grid` — grid.
- `account-card` (`danger-zone`) — card.
- `account-card-head`, `account-card-title`, `account-card-sub` — card header.
- `account-identity` and `avatar-lg` — identity block.
- `account-plan` and `account-plan-name` — current plan.
- Badges for plan status: `badge badge-ok`, `badge-warn`, `badge-danger`.
- `meter` (`meter-sm`) — usage meter wrapper.
- Meter parts: `meter-top`, `meter-value` (with `small`), `meter-bar > meter-fill` (`.is-warn`, `.is-full`), `meter-foot`.
- `notice` + `notice-warn` / `notice-danger` / `notice-ok` — cancel-at-period-end and past_due notices.
- `account-row`, `account-row-label`, `account-row-desc` — settings rows.
- `confirm-input` — typed delete confirmation.
- Buttons: `btn btn-primary` / `btn-secondary` / `btn-outline` / `btn-danger` / `btn-danger-quiet` / `btn-sm`.

**LoginView**
- `auth-page > auth-card` — page and card.
- `auth-head`, `auth-emblem`, `auth-title`, `auth-sub` — card header.
- `auth-providers` with `provider-btn` — provider list.
- `auth-divider` — "or" divider.
- `demo-box` with `demo-label` (add `amber-dot`) — the "Development demo login — disabled in production" form.
- Demo form uses `form`, `field`, `label`, `input`, `btn btn-primary btn-block`.
- `field-error` — error text.
- `auth-foot` — footer note.

**Shared**
- `btn` and its variants — buttons.
- `icon-btn` (`icon-btn-sm`) and `round-btn` — icon buttons.
- `pill`, `badge`, `badge-mock` (MockBadge), `live-dot`, `usage-dots` — pills, badges and indicators.
- Layout: `row`, `stack`, `btn-row`.
- Text: `tiny`, `micro`, `text-2`, `text-3`, `mono`, `tnum`, `link`.