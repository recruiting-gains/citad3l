# Citad3L V1 inference host (GPU) — NOT PROVISIONED

Citad3L V1 = **huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF** (base: Qwen/Qwen3.8-27B, Apache-2.0),
served with **llama.cpp `llama-server`**, which exposes an OpenAI-compatible `/v1/chat/completions` endpoint
that the web app's server-side adapter (`lib/inference/index.ts`) calls. The browser never talks to this host.

## Suggested sizing
| Quant file | Approx size | GPU |
|---|---|---|
| `Huihui-Qwen3.8-27B-abliterated-Q4_K.gguf` | ~16–17 GB | 1× 24 GB (L4/A10/RTX 4090) — good default |
| `...-Q5_K.gguf` / `...-Q6_K.gguf` | ~19–23 GB | 1× 40–48 GB (A40/L40S/A100-40G) |
| `...-Q8_0.gguf` | ~29 GB | 1× 48–80 GB |
Leave headroom for KV cache: context × parallel slots. Start with `-c 32768 --parallel 4`, measure, then tune.
Exact file sizes: check the HF repo "Files" tab before choosing a GPU.

## Run (Docker, CUDA)
```bash
docker build -f inference/Dockerfile.llamacpp -t citad3l-inference .
docker run --gpus all -p 8080:8080 -e LLAMA_API_KEY=CHANGE_ME -v /models:/models citad3l-inference
```
Then on the web app: `INFERENCE_PROVIDER=openai`, `INFERENCE_BASE_URL=http://<private-host>:8080/v1`,
`INFERENCE_MODEL=citad3l-v1`, `INFERENCE_API_KEY=<same key>`.

## Network
Keep it private: Fly private networking (6PN / WireGuard) or a GPU provider's private endpoint + API key + firewall
allowing only the Fly app. Never expose it publicly without the API key. Prompts/responses are not logged by the web app;
also run llama-server without `--log-prompts`-style verbose logging.

## Smoke test
```bash
curl -N http://localhost:8080/v1/chat/completions -H "Authorization: Bearer CHANGE_ME" \
  -H 'content-type: application/json' \
  -d '{"model":"citad3l-v1","stream":true,"messages":[{"role":"user","content":"hello"}]}'
```
