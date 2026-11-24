// Tiny chat-completions streaming stub, used ONLY to prove the real adapter path in tests.
// It is not a model. Replies are fixed text prefixed with "[stub]".
import http from "node:http";
const port = Number(process.env.STUB_PORT ?? 8089);

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => resolve(body));
  });
}

function unauthorized(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.STUB_KEY ?? "stub-key"}`) {
    res.writeHead(401);
    res.end();
    return true;
  }
  return false;
}

http.createServer(async (req, res) => {
  if (req.method === "POST" && (req.url === "/v1/chat/completions" || req.url === "/api/v1/chat/completions")) {
    const body = await readBody(req);
    const j = JSON.parse(body);
    if (unauthorized(req, res)) return;
    const text = `[stub] adapter OK for model=${j.model}, ${j.messages.length} messages, system prompt present=${j.messages[0]?.role === "system"}.`;
    if (j.stream === false) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: text } }] }));
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const words = text.split(" ");
    for (const w of words) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: w + " " } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 15));
    }
    res.write("data: [DONE]\n\n");
    return res.end();
  }
  if (req.method === "POST" && (req.url === "/v1/image/generate" || req.url === "/api/v1/image/generate")) {
    const body = await readBody(req);
    const j = JSON.parse(body);
    if (unauthorized(req, res)) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#222"/><text x="32" y="20" text-anchor="middle" fill="#eee" font-size="10">stub image</text></svg>`;
    const b64 = Buffer.from(svg).toString("base64");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ images: [b64], request: { success: true } }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(port, () => console.log(`stub listening on ${port}`));
