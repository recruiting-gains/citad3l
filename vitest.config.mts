import { defineConfig } from "vitest/config";
import path from "node:path";
// Test-only provider settings. Production values are Worker secrets and never live in this repo.
const testEnv = {
  PROVIDER_BASE_URL: "https://provider.test/api/v1",
  COMPUTER_USD_PER_M: "0.2,2",
  PROVIDER_WIRE: JSON.stringify({ params: "provider_parameters", noSystemPrompt: "include_provider_system_prompt", headerPrefix: "Provider", mediaHost: "media.provider.test" }),
  MODEL_IDS: JSON.stringify({
    "citad3l-v1": "test-v1-model",
    "citad3l-fast": "test-fast-model",
    "citad3l-private": "e2ee-test-private-model",
    "citad3l-image": "test-image-model",
    "video-t2v": "test-video-t2v",
    "video-i2v": "test-video-i2v",
    computer: "test-vision-model",
  }),
};
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/server-only-shim.ts") } },
  test: { environment: "node", testTimeout: 60000, hookTimeout: 60000, fileParallelism: false, env: testEnv, reporters: ["verbose"] },
});
