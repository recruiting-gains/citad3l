// Tiny OpenAI-compatible streaming stub, used ONLY to prove the real adapter path in tests.
// It is not a model. Replies are fixed text prefixed with "[stub]".
import http from "node:http";
const port = Number(process.env.STUB_PORT ?? 8089);
http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let body = ""; for await (const c of req) body += c;
    const j = JSON.parse(body);
    if (req.headers.authorization !== `Bearer ${process.env.STUB_KEY ?? "stub-key"}`) { res.writeHead(401); return res.end(); }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const words = `[stub] adapter OK for model=${j.model}, ${j.messages.length} messages, system prompt present=${j.messages[0]?.role === "system"}.`.split(" ");
    for (const w of words) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: w + " " } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 15));
    }
    res.write("data: [DONE]\n\n"); return res.end();
  }
  res.writeHead(404); res.end();
}).listen(port, () => console.log(`stub listening on ${port}`));
