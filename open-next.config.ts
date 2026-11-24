import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// Free-tier friendly: no R2/KV incremental cache (all pages are dynamic).
export default defineCloudflareConfig({});
