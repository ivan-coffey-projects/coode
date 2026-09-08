import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CoodeEngine } from "../src/engine.js";
import { startServer } from "../src/server.js";

test("CoodeEngine returns import and context cards", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "coode-engine-"));
  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify({ dependencies: { react: "^19.0.0" } }),
    "utf8",
  );

  const engine = await CoodeEngine.create();
  const message = await engine.updateFromBridge({
    uri: `file://${join(workspace, "App.tsx")}`,
    languageId: "typescript",
    line: 0,
    character: 7,
    word: "react",
    lineText: "import react from 'react'",
    surroundingLines: "> import react from 'react'",
    workspaceRoot: workspace,
    processName: "cursor",
  });

  assert.equal(message.type, "context");
  assert.ok(message.cards.some((card) => card.source === "imports"));
  assert.ok(message.cards.some((card) => card.source === "context"));
});

test("HTTP server exposes health and context endpoints", async () => {
  const { server } = await startServer({ port: 0, quiet: true });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const port = address.port;
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  const healthJson = (await health.json()) as { ok: boolean };
  assert.equal(healthJson.ok, true);

  const context = await fetch(`http://127.0.0.1:${port}/api/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uri: "file:///tmp/example.py",
      languageId: "python",
      line: 0,
      character: 7,
      word: "requests",
      lineText: "import requests",
      surroundingLines: "> import requests",
      workspaceRoot: "/tmp",
      processName: "cursor",
    }),
  });

  assert.equal(context.status, 200);
  const payload = (await context.json()) as { cards: Array<{ source: string }> };
  assert.ok(payload.cards.length > 0);

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("HTTP server exposes orchestration endpoint", { skip: !process.env.DEV_HARNESS_ROOT }, async () => {
  const harnessRoot = process.env.DEV_HARNESS_ROOT;
  assert.ok(harnessRoot);

  const { server } = await startServer({ port: 0, quiet: true, harnessRoot });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const port = address.port;
  const orch = await fetch(`http://127.0.0.1:${port}/api/orchestration`);
  assert.equal(orch.status, 200);
  const payload = (await orch.json()) as {
    harness: { name: string; modes: Record<string, unknown> };
    mcps: unknown[];
  };
  assert.equal(payload.harness.name, "dev-harness");
  assert.ok("build" in payload.harness.modes);
  assert.ok(Array.isArray(payload.mcps));

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});
