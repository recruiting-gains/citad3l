#!/usr/bin/env python3
"""Call Anthropic Messages API (claude-opus-5-5) with streaming.
Usage: call_opus.py <prompt.md> <out_prefix> [image ...]
Key is read from env ANTHROPIC_API_KEY only; it is never printed or written.
Writes <out_prefix>.md (text) and <out_prefix>.meta.json (model id returned by API, usage, request id)."""
import os, sys, json, base64, time, urllib.request, mimetypes
MODEL = "claude-opus-5-5"
prompt_path, out = sys.argv[1], sys.argv[2]
imgs = sys.argv[3:]
content = []
for p in imgs:
    mt = mimetypes.guess_type(p)[0] or "image/png"
    content += [{"type": "text", "text": f"Image: {os.path.basename(p)}"},
                {"type": "image", "source": {"type": "base64", "media_type": mt, "data": base64.b64encode(open(p, "rb").read()).decode()}}]
content.append({"type": "text", "text": open(prompt_path).read()})
body = {"model": MODEL, "max_tokens": int(os.environ.get("OPUS_MAX_TOKENS", "32000")), "stream": True,
        "messages": [{"role": "user", "content": content}],
        "thinking": {"type": "adaptive"}, "output_config": {"effort": os.environ.get("OPUS_EFFORT", "medium")}}
hdr = {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"}
for att in range(3):
    try:
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", json.dumps(body).encode(), hdr)
        resp = urllib.request.urlopen(req, timeout=900)
        rid = resp.headers.get("request-id")
        model, usage, stop, text = None, {}, None, []
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"): continue
            ev = json.loads(line[5:])
            t = ev.get("type")
            if t == "message_start":
                model = ev["message"].get("model"); usage.update(ev["message"].get("usage", {}))
            elif t == "content_block_delta" and ev["delta"].get("type") == "text_delta":
                text.append(ev["delta"]["text"])
                if len(text) % 200 == 0: open(out + ".partial.md", "w").write("".join(text))
            elif t == "message_delta":
                usage.update(ev.get("usage", {})); stop = ev["delta"].get("stop_reason")
            elif t == "error":
                raise RuntimeError(json.dumps(ev))
        txt = "".join(text)
        open(out + ".md", "w").write(txt)
        meta = {"requested_model": MODEL, "returned_model": model, "request_id": rid, "stop_reason": stop,
                "usage": usage, "images": [os.path.basename(i) for i in imgs], "chars": len(txt),
                "time": time.strftime("%Y-%m-%d %H:%M:%S %Z")}
        json.dump(meta, open(out + ".meta.json", "w"), indent=1)
        print(json.dumps(meta)); sys.exit(0)
    except urllib.error.HTTPError as e:
        err = e.read()[:600].decode("utf-8", "replace")
        print("HTTP", e.code, err, file=sys.stderr)
        open(out + ".error.txt", "a").write(f"HTTP {e.code} {err}\n")
        time.sleep(20)
    except Exception as e:
        print("ERR", repr(e)[:400], file=sys.stderr)
        open(out + ".error.txt", "a").write(repr(e)[:400] + "\n"); time.sleep(20)
sys.exit(1)
