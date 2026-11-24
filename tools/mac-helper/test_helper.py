"""Run: python3 -m unittest -v test_helper.py   (no macOS, pyautogui or display needed)."""
import json
import os
import stat
import tempfile
import threading
import unittest
from pathlib import Path

import citad3l_helper as h


class Quiet(h.Indicator):
    def __init__(self):
        super().__init__()
        self.events = []

    def busy(self, task):
        self.events.append(("busy", task))
        return True
    def step(self, a): self.events.append(("step", a["type"]))
    def idle(self, why): self.events.append(("idle", why))


def sess(max_actions=60):
    ex = h.DryRunExecutor(log=lambda _m: None)
    return h.Session(ex, Quiet(), max_actions=max_actions), ex


class Validate(unittest.TestCase):
    def test_accepts_known_actions(self):
        self.assertEqual(h.validate({"type": "click", "x": 500, "y": 10.4})["y"], 10)
        self.assertEqual(h.validate({"type": "key", "keys": ["CMD", "space"]})["keys"], ["cmd", "space"])
        self.assertEqual(h.validate({"type": "scroll", "dy": -3})["dy"], -3)

    def test_rejects_bad_input(self):
        for bad in [
            None, {}, {"type": "shell", "cmd": "rm -rf /"}, {"type": "click", "x": 1001, "y": 0},
            {"type": "click", "x": True, "y": 0}, {"type": "type", "text": ""}, {"type": "type", "text": "x" * 501},
            {"type": "key", "keys": ["cmd", "power"]}, {"type": "key", "keys": []}, {"type": "wait", "ms": 60000},
            {"type": "scroll", "dy": 99}, {"type": "done", "summary": "x"},
        ]:
            with self.assertRaises(h.Rejected, msg=str(bad)):
                h.validate(bad)

    def test_points_mapping_and_corner_clamp(self):
        self.assertEqual(h.to_points(500, 500, 1440, 900), (720, 450))
        self.assertEqual(h.to_points(0, 0, 1440, 900), (1, 1))          # never the exact fail-safe corner
        self.assertEqual(h.to_points(1000, 1000, 1440, 900), (1438, 898))

    def test_key_names(self):
        self.assertEqual(h.pyautogui_keys(["cmd", "escape", "a"]), ["command", "esc", "a"])

    def test_ws_url(self):
        self.assertEqual(h.ws_url("https://citad3l.io/"), "wss://citad3l.io/api/computer/ws")
        self.assertEqual(h.ws_url("http://127.0.0.1:8787"), "ws://127.0.0.1:8787/api/computer/ws")


class Protocol(unittest.TestCase):
    def test_requires_begin(self):
        s, ex = sess()
        r = s.handle({"id": "1", "op": "act", "action": {"type": "click", "x": 1, "y": 1}})
        self.assertFalse(r["ok"])
        self.assertEqual(ex.actions, [])

    def test_happy_path(self):
        s, ex = sess()
        self.assertTrue(s.handle({"id": "b", "op": "begin", "task": "open safari"})["ok"])
        shot = s.handle({"id": "s", "op": "screenshot"})
        self.assertTrue(shot["ok"])
        self.assertEqual(shot["result"]["width"], 1440)
        self.assertTrue(s.handle({"id": "a", "op": "act", "action": {"type": "key", "keys": ["cmd", "space"]}})["ok"])
        self.assertEqual(ex.actions, [{"type": "key", "keys": ["cmd", "space"]}])
        s.handle({"id": "e", "op": "end"})
        self.assertFalse(s.handle({"id": "a2", "op": "act", "action": {"type": "key", "keys": ["a"]}})["ok"])

    def test_duplicate_ids_never_replayed(self):
        s, ex = sess()
        s.handle({"id": "b", "op": "begin"})
        s.handle({"id": "x", "op": "act", "action": {"type": "key", "keys": ["a"]}})
        r = s.handle({"id": "x", "op": "act", "action": {"type": "key", "keys": ["a"]}})
        self.assertEqual(r["error"], "duplicate")
        self.assertEqual(len(ex.actions), 1)

    def test_remote_stop_and_local_stop(self):
        s, ex = sess()
        s.handle({"id": "b", "op": "begin"})
        self.assertIsNone(s.handle({"id": "stop-1", "op": "stop"}))
        self.assertFalse(s.handle({"id": "a", "op": "act", "action": {"type": "key", "keys": ["a"]}})["ok"])
        s.handle({"id": "b2", "op": "begin"})
        s.local_stop("hotkey")
        self.assertFalse(s.handle({"id": "a2", "op": "act", "action": {"type": "key", "keys": ["a"]}})["ok"])
        self.assertEqual(ex.actions, [])

    def test_stop_interrupts_wait(self):
        s, _ = sess()
        s.handle({"id": "b", "op": "begin"})
        threading.Timer(0.1, lambda: s.local_stop("x")).start()
        r = s.handle({"id": "w", "op": "act", "action": {"type": "wait", "ms": 5000}})
        self.assertFalse(r["ok"])

    def test_local_action_limit(self):
        s, ex = sess(max_actions=2)
        s.handle({"id": "b", "op": "begin"})
        for i in range(3):
            r = s.handle({"id": f"a{i}", "op": "act", "action": {"type": "key", "keys": ["a"]}})
        self.assertFalse(r["ok"])
        self.assertEqual(len(ex.actions), 2)

    def test_failsafe_stops_task(self):
        class FailSafeException(Exception):
            pass

        class Boom(h.DryRunExecutor):
            def act(self, a, stopped=None):
                raise FailSafeException("corner")

        s = h.Session(Boom(log=lambda _m: None), Quiet())
        s.handle({"id": "b", "op": "begin"})
        r = s.handle({"id": "a", "op": "act", "action": {"type": "click", "x": 1, "y": 1}})
        self.assertIn("stopped_on_mac", r["error"])
        self.assertFalse(s.active)

    def test_ui_never_sees_typed_text_in_terminal(self):
        ui = h.Indicator()
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            ui.step({"type": "type", "text": "hunter2"})
        self.assertNotIn("hunter2", buf.getvalue())


class Fencing(unittest.TestCase):
    def test_stale_run_rejected(self):
        s, ex = sess()
        s.handle({"id": "b", "op": "begin", "runId": "r1"})
        r = s.handle({"id": "a", "op": "act", "runId": "r0", "action": {"type": "key", "keys": ["a"]}})
        self.assertTrue(r["error"].startswith("rejected"))
        self.assertTrue(s.handle({"id": "a2", "op": "act", "runId": "r1", "action": {"type": "key", "keys": ["a"]}})["ok"])
        self.assertFalse(s.handle({"id": "e", "op": "end", "runId": "r0"})["ok"])  # stale end can't end r1
        self.assertTrue(s.active)
        self.assertEqual(len(ex.actions), 1)

    def test_stop_mid_typing_reports_stopped_not_rejected(self):
        class Typing(h.DryRunExecutor):
            def act(self, a, stopped=None):
                stopped.set()
                raise h.Stopped("stopped while typing")

        s = h.Session(Typing(log=lambda _m: None), Quiet())
        s.handle({"id": "b", "op": "begin", "runId": "r"})
        r = s.handle({"id": "t", "op": "act", "runId": "r", "action": {"type": "type", "text": "hello"}})
        self.assertTrue(r["error"].startswith("stopped_on_mac"))

    def test_after_stop_errors_are_stopped(self):
        s, _ = sess()
        s.handle({"id": "b", "op": "begin", "runId": "r"})
        s.local_stop("x")
        r = s.handle({"id": "a", "op": "act", "runId": "r", "action": {"type": "key", "keys": ["a"]}})
        self.assertTrue(r["error"].startswith("stopped_on_mac"))


class Server(unittest.TestCase):
    def test_tls_required_except_localhost(self):
        self.assertIsNone(h.check_server("https://citad3l.io"))
        self.assertIsNone(h.check_server("http://127.0.0.1:8787"))
        self.assertIsNotNone(h.check_server("http://citad3l.io"))
        self.assertIsNotNone(h.check_server("ws://evil.example"))
        self.assertIsNotNone(h.check_server("http://127.0.0.1@evil.example"))
        self.assertIsNotNone(h.check_server("http://user:pw@localhost:80"))
        self.assertIsNotNone(h.check_server("https://x@citad3l.io"))

    def test_banner_must_be_visible_before_control(self):
        class NoBanner(Quiet):
            def busy(self, task):
                return False

        s = h.Session(h.DryRunExecutor(log=lambda _m: None), NoBanner())
        r = s.handle({"id": "b", "op": "begin", "runId": "r"})
        self.assertTrue(r["error"].startswith("rejected"))
        self.assertFalse(s.active)

    def test_stop_for_another_run_is_ignored(self):
        s, _ = sess()
        s.handle({"id": "b", "op": "begin", "runId": "r2"})
        s.handle({"id": "stop-x", "op": "stop", "runId": "r1"})
        self.assertTrue(s.active)
        s.handle({"id": "stop-y", "op": "stop", "runId": "r2"})
        self.assertFalse(s.active)

    def test_no_ui_only_with_dry_run(self):
        os.environ["T_TOK"] = "c3l_" + "b" * 64 + "_" + "a" * 64
        self.assertEqual(h.main(["run", "--no-ui", "--server", "https://citad3l.io", "--token-env", "T_TOK"]), 1)


class Config(unittest.TestCase):
    def test_file_mode_600(self):
        with tempfile.TemporaryDirectory() as d:
            h.CONFIG_DIR = Path(d) / ".citad3l"
            h.CONFIG_FILE = h.CONFIG_DIR / "helper.json"
            h.save_config("https://citad3l.io/", "c3l_" + "b" * 64 + "_" + "a" * 64, use_keychain=False)
            mode = stat.S_IMODE(os.stat(h.CONFIG_FILE).st_mode)
            self.assertEqual(mode, 0o600)
            self.assertEqual(h.load_config(), ("https://citad3l.io", "c3l_" + "b" * 64 + "_" + "a" * 64))

    def test_pair_rejects_garbage_token(self):
        self.assertEqual(h.main(["pair", "--server", "https://x", "--token", "nope"]), 1)
        self.assertEqual(h.main(["pair", "--server", "http://citad3l.io", "--token", "c3l_" + "b" * 64 + "_" + "a" * 64]), 1)
        self.assertEqual(h.main(["pair", "--server", "https://x", "--token", "c3l_" + "a" * 64]), 1)  # old owner-only shape



class DoubleClick(unittest.TestCase):
    def test_click_state_counts_up(self):
        # macOS only treats it as a double-click when the 2nd down/up carries clickState=2.
        self.assertEqual(h.multi_click_events(2), [("left", "down", 1), ("left", "up", 1), ("left", "down", 2), ("left", "up", 2)])

    def test_double_click_does_not_use_pyautogui_multi_click(self):
        calls = []

        class G:
            def size(self):
                return (1710, 1112)

            def click(self, *a, **k):
                calls.append(("click", a, k))

            def moveTo(self, *a, **k):
                calls.append(("moveTo", a, k))

            def keyUp(self, *a, **k):
                pass

            def mouseUp(self, *a, **k):
                pass

        ex = h.MacExecutor.__new__(h.MacExecutor)
        ex.g = G()
        posted = []
        orig = h.post_multi_click
        h.post_multi_click = lambda x, y, n, button="left", stopped=None: posted.append((x, y, n, button))
        try:
            ex.act({"type": "click", "x": 633, "y": 399, "button": "left", "clicks": 2})
            ex.act({"type": "click", "x": 500, "y": 500, "button": "left", "clicks": 1})
        finally:
            h.post_multi_click = orig
        # grid (633,399) on a 1710x1112-point screen -> (1082, 443) points
        self.assertEqual(posted, [(1082, 443, 2, "left")])
        self.assertEqual([c for c in calls if c[0] == "click"], [("click", (854, 556), {"clicks": 1, "button": "left"})])


class Signature(unittest.TestCase):
    def bmp(self, w, h, px, top_down=False):
        row = (w * 3 + 3) // 4 * 4
        body = bytearray()
        rows = range(h) if top_down else range(h - 1, -1, -1)
        for r in rows:
            line = bytearray()
            for c in range(w):
                v = px[r * w + c]
                line += bytes([v, v, v])
            body += line + b"\0" * (row - len(line))
        hdr = b"BM" + (54 + len(body)).to_bytes(4, "little") + b"\0\0\0\0" + (54).to_bytes(4, "little")
        dib = (40).to_bytes(4, "little") + w.to_bytes(4, "little") + ((-h) if top_down else h).to_bytes(4, "little", signed=True)
        dib += (1).to_bytes(2, "little") + (24).to_bytes(2, "little") + b"\0" * 24
        return bytes(hdr + dib + body)

    def test_bmp_gray_both_orientations(self):
        px = [10, 20, 30, 40, 50, 60]
        self.assertEqual(h.bmp_gray(self.bmp(3, 2, px)), px)
        self.assertEqual(h.bmp_gray(self.bmp(3, 2, px, top_down=True)), px)
        self.assertIsNone(h.bmp_gray(b"not a bmp"))
        self.assertIsNone(h.bmp_gray(self.bmp(3, 2, px), 32, 18))  # wrong size is rejected, not misread

    def test_right_double_click_is_rejected(self):
        with self.assertRaises(h.Rejected):
            h.validate({"type": "click", "x": 1, "y": 1, "button": "right", "clicks": 2})

    def test_double_click_stops_between_clicks(self):
        import threading
        posted = []
        stop = threading.Event()

        def post(phase, state):
            posted.append((phase, state))
            if (phase, state) == ("up", 1):
                stop.set()

        with self.assertRaises(h.Stopped):
            h.run_multi_click(2, post, stop, interval=0.5)
        self.assertEqual(posted, [("down", 1), ("up", 1)])  # the 2nd pair never went out

    def test_double_click_late_second_click_is_not_sent(self):
        import threading
        posted = []
        clock = iter([0.0, 0.9])
        with self.assertRaises(h.Stopped):
            h.run_multi_click(2, lambda ph, st: posted.append((ph, st)), threading.Event(), interval=0.5, now=lambda: next(clock))
        self.assertEqual(posted, [("down", 1), ("up", 1)])



class Hardening(unittest.TestCase):
    def test_control_characters_rejected_in_typed_text(self):
        for bad in ("hello\n", "a\tb", "x\x7f"):
            with self.assertRaises(h.Rejected):
                h.validate({"type": "type", "text": bad})
        self.assertEqual(h.validate({"type": "type", "text": "gmail.com"})["text"], "gmail.com")

    def test_clicks_under_the_stop_banner_are_refused_before_input(self):
        clicked = []

        class G:
            def size(self):
                return (1710, 1112)

            def click(self, *a, **k):
                clicked.append(a)

            def moveTo(self, *a, **k):
                pass

            def keyUp(self, *a, **k):
                pass

            def mouseUp(self, *a, **k):
                pass

        ex = h.MacExecutor.__new__(h.MacExecutor)
        ex.g = G()
        # banner: x 595..1115, y 28..72 points on a 1710-wide screen; grid (500, 45) -> (854, 50) points
        with self.assertRaises(h.Rejected):
            ex.act({"type": "click", "x": 500, "y": 45, "button": "left", "clicks": 1})
        ex.act({"type": "click", "x": 500, "y": 200, "button": "left", "clicks": 1})
        ex.act({"type": "click", "x": 100, "y": 45, "button": "left", "clicks": 1})  # same height, off to the side
        self.assertEqual(len(clicked), 2)

    def test_keychain_failure_never_falls_back_to_plaintext(self):
        import tempfile, pathlib

        class KR:
            def set_password(self, *a):
                raise RuntimeError("locked")

        d = pathlib.Path(tempfile.mkdtemp())
        orig = (h.CONFIG_DIR, h.CONFIG_FILE, h._keyring)
        h.CONFIG_DIR, h.CONFIG_FILE, h._keyring = d, d / "helper.json", (lambda: KR())
        try:
            with self.assertRaises(SystemExit):
                h.save_config("https://citad3l.io", "c3l_" + "b" * 64 + "_" + "a" * 64, use_keychain=True)
            self.assertFalse((d / "helper.json").exists())
        finally:
            h.CONFIG_DIR, h.CONFIG_FILE, h._keyring = orig


class InputPermission(unittest.TestCase):
    """0.1.2: under launchd the helper had no Accessibility, so macOS dropped every click/key silently."""

    def test_begin_refused_when_macos_blocks_input(self):
        s, ex = sess()
        ex.input_ok = lambda: False
        ex.input_problem = lambda: "Accessibility is off for it"
        r = s.handle({"id": "b1", "op": "begin", "runId": "r1", "task": "open app"})
        self.assertFalse(r["ok"])
        self.assertIn("Accessibility", r["error"])
        self.assertTrue(r["error"].startswith("rejected:"))
        self.assertFalse(s.active)
        self.assertNotIn(("busy", "open app"), s.ui.events)  # banner never shown, nothing driven
        r = s.handle({"id": "a1", "op": "act", "runId": "r1", "action": {"type": "key", "keys": ["cmd", "space"]}})
        self.assertFalse(r["ok"])
        self.assertEqual(ex.actions, [])

    def test_begin_allowed_when_permission_ok_or_unknown(self):
        for val in (True, None):
            s, ex = sess()
            ex.input_ok = lambda v=val: v
            r = s.handle({"id": "b1", "op": "begin", "runId": "r1", "task": "t"})
            self.assertTrue(r["ok"], r)

    def test_problem_names_the_python_app_to_enable(self):
        self.assertTrue(h.responsible_app_path())
        self.assertIn("Accessibility", h.NO_INPUT_PERMISSION)
        self.assertIn("restart the helper", h.NO_INPUT_PERMISSION)


class Hotkeys(unittest.TestCase):
    def test_modifier_flags_ride_on_the_key_events(self):
        ev = h.hotkey_events(["command", "space"])
        self.assertEqual(ev, [("command", True, 1 << 20), ("space", True, 1 << 20), ("space", False, 1 << 20), ("command", False, 0)])

    def test_plain_key_has_no_flags_and_modifiers_release_in_reverse(self):
        self.assertEqual(h.hotkey_events(["enter"]), [("enter", True, 0), ("enter", False, 0)])
        ev = h.hotkey_events(["command", "shift", "a"])
        self.assertEqual([e[0] for e in ev if not e[1]], ["a", "shift", "command"])
        self.assertEqual(ev[-1][2], 0)


if __name__ == "__main__":
    unittest.main()
