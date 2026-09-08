import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import WebSocket from "ws";
import { startServer } from "../src/server.js";

test("WebSocket receives context updates", async () => {
  const { server } = await startServer({ port: 0, quiet: true });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected server address");
  }

  const port = address.port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await once(ws, "open");

  const messagePromise = once(ws, "message");
  await fetch(`http://127.0.0.1:${port}/api/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uri: "file:///tmp/demo.ts",
      languageId: "typescript",
      line: 0,
      character: 6,
      word: "hello",
      lineText: "const hello = 1",
      surroundingLines: "> const hello = 1",
      workspaceRoot: "/tmp",
      processName: "cursor",
    }),
  });

  const [raw] = await messagePromise;
  const payload = JSON.parse(String(raw)) as { type: string; cards: unknown[] };
  assert.equal(payload.type, "context");
  assert.ok(payload.cards.length > 0);

  ws.close();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("server survives missing language server binary", async () => {
  const { server } = await startServer({ port: 0, quiet: true });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("expected server address");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/api/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uri: "file:///tmp/demo.ts",
      languageId: "typescript",
      line: 0,
      character: 6,
      word: "hello",
      lineText: "const hello = 1",
      surroundingLines: "> const hello = 1",
      workspaceRoot: "/tmp",
      processName: "cursor",
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { cards: Array<{ source: string }> };
  assert.ok(payload.cards.some((card) => card.source === "context"));

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});
