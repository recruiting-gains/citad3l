import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/server-only-shim.ts") } },
  test: { environment: "node", testTimeout: 60000, hookTimeout: 60000, fileParallelism: false, reporters: ["verbose"] },
});
