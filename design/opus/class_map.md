

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