#!/usr/bin/env python3
"""Extract '=== FILE: path ===' ... '=== END FILE ===' blocks from an Opus output into the project root."""
import re, sys, os
src, root = sys.argv[1], sys.argv[2]
txt = open(src).read()
blocks = re.findall(r"=== FILE: (.+?) ===\n(.*?)\n=== END FILE ===", txt, re.S)
for path, body in blocks:
    path = path.strip().strip("`")
    if path.startswith("/") or ".." in path: continue
    body = re.sub(r"^```[a-zA-Z]*\n", "", body); body = re.sub(r"\n```\s*$", "", body)
    full = os.path.join(root, path); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w").write(body.rstrip() + "\n"); print("wrote", path, len(body))
