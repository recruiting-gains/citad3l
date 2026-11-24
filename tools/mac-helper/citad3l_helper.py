#!/usr/bin/env python3
"""Citad3L @computer helper for macOS.

Dials OUT to Citad3L over a WebSocket (no inbound ports), then on request:
  * takes a screenshot (screencapture + sips),
  * clicks / types / presses keys (pyautogui),
while showing a red always-on-top banner with a STOP button.

Kill switches (any one stops the current task immediately):
  * the STOP button on the red banner
  * the hotkey ctrl+option+cmd+K (needs pynput + Accessibility)
  * slam the mouse into any screen corner (pyautogui fail-safe)
  * Ctrl+C in this Terminal window, or "Stop" in Citad3L chat, or "Revoke pairing" in /admin

Usage:
  python3 citad3l_helper.py pair --server https://citad3l.io                  # once; paste the token when asked
  python3 citad3l_helper.py check                                              # permissions preflight
  python3 citad3l_helper.py run                                                # start (leave Terminal open)
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import getpass
import json
import os
import platform
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Callable

VERSION = "0.1.2"
CONFIG_DIR = Path(os.environ.get("CITAD3L_HELPER_HOME", Path.home() / ".citad3l"))
CONFIG_FILE = CONFIG_DIR / "helper.json"
KEYCHAIN_SERVICE = "citad3l-computer-helper"
MAX_ACTIONS_PER_TASK = 60
TASK_IDLE_SECONDS = 120
MAX_SHOT_WIDTH = 1440

ALLOWED_KEYS = {
    "cmd", "command", "ctrl", "control", "option", "alt", "shift", "fn",
    "enter", "return", "tab", "esc", "escape", "space", "backspace", "delete",
    "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
    *list("abcdefghijklmnopqrstuvwxyz0123456789"),
    "-", "=", "[", "]", ";", "'", ",", ".", "/", "\\", "`",
    *[f"f{i}" for i in range(1, 13)],
}
# pyautogui key names on macOS
KEY_MAP = {"cmd": "command", "control": "ctrl", "alt": "option", "escape": "esc", "delete": "delete", "backspace": "backspace"}
ACTION_TYPES = {"click", "move", "drag", "scroll", "type", "key", "wait"}


class Rejected(Exception):
    """Refused BEFORE any input happened. Safe for the server to continue past."""


class Stopped(Exception):
    """A kill switch fired. Input may have partly happened; the server must stop."""


# ---------------------------------------------------------------- validation (mirrors lib/computer/actions.ts)
def _coord(a: dict, k: str) -> int:
    v = a.get(k)
    if not isinstance(v, (int, float)) or isinstance(v, bool) or not (0 <= v <= 1000):
        raise Rejected(f"bad coordinate {k}")
    return int(round(v))


def validate(action: Any) -> dict:
    """Second, local line of defence: the server already validated, but never trust the wire."""
    if not isinstance(action, dict) or action.get("type") not in ACTION_TYPES:
        raise Rejected("unknown action")
    t = action["type"]
    out: dict = {"type": t}
    if t in ("click", "move", "drag"):
        out["x"], out["y"] = _coord(action, "x"), _coord(action, "y")
    if t == "click":
        out["button"] = "right" if action.get("button") == "right" else "left"
        out["clicks"] = 2 if action.get("clicks") == 2 else 1
        if out["button"] == "right" and out["clicks"] == 2:
            # The first right-click opens a context menu, so a 2nd click would land on the menu.
            raise Rejected("right double-click is not supported")
    if t == "drag":
        out["toX"], out["toY"] = _coord(action, "toX"), _coord(action, "toY")
    if t == "scroll":
        dy = action.get("dy")
        if not isinstance(dy, int) or isinstance(dy, bool) or not (-15 <= dy <= 15):
            raise Rejected("bad scroll")
        out["dy"] = dy
        if "x" in action and "y" in action and action["x"] is not None:
            out["x"], out["y"] = _coord(action, "x"), _coord(action, "y")
    if t == "type":
        text = action.get("text")
        if not isinstance(text, str) or not (1 <= len(text) <= 500):
            raise Rejected("bad text")
        if any(ord(c) < 32 or ord(c) == 127 for c in text):
            # A newline or tab inside typed text can submit a form or move focus without the confirm gate.
            raise Rejected("control characters (newline, tab) aren't allowed in typed text; use a key action")
        out["text"] = text
    if t == "key":
        keys = action.get("keys")
        if not isinstance(keys, list) or not (1 <= len(keys) <= 4):
            raise Rejected("bad keys")
        norm = [str(k).strip().lower() for k in keys]
        if any(k not in ALLOWED_KEYS for k in norm):
            raise Rejected("key not allowed")
        out["keys"] = norm
    if t == "wait":
        ms = action.get("ms")
        if not isinstance(ms, int) or isinstance(ms, bool) or not (100 <= ms <= 5000):
            raise Rejected("bad wait")
        out["ms"] = ms
    return out


def to_points(nx: int, ny: int, screen_w: int, screen_h: int) -> tuple[int, int]:
    """0..1000 grid -> logical screen points (what pyautogui uses, Retina-independent). Clamped 1px inside the edges
    so a click never lands exactly in a fail-safe corner."""
    x = round(nx / 1000 * (screen_w - 1))
    y = round(ny / 1000 * (screen_h - 1))
    return min(max(x, 1), screen_w - 2), min(max(y, 1), screen_h - 2)


def pyautogui_keys(keys: list[str]) -> list[str]:
    return [KEY_MAP.get(k, k) for k in keys]


BANNER_W, BANNER_H, BANNER_TOP = 520, 44, 28


def banner_rect(screen_w: int) -> tuple[int, int, int, int]:
    """(x, y, w, h) in points of the red STOP banner, top-center of the main display."""
    return screen_w // 2 - BANNER_W // 2, BANNER_TOP, BANNER_W, BANNER_H


def under_banner(x: int, y: int, screen_w: int, margin: int = 4) -> bool:
    bx, by, bw, bh = banner_rect(screen_w)
    return bx - margin <= x <= bx + bw + margin and by - margin <= y <= by + bh + margin


SIG_W, SIG_H = 32, 18
_sig_failures = 0


def bmp_gray(data: bytes, want_w: int | None = None, want_h: int | None = None) -> list[int] | None:
    """Grayscale pixels (top-left first) of an uncompressed BI_RGB 24/32-bit BMP of the expected size, or None."""
    if len(data) < 54 or data[:2] != b"BM":
        return None
    off = int.from_bytes(data[10:14], "little")
    w = int.from_bytes(data[18:22], "little", signed=True)
    h = int.from_bytes(data[22:26], "little", signed=True)
    bpp = int.from_bytes(data[28:30], "little")
    comp = int.from_bytes(data[30:34], "little")
    if bpp not in (24, 32) or comp != 0 or w <= 0 or h == 0:
        return None  # BI_BITFIELDS (3) needs mask decoding; treat as "no signature"
    if (want_w is not None and w != want_w) or (want_h is not None and abs(h) != want_h):
        return None
    step = bpp // 8
    row = (w * step + 3) // 4 * 4
    if off < 54 or off + row * abs(h) > len(data):
        return None
    rows = range(abs(h) - 1, -1, -1) if h > 0 else range(abs(h))  # positive height = bottom-up
    out: list[int] = []
    for r in rows:
        base = off + r * row
        for c in range(w):
            i = base + c * step
            if i + 2 >= len(data):
                return None
            b, g, rr = data[i], data[i + 1], data[i + 2]
            out.append((rr * 299 + g * 587 + b * 114) // 1000)
    return out


def screen_signature(jpg: Path, tmp: Path) -> str | None:
    """A 32x18 grayscale thumbnail as hex (1152 chars). The server compares consecutive ones to tell the model when
    an action changed nothing on screen. Best effort: None if sips can't make it."""
    global _sig_failures
    if _sig_failures >= 3:
        return None  # keeps failing on this Mac: stop paying for it
    try:
        subprocess.run(["sips", "-z", str(SIG_H), str(SIG_W), "-s", "format", "bmp", str(jpg), "--out", str(tmp)], check=True, timeout=3, capture_output=True)
        px = bmp_gray(tmp.read_bytes(), SIG_W, SIG_H)
    except Exception:  # noqa: BLE001
        px = None
    if not px:
        _sig_failures += 1
        return None
    if not px or len(px) != SIG_W * SIG_H:
        return None
    return bytes(px).hex()


def multi_click_events(n: int, button: str = "left") -> list[tuple[str, str, int]]:
    """The (button, 'down'|'up', clickState) sequence for an n-click: clickState counts 1..n."""
    return [(button, phase, i) for i in range(1, n + 1) for phase in ("down", "up")]


def run_multi_click(n: int, post: Callable[[str, int], None], stopped: threading.Event, interval: float, gap: float = 0.06,
                    now: Callable[[], float] = time.monotonic) -> None:
    """Send n down/up pairs (clickState 1..n). Checks STOP before every pair, and refuses to send a late pair: if the
    system double-click interval has passed, the 2nd pair would be a stray single click, so it stops instead."""
    start = now()
    for i in range(1, n + 1):
        if stopped.is_set():
            raise Stopped("stopped during a multi-click")
        if i > 1 and now() - start > interval * 0.8:
            raise Stopped("double-click timing missed; not sending a late click")
        post("down", i)
        post("up", i)
        if i < n:
            time.sleep(gap)


def post_multi_click(x: int, y: int, n: int, button: str = "left", stopped: threading.Event | None = None) -> None:
    import Quartz  # type: ignore  (pyobjc-framework-Quartz, a pyautogui dependency on macOS)

    try:
        from AppKit import NSEvent  # type: ignore

        interval = float(NSEvent.doubleClickInterval()) or 0.5
    except Exception:  # noqa: BLE001
        interval = 0.5
    kinds = {
        "left": (Quartz.kCGMouseButtonLeft, Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp),
        "right": (Quartz.kCGMouseButtonRight, Quartz.kCGEventRightMouseDown, Quartz.kCGEventRightMouseUp),
    }
    btn, down, up = kinds["right" if button == "right" else "left"]
    pressed = False

    def post(phase: str, state: int) -> None:
        nonlocal pressed
        ev = Quartz.CGEventCreateMouseEvent(None, down if phase == "down" else up, (x, y), btn)
        Quartz.CGEventSetIntegerValueField(ev, Quartz.kCGMouseEventClickState, state)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, ev)
        pressed = phase == "down"

    try:
        run_multi_click(n, post, stopped or threading.Event(), interval)
    finally:
        if pressed:  # never leave the button held
            post("up", 1)


# ---------------------------------------------------------------- executors
NO_INPUT_PERMISSION = (
    "macOS isn't letting the helper control the mouse and keyboard (Accessibility is off for it), so every click and "
    "key would be silently ignored. On the Mac: System Settings → Privacy & Security → Accessibility → turn on "
    "\"Python\" (add it with + if missing: {exe}), then restart the helper"
)


def responsible_app_path() -> str:
    """The Python.app TCC sees for this process (what to turn on in Accessibility)."""
    exe = os.path.realpath(sys.executable)
    m = re.search(r"^(.*?/Python\.app)(/|$)", exe)
    if m:
        return m.group(1)
    fw = re.search(r"^(.*?/Python\.framework/Versions/[^/]+)/", exe)
    if fw and os.path.isdir(fw.group(1) + "/Resources/Python.app"):
        return fw.group(1) + "/Resources/Python.app"
    return exe


def input_permission() -> bool | None:
    """True/False = macOS will/won't deliver our synthetic input; None = can't tell (non-macOS or no pyobjc).
    Without it CGEventPost drops every event silently: clicks, keys and typing all do nothing."""
    try:
        import Quartz  # type: ignore
    except Exception:  # noqa: BLE001
        return None
    pre = getattr(Quartz, "CGPreflightPostEventAccess", None)
    if pre is not None:
        try:
            return bool(pre())
        except Exception:  # noqa: BLE001
            pass
    try:
        from ApplicationServices import AXIsProcessTrusted  # type: ignore

        return bool(AXIsProcessTrusted())
    except Exception:  # noqa: BLE001
        return None


def request_input_permission() -> None:
    """Adds this Python to the Accessibility list (switched off) and shows macOS's prompt. Never grants anything itself."""
    try:
        import Quartz  # type: ignore

        req = getattr(Quartz, "CGRequestPostEventAccess", None)
        if req is not None:
            req()
    except Exception:  # noqa: BLE001
        pass


MOD_FLAGS = {"command": 1 << 20, "shift": 1 << 17, "option": 1 << 19, "ctrl": 1 << 18}  # kCGEventFlagMask*
MOD_CODES = {"command": 0x37, "shift": 0x38, "option": 0x3A, "ctrl": 0x3B}


def hotkey_events(keys: list[str]) -> list[tuple[str, bool, int]]:
    """(key, down, flags) in order: modifiers down (flags accumulate), other keys down/up WITH the modifier flags,
    modifiers up in reverse. Pure, for tests."""
    mods = [k for k in keys if k in MOD_FLAGS]
    rest = [k for k in keys if k not in MOD_FLAGS]
    out: list[tuple[str, bool, int]] = []
    flags = 0
    for m in mods:
        flags |= MOD_FLAGS[m]
        out.append((m, True, flags))
    for k in rest:
        out.append((k, True, flags))
    for k in reversed(rest):
        out.append((k, False, flags))
    for m in reversed(mods):
        flags &= ~MOD_FLAGS[m]
        out.append((m, False, flags))
    return out


def post_hotkey(keys: list[str], gap: float = 0.03) -> None:
    """pyautogui posts each key with a NULL source and no flags, so macOS sometimes drops the modifier: cmd+space
    reached Finder as a bare space (Quick Look) instead of opening Spotlight. Set the flags on every event."""
    import Quartz  # type: ignore
    from pyautogui._pyautogui_osx import keyboardMapping  # type: ignore

    src = Quartz.CGEventSourceCreate(Quartz.kCGEventSourceStateHIDSystemState)
    for k, down, flags in hotkey_events(keys):
        code = MOD_CODES.get(k)
        if code is None:
            code = keyboardMapping[k]
        e = Quartz.CGEventCreateKeyboardEvent(src, code, down)
        Quartz.CGEventSetFlags(e, flags)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
        time.sleep(gap)


class MacExecutor:
    """Real input + screenshots. Imports pyautogui lazily so tests run anywhere."""

    def __init__(self) -> None:
        import pyautogui  # type: ignore

        pyautogui.FAILSAFE = True  # mouse into a corner -> FailSafeException -> task stops
        pyautogui.PAUSE = 0.05
        self.g = pyautogui
        self._asked = False

    def input_ok(self) -> bool | None:
        ok = input_permission()
        if ok is False and not self._asked:
            self._asked = True
            request_input_permission()
        return ok

    def input_problem(self) -> str:
        return NO_INPUT_PERMISSION.format(exe=responsible_app_path())

    def screen_size(self) -> tuple[int, int]:
        w, h = self.g.size()
        return int(w), int(h)

    def double_click(self, x: int, y: int, button: str = "left", stopped: threading.Event | None = None) -> None:
        """A REAL double-click. pyautogui 0.9.54 on macOS posts two independent clicks with clickState=1, so Finder
        just selects a desktop icon twice and never opens it. macOS needs the 2nd down/up pair to carry
        kCGMouseEventClickState=2 (and arrive within the system double-click interval)."""
        self.g.moveTo(x, y)  # also runs pyautogui's corner fail-safe check
        post_multi_click(x, y, 2, button, stopped)

    def screenshot(self) -> dict:
        sw, sh = self.screen_size()
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.jpg"
            # -x silent, -C include cursor, -m main display only
            subprocess.run(["screencapture", "-x", "-C", "-m", "-t", "jpg", str(p)], check=True, timeout=10)
            width = min(sw, MAX_SHOT_WIDTH)
            subprocess.run(["sips", "--resampleWidth", str(width), "-s", "formatOptions", "60", str(p)], check=True, timeout=10, capture_output=True)
            data = p.read_bytes()
            sig = screen_signature(p, Path(d) / "sig.bmp")
        height = round(sh * width / sw)
        out = {"image": base64.b64encode(data).decode(), "width": width, "height": height, "screen": {"w": sw, "h": sh}}
        if sig:
            out["sig"] = sig
        return out

    def act(self, a: dict, stopped: threading.Event | None = None) -> None:
        try:
            self._act(a, stopped or threading.Event())
        finally:
            # Never leave a button or modifier held down, even if a kill switch fired mid-action.
            for k in ("command", "ctrl", "option", "shift"):
                try:
                    self.g.keyUp(k)
                except Exception:  # noqa: BLE001
                    pass
            try:
                self.g.mouseUp(button="left")
            except Exception:  # noqa: BLE001
                pass

    def _act(self, a: dict, stopped: threading.Event) -> None:
        g = self.g
        sw, sh = self.screen_size()
        t = a["type"]
        if t in ("key", "type"):
            refocus_if_self()
        if t in ("click", "move", "drag"):
            x, y = to_points(a["x"], a["y"], sw, sh)
            # The STOP banner sits on top: a click there would hit the banner (or STOP), not the target.
            if t in ("click", "drag") and under_banner(x, y, sw):
                raise Rejected("that spot is under the red STOP banner; choose another target or use the keyboard")
            if t == "drag" and under_banner(*to_points(a["toX"], a["toY"], sw, sh), sw):
                raise Rejected("the drag ends under the red STOP banner")
        if t == "click":
            if a["clicks"] == 2:
                self.double_click(x, y, a["button"], stopped)
            else:
                g.click(x, y, clicks=1, button=a["button"])
        elif t == "move":
            g.moveTo(x, y, duration=0.15)
        elif t == "drag":
            tx, ty = to_points(a["toX"], a["toY"], sw, sh)
            g.moveTo(x, y, duration=0.1)
            g.dragTo(tx, ty, duration=0.4, button="left")
        elif t == "scroll":
            if "x" in a:
                g.moveTo(*to_points(a["x"], a["y"], sw, sh), duration=0.1)
            g.scroll(-a["dy"] * 3)  # pyautogui: positive = up
        elif t == "type":
            if a["text"].isascii():
                for i in range(0, len(a["text"]), 8):  # small chunks so STOP lands within ~0.1 s
                    if stopped.is_set():
                        raise Stopped("stopped while typing")
                    g.write(a["text"][i : i + 8], interval=0.01)
            else:  # pyautogui can't type unicode; paste it and restore the clipboard
                old = subprocess.run(["pbpaste"], capture_output=True).stdout
                subprocess.run(["pbcopy"], input=a["text"].encode(), check=True)
                g.hotkey("command", "v")
                time.sleep(0.2)
                subprocess.run(["pbcopy"], input=old)
        elif t == "key":
            keys = pyautogui_keys(a["keys"])
            try:
                post_hotkey(keys)
            except (ImportError, KeyError):
                g.hotkey(*keys)
        elif t == "wait":
            pass  # handled by the session so STOP can interrupt it


class DryRunExecutor:
    """No input at all: logs actions and returns a tiny fake screenshot. Used by tests and `run --dry-run`."""

    def __init__(self, log: Callable[[str], None] = print) -> None:
        self.log = log
        self.actions: list[dict] = []
        # 1x1 white JPEG
        self.fake = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="

    def screen_size(self) -> tuple[int, int]:
        return 1440, 900

    def screenshot(self) -> dict:
        return {"image": self.fake, "width": 1440, "height": 900, "screen": {"w": 1440, "h": 900}}

    def act(self, a: dict, stopped: threading.Event | None = None) -> None:
        self.actions.append(a)
        self.log(f"[dry-run] {json.dumps(a)}")


# ---------------------------------------------------------------- session / protocol
class Session:
    """Protocol state machine. Pure logic: no sockets, no UI. One task at a time."""

    def __init__(self, executor: Any, ui: "Indicator", max_actions: int = MAX_ACTIONS_PER_TASK) -> None:
        self.ex = executor
        self.ui = ui
        self.max_actions = max_actions
        self.active = False
        self.actions = 0
        self.last = 0.0
        self.stopped = threading.Event()
        self.seen_ids: set[str] = set()
        self.run_id: str | None = None
        # Serializes ALL input/screenshot work across reconnects: a new `begin` waits for old input to finish.
        self.busy = threading.Lock()

    def local_stop(self, why: str = "STOP pressed") -> None:
        self.stopped.set()
        self.active = False
        self.ui.idle(f"Stopped: {why}")

    def expire_if_idle(self) -> None:
        if self.active and time.time() - self.last > TASK_IDLE_SECONDS:
            self.active = False
            self.ui.idle("Task timed out")

    def handle(self, msg: dict) -> dict | None:
        mid = msg.get("id")
        op = msg.get("op")
        if not isinstance(mid, str):
            return None
        if op == "stop":  # never takes the busy lock, so it lands while input is running
            rid = msg.get("runId")
            if rid is None or rid == self.run_id:
                self.local_stop("stopped from Citad3L")
            return None
        with self.busy:
            return self._handle_locked(mid, op, msg)

    def _handle_locked(self, mid: str, op: Any, msg: dict) -> dict | None:
        if mid in self.seen_ids:  # never run the same command twice
            return {"id": mid, "ok": False, "error": "duplicate"}
        self.seen_ids.add(mid)
        if len(self.seen_ids) > 2000:
            self.seen_ids = set(list(self.seen_ids)[-500:])
        try:
            return {"id": mid, "ok": True, "result": self._dispatch(op, msg)}
        except Rejected as e:
            return {"id": mid, "ok": False, "error": f"rejected: {e}"}
        except Stopped as e:
            return {"id": mid, "ok": False, "error": f"stopped_on_mac: {e}"}
        except Exception as e:  # includes pyautogui.FailSafeException
            if type(e).__name__ == "FailSafeException":
                self.local_stop("mouse moved to a screen corner")
                return {"id": mid, "ok": False, "error": "stopped_on_mac: fail-safe corner"}
            return {"id": mid, "ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}

    def _dispatch(self, op: str, msg: dict) -> Any:
        self.expire_if_idle()
        if op == "ping":
            return {"version": VERSION}
        if op == "begin":
            self.stopped.clear()
            self.run_id = msg.get("runId") if isinstance(msg.get("runId"), str) else None
            self.active = True
            self.actions = 0
            self.last = time.time()
            task = str(msg.get("task") or "")[:120]
            check = getattr(self.ex, "input_ok", None)
            if check is not None and check() is False:  # fail loudly instead of "clicking" into the void
                self.active = False
                print(f"✗ {self.ex.input_problem()}", flush=True)
                raise Rejected(self.ex.input_problem())
            if not self.ui.busy(task):  # real input only after the banner is actually on screen
                self.active = False
                raise Rejected("banner not visible")
            return {"version": VERSION}
        if msg.get("runId") != self.run_id:  # fence: a stale or different task can't drive this session
            raise Rejected("stale run")
        if op == "end":
            self.active = False
            self.run_id = None
            self.ui.idle("Done")
            return {}
        if self.stopped.is_set():
            raise Stopped("stopped on the Mac")
        if not self.active:
            raise Rejected("no active task")
        self.last = time.time()
        if op == "screenshot":
            return self.ex.screenshot()
        if op == "act":
            a = validate(msg.get("action"))
            self.actions += 1
            if self.actions > self.max_actions:
                self.local_stop("local action limit reached")
                raise Rejected("local action limit reached")
            self.ui.step(a)
            if a["type"] == "wait":
                if self.stopped.wait(a["ms"] / 1000):
                    raise Stopped("stopped during wait")
                return {}
            self.ex.act(a, self.stopped)
            return {}
        raise Rejected(f"unknown op {op}")


# ---------------------------------------------------------------- indicator (Tk on the main thread)
class Indicator:
    """Headless default: prints. TkIndicator below draws the red banner."""

    def __init__(self, on_stop: Callable[[], None] | None = None) -> None:
        self.on_stop = on_stop

    def busy(self, task: str) -> bool:
        print(f"● Citad3L is controlling this Mac: {task}", flush=True)
        return True

    def step(self, a: dict) -> None:
        desc = {k: v for k, v in a.items() if k != "text"}
        if "text" in a:
            desc["text"] = f"<{len(a['text'])} chars>"
        print(f"  → {json.dumps(desc)}", flush=True)

    def idle(self, why: str) -> None:
        print(f"○ {why}", flush=True)

    def loop(self, stop: threading.Event) -> None:
        while not stop.wait(0.5):
            pass


def make_nonactivating() -> bool:
    """NSApplicationActivationPolicyProhibited: the banner shows and its STOP button still clicks, but Python never
    becomes the active app (no "Python" menu bar, no focus theft). Call after tk.Tk()."""
    try:
        from AppKit import NSApplication  # type: ignore

        return bool(NSApplication.sharedApplication().setActivationPolicy_(2))
    except Exception:  # noqa: BLE001
        return False


def front_app() -> Any:
    try:
        from AppKit import NSWorkspace  # type: ignore

        return NSWorkspace.sharedWorkspace().frontmostApplication()
    except Exception:  # noqa: BLE001
        return None


def give_focus_back(prev: Any) -> None:
    """If showing the banner made us frontmost anyway, hand focus back to the app that had it."""
    try:
        now = front_app()
        if prev is not None and now is not None and now.processIdentifier() == os.getpid() and prev.processIdentifier() != os.getpid():
            prev.activateWithOptions_(0)
    except Exception:  # noqa: BLE001
        pass


def refocus_if_self() -> None:
    """Before input: if Python somehow is the active app, activate whatever app is under it so keys don't land on Tk."""
    try:
        from AppKit import NSWorkspace  # type: ignore

        now = front_app()
        if now is None or now.processIdentifier() != os.getpid():
            return
        import Quartz  # type: ignore

        wins = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements, Quartz.kCGNullWindowID) or []
        for w in wins:
            pid = int(w.get("kCGWindowOwnerPID", 0))
            if pid and pid != os.getpid() and int(w.get("kCGWindowLayer", 1)) == 0:
                for app in NSWorkspace.sharedWorkspace().runningApplications():
                    if app.processIdentifier() == pid:
                        app.activateWithOptions_(0)
                        time.sleep(0.15)
                        return
        for app in NSWorkspace.sharedWorkspace().runningApplications():
            if app.bundleIdentifier() == "com.apple.finder":
                app.activateWithOptions_(0)
                time.sleep(0.15)
                return
    except Exception:  # noqa: BLE001
        pass


class TkIndicator(Indicator):
    def __init__(self, on_stop: Callable[[], None]) -> None:
        super().__init__(on_stop)
        import tkinter as tk  # type: ignore

        self.tk = tk
        self.q: "queue.Queue[tuple[str, str, threading.Event | None]]" = queue.Queue()
        self.root = tk.Tk()
        self.prev_front: Any = None
        self.nonactivating = make_nonactivating()
        self.root.title("Citad3L")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="#b00020")
        sw = self.root.winfo_screenwidth()
        bx, by, bw, bh = banner_rect(sw)
        self.root.geometry(f"{bw}x{bh}+{bx}+{by}")
        self.label = tk.Label(self.root, text="", fg="white", bg="#b00020", font=("Helvetica", 13, "bold"), anchor="w")
        self.label.pack(side="left", fill="both", expand=True, padx=10)
        tk.Button(self.root, text="STOP", command=self._stop, fg="#b00020", font=("Helvetica", 13, "bold")).pack(side="right", padx=8, pady=6)
        self.root.withdraw()

    def _stop(self) -> None:
        if self.on_stop:
            self.on_stop()

    # called from the network thread -> marshal onto Tk's thread
    def busy(self, task: str) -> bool:
        super().busy(task)
        shown = threading.Event()
        self.q.put(("busy", f"● Citad3L is controlling this Mac — {task[:48]}", shown))
        return shown.wait(3)  # set by the Tk thread after the banner is mapped

    def step(self, a: dict) -> None:
        super().step(a)
        self.q.put(("step", f"● Citad3L: {a['type']}", None))

    def idle(self, why: str) -> None:
        super().idle(why)
        self.q.put(("idle", why, None))

    def loop(self, stop: threading.Event) -> None:
        def pump() -> None:
            try:
                while True:
                    kind, text, ack = self.q.get_nowait()
                    if kind == "idle":
                        self.root.withdraw()
                    else:
                        self.label.configure(text=text)
                        # Only (re)map when hidden: deiconify/lift on every step made Tk activate Python, which
                        # stole focus from the app being driven (Spotlight closed, double-clicks landed on Python).
                        if not self.root.winfo_viewable():
                            before = front_app()
                            self.root.deiconify()
                            self.root.lift()
                            give_focus_back(before)
                        self.root.update_idletasks()
                        if ack is not None and self.root.winfo_viewable():
                            ack.set()
            except queue.Empty:
                pass
            if stop.is_set():
                self.root.destroy()
                return
            self.root.after(100, pump)

        self.root.after(100, pump)
        self.root.mainloop()


# ---------------------------------------------------------------- config / token
def _keyring():
    try:
        import keyring  # type: ignore  # native macOS Keychain API, no secrets in argv

        return keyring
    except Exception:  # noqa: BLE001
        return None


def save_config(server: str, token: str, use_keychain: bool) -> None:
    CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    cfg = {"server": server.rstrip("/"), "keychain": False}
    kr = _keyring() if use_keychain else None
    if use_keychain:
        # Fail closed: never silently fall back to a plaintext token file. Use --no-keychain to choose the file.
        if kr is None:
            sys.exit("macOS Keychain isn't available (keyring not installed?). Install requirements, or pair with --no-keychain to store the token in a 0600 file.")
        try:
            kr.set_password(KEYCHAIN_SERVICE, "pairing-token", token)
            cfg["keychain"] = True
        except Exception as e:  # noqa: BLE001
            sys.exit(f"Couldn't save the token to the Keychain ({type(e).__name__}). Unlock the login Keychain and pair again, or use --no-keychain.")
    else:
        cfg["token"] = token
    tmp = CONFIG_FILE.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(cfg, f)
    os.replace(tmp, CONFIG_FILE)
    os.chmod(CONFIG_FILE, 0o600)


def load_config() -> tuple[str, str]:
    if not CONFIG_FILE.exists():
        sys.exit("Not paired yet. In Citad3L /admin press 'Pair my Mac', then run the pair command it shows.")
    cfg = json.loads(CONFIG_FILE.read_text())
    token = cfg.get("token")
    if cfg.get("keychain"):
        kr = _keyring()
        token = kr.get_password(KEYCHAIN_SERVICE, "pairing-token") if kr else None
    if not token:
        sys.exit("Pairing token missing. Pair again from /admin.")
    return cfg["server"], token


def check_server(server: str) -> str | None:
    """Authenticated connections must use TLS, except to this machine (tests / local dev). No userinfo allowed."""
    from urllib.parse import urlsplit

    try:
        u = urlsplit(server.strip())
        host = u.hostname
        _ = u.port  # raises on a malformed port
    except ValueError:
        return "That server address isn't valid."
    if u.username is not None or u.password is not None or "@" in u.netloc or not host:
        return "That server address isn't valid."
    if u.scheme in ("https", "wss"):
        return None
    if u.scheme in ("http", "ws") and host in ("127.0.0.1", "localhost", "::1"):
        return None
    return "The server must start with https:// (plain http is only allowed for localhost)."


def ws_url(server: str) -> str:
    s = server.rstrip("/")
    if s.startswith("https://"):
        return "wss://" + s[len("https://"):] + "/api/computer/ws"
    if s.startswith("http://"):
        return "ws://" + s[len("http://"):] + "/api/computer/ws"
    return s  # already a ws(s):// URL


# ---------------------------------------------------------------- network loop (background thread)
async def serve(url: str, token: str, session: Session, shutdown: threading.Event, once: bool = False) -> int:
    from websockets.asyncio.client import connect  # websockets >= 14
    from websockets.exceptions import InvalidStatus

    backoff = 1.0
    headers = {"Authorization": f"Bearer {token}", "X-Helper-Version": VERSION, "X-Helper-Host": platform.node()[:60]}
    while not shutdown.is_set():
        try:
            async with connect(url, additional_headers=headers, max_size=4_000_000, ping_interval=20, open_timeout=15) as ws:
                print(f"Connected to {url.split('/api/')[0]}. Waiting for @computer tasks. Ctrl+C to quit.", flush=True)
                backoff = 1.0
                notify_stop = asyncio.Event()
                loop = asyncio.get_running_loop()
                session_stop_hook(session, lambda: loop.call_soon_threadsafe(notify_stop.set))
                lock = asyncio.Lock()  # one input/screenshot at a time, in arrival order
                work: set[asyncio.Task] = set()

                async def stop_notifier() -> None:
                    while True:
                        await notify_stop.wait()
                        notify_stop.clear()
                        await ws.send(json.dumps({"id": f"evt-{time.time_ns()}", "type": "event", "event": "local_stop"}))

                async def run_one(msg: dict) -> None:
                    async with lock:
                        reply = await asyncio.to_thread(session.handle, msg)
                    if reply is not None:
                        await ws.send(json.dumps(reply))

                async def watch_shutdown() -> None:
                    while not shutdown.is_set():
                        await asyncio.sleep(0.2)
                    await ws.close()

                side = [asyncio.create_task(stop_notifier()), asyncio.create_task(watch_shutdown())]
                try:
                    # The reader never blocks on input work, so a remote STOP is latched immediately.
                    async for raw in ws:
                        try:
                            msg = json.loads(raw)
                        except ValueError:
                            continue
                        if not isinstance(msg, dict):
                            continue
                        if msg.get("op") == "stop":
                            session.handle(msg)
                            continue
                        t = asyncio.create_task(run_one(msg))
                        work.add(t)
                        t.add_done_callback(work.discard)
                finally:
                    session.local_stop("disconnected")
                    for t in side:
                        t.cancel()
                    for t in list(work):  # queued commands from the dead socket never run
                        t.cancel()
            if shutdown.is_set():
                return 0
        except InvalidStatus as e:
            session.local_stop("disconnected")
            if e.response.status_code == 401:
                print("Citad3L rejected the pairing token (revoked or re-paired). Pair again from /admin.", flush=True)
                return 2
            print(f"Server said {e.response.status_code}. Retrying in {int(backoff)}s…", flush=True)
        except Exception as e:  # noqa: BLE001
            session.local_stop("disconnected")
            print(f"Connection lost ({type(e).__name__}). Retrying in {int(backoff)}s…", flush=True)
        if once:
            return 1
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 30)
    return 0


_stop_hooks: dict[int, Callable[[], None]] = {}


def session_stop_hook(session: Session, fn: Callable[[], None]) -> None:
    _stop_hooks[id(session)] = fn


def trigger_stop(session: Session, why: str) -> None:
    session.local_stop(why)
    hook = _stop_hooks.get(id(session))
    if hook:
        hook()


def start_hotkey(session: Session):
    try:
        from pynput import keyboard  # type: ignore
    except Exception:
        print("pynput not installed: hotkey kill switch off (STOP button and mouse-corner still work).", flush=True)
        return None
    hk = keyboard.GlobalHotKeys({"<ctrl>+<alt>+<cmd>+k": lambda: trigger_stop(session, "hotkey ctrl+option+cmd+K")})
    hk.daemon = True
    hk.start()
    if hasattr(hk, "IS_TRUSTED") and not getattr(hk, "IS_TRUSTED"):
        print("Hotkey not trusted by macOS (Accessibility off for this app): use the STOP button or a screen corner.", flush=True)
    return hk


# ---------------------------------------------------------------- permissions preflight
def check_permissions() -> int:
    ok = True
    if platform.system() != "Darwin":
        print("This helper is for macOS.")
        return 1
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.png"
        r = subprocess.run(["screencapture", "-x", "-m", str(p)], capture_output=True)
        size = p.stat().st_size if p.exists() else 0
    print(("✓" if r.returncode == 0 and size > 0 else "✗") + " Screen Recording (screencapture)")
    ok &= r.returncode == 0 and size > 0
    try:
        import pyautogui  # type: ignore

        pyautogui.position()
        print("✓ pyautogui installed")
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"✗ pyautogui ({e}). Run: python3 -m pip install -r requirements.txt")
    try:
        r = subprocess.run(["osascript", "-e", 'tell application "System Events" to get name of first process'], capture_output=True, text=True, timeout=10)
        acc = r.returncode == 0
    except Exception:  # noqa: BLE001
        acc = False
    post = input_permission()
    if post is not None:
        acc = acc and post
    print(("✓" if acc else "✗") + f" Accessibility (control mouse/keyboard) for {responsible_app_path()}")
    ok &= acc
    if not ok:
        print("\nOpen System Settings → Privacy & Security → Screen Recording AND Accessibility,\nturn ON the app you run this from (Terminal or iTerm), then quit and reopen it.")
    return 0 if ok else 1


# ---------------------------------------------------------------- main
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Citad3L @computer helper")
    sub = ap.add_subparsers(dest="cmd")
    p = sub.add_parser("pair", help="save the pairing token from /admin")
    p.add_argument("--server", required=True)
    p.add_argument("--token", help="(testing only) pass the token directly; normally you paste it at the hidden prompt")
    p.add_argument("--no-keychain", action="store_true", help="store the token in ~/.citad3l/helper.json (0600) instead of Keychain")
    sub.add_parser("check", help="check Screen Recording + Accessibility permissions")
    r = sub.add_parser("run", help="connect and wait for tasks (default)")
    r.add_argument("--dry-run", action="store_true", help="log actions, never touch mouse/keyboard, fake screenshots")
    r.add_argument("--no-ui", action="store_true", help="no red banner; only allowed with --dry-run")
    r.add_argument("--server", help="override server (testing)")
    r.add_argument("--token-env", help="read the token from this env var (testing)")
    r.add_argument("--once", action="store_true", help="exit when the connection drops (testing)")
    args = ap.parse_args(argv)

    if args.cmd == "pair":
        bad = check_server(args.server)
        if bad:
            print(bad)
            return 1
        if not args.token:
            args.token = getpass.getpass("Paste the pairing token from /admin (hidden): ").strip()
        if not re.fullmatch(r"c3l_[0-9a-f]{64}_[0-9a-f]{64}", args.token):
            print("That doesn't look like a Citad3L pairing token.")
            return 1
        save_config(args.server, args.token, use_keychain=not args.no_keychain and platform.system() == "Darwin")
        print(f"Paired. Saved to {CONFIG_FILE} (token {'in Keychain' if json.loads(CONFIG_FILE.read_text()).get('keychain') else 'in the file, mode 600'}).")
        print("Next: python3 citad3l_helper.py check   then   python3 citad3l_helper.py run")
        return 0
    if args.cmd == "check":
        return check_permissions()

    dry = getattr(args, "dry_run", False)
    if getattr(args, "server", None) and getattr(args, "token_env", None):
        server, token = args.server, os.environ.get(args.token_env, "")
    else:
        server, token = load_config()
    bad = check_server(server)
    if bad:
        print(bad)
        return 1
    if getattr(args, "no_ui", False) and not dry:
        print("--no-ui is only allowed with --dry-run: real control always shows the red banner.")
        return 1
    executor = DryRunExecutor() if dry else MacExecutor()
    if not dry:
        perm = executor.input_ok()
        print(f"Citad3L helper {VERSION}: " + ("mouse/keyboard control allowed." if perm else ("✗ " + executor.input_problem() + "." if perm is False else "mouse/keyboard permission unknown.")), flush=True)
    shutdown = threading.Event()
    holder: dict[str, Session] = {}
    ui: Indicator
    if getattr(args, "no_ui", False) or dry:
        ui = Indicator(lambda: trigger_stop(holder["s"], "STOP button"))
    else:
        try:
            ui = TkIndicator(lambda: trigger_stop(holder["s"], "STOP button"))
        except Exception as e:  # noqa: BLE001  fail closed: no banner, no control
            print(f"Couldn't show the on-screen banner ({e}). Refusing to take control without it.", flush=True)
            print("Fix: install Python from python.org (includes Tk), or `brew install python-tk`.", flush=True)
            return 1
    session = Session(executor, ui)
    holder["s"] = session
    hotkey = start_hotkey(session) if not dry else None

    result: dict[str, int] = {"code": 0}

    def net() -> None:
        try:
            result["code"] = asyncio.run(serve(ws_url(server), token, session, shutdown, once=getattr(args, "once", False)))
        finally:
            shutdown.set()

    t = threading.Thread(target=net, daemon=True)
    t.start()
    try:
        ui.loop(shutdown)  # Tk must own the main thread on macOS
    except KeyboardInterrupt:
        pass
    shutdown.set()
    session.local_stop("helper quit")
    t.join(timeout=5)
    if hotkey is not None:
        try:
            hotkey.stop()
        except Exception:  # noqa: BLE001
            pass
    return result["code"]


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)
