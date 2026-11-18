#!/usr/bin/env python3
"""Apply Opus round outputs: FILE blocks (css appendix appended to globals.css; others written) and PATCH find/replace blocks."""
import re, sys, os
src, root = sys.argv[1], sys.argv[2]
t = open(src).read()
for path, body in re.findall(r"=== FILE: (.+?) ===\n(.*?)\n=== END FILE ===", t, re.S):
    path = path.strip().strip("`"); body = re.sub(r"^```[a-zA-Z]*\n", "", body); body = re.sub(r"\n```\s*$", "", body)
    if path.startswith("app/round") and path.endswith(".css"):
        open(os.path.join(root, "app/globals.css"), "a").write(f"\n/* ---- {path} (Opus design round) ---- */\n{body}\n"); print("appended", path)
    else:
        full = os.path.join(root, path); os.makedirs(os.path.dirname(full), exist_ok=True); open(full, "w").write(body.rstrip() + "\n"); print("wrote", path)
for path, body in re.findall(r"=== PATCH: (.+?) ===\n(.*?)=== END PATCH ===", t, re.S):
    full = os.path.join(root, path.strip().strip("`")); s = open(full).read()
    for find, rep in re.findall(r"<<<FIND\n(.*?)\n>>>REPLACE\n(.*?)\n?<<<END", body, re.S):
        n = s.count(find)
        if n == 1: s = s.replace(find, rep); print("patched", path, "ok")
        else: print("PATCH FAILED", path, "matches=", n, "|", find[:80].replace("\n", "⏎"))
    open(full, "w").write(s)
