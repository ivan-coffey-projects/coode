import assert from "node:assert/strict";
import test from "node:test";
import { CoodeEngine } from "../src/engine.js";

test("engine handles missing language server without throwing", async () => {
  const engine = await CoodeEngine.create();
  const message = await engine.updateFromBridge({
    uri: "file:///tmp/demo.ts",
    languageId: "typescript",
    line: 0,
    character: 6,
    word: "hello",
    lineText: "const hello = 1",
    surroundingLines: "> const hello = 1",
    workspaceRoot: "/tmp",
    processName: "cursor",
  });

  assert.equal(message.type, "context");
  assert.ok(message.cards.length > 0);
  assert.ok(message.cards.some((card) => card.source === "context"));
});
