import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* Guards on ChatWorkspace wiring that has no DOM test harness here. */
const src = readFileSync(new URL("../components/chat/ChatWorkspace.tsx", import.meta.url), "utf8");
describe("ChatWorkspace @computer wiring", () => {
  it("Retry goes through planRetry and a 409 computer_command reroutes to runComputer", () => {
    const retry = src.slice(src.indexOf("function retryMessage"), src.indexOf("const composerReady"));
    expect(retry).toContain("planRetry(");
    expect(retry).toMatch(/case "computer":[\s\S]*runComputer\(\{ task: plan\.task \}/);
    expect(src).toContain("rerouteFromChatError(res.status");
    expect(src).toMatch(/if \(rerouteTask\) void runComputer\(\{ task: rerouteTask \}, null\)/);
  });
  it("no second 'Something went wrong' banner on top of the inline reply error", () => {
    expect(src).not.toMatch(/if \(id\) setBanner\(\{ kind: "error", title: "Something went wrong\."/);
  });
});
