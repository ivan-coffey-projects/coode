import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bridgePayloadToTarget, runProviders, rulesProvider } from "../src/context.js";
import { importsProvider } from "../src/providers/imports.js";
import { resolveImport } from "../src/manifest.js";
import { defaultConfig } from "../src/config.js";

test("bridgePayloadToTarget detects python import", () => {
  const target = bridgePayloadToTarget({
    uri: "file:///tmp/example.py",
    languageId: "python",
    line: 0,
    character: 7,
    word: "requests",
    lineText: "import requests",
    surroundingLines: "> import requests",
    workspaceRoot: "/tmp/project",
  });

  assert.equal(target.kind, "import");
  assert.equal(target.text, "requests");
});

test("bridgePayloadToTarget detects go import", () => {
  const target = bridgePayloadToTarget({
    uri: "file:///tmp/main.go",
    languageId: "go",
    line: 2,
    character: 8,
    word: "",
    lineText: 'import "fmt"',
    surroundingLines: '> import "fmt"',
    workspaceRoot: "/tmp/project",
  });

  assert.equal(target.kind, "import");
});

test("rulesProvider returns matching workspace rules", async () => {
  const config = {
    ...defaultConfig,
    rules: [{ match: "useEffect", title: "React", body: "deps array" }],
  };

  const cards = await rulesProvider.fetch(
    {
      kind: "symbol",
      source: "editor",
      language: "typescript",
      location: { uri: "file:///tmp/App.tsx", line: 4, column: 2 },
      text: "useEffect",
    },
    { config, signal: new AbortController().signal },
  );

  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.title, "React");
});

test("resolveImport reads package.json dependencies", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "coode-manifest-"));
  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify({ dependencies: { lodash: "^4.17.21" } }),
    "utf8",
  );

  const resolved = await resolveImport("lodash", "typescript", workspace);
  assert.equal(resolved?.version, "^4.17.21");
  assert.equal(resolved?.source, "package.json");
});

test("resolveImport reads go.mod module path", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "coode-gomod-"));
  await writeFile(
    join(workspace, "go.mod"),
    "module example.com/demo\n\ngo 1.22\n\nrequire github.com/stretchr/testify v1.9.0\n",
    "utf8",
  );

  const stdlib = await resolveImport("fmt", "go", workspace);
  assert.equal(stdlib?.detail, "Go standard library package");

  const external = await resolveImport("github.com/stretchr/testify", "go", workspace);
  assert.equal(external?.version, "v1.9.0");
});

test("importsProvider resolves manifest data", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "coode-imports-"));
  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify({ dependencies: { axios: "^1.7.0" } }),
    "utf8",
  );

  const cards = await importsProvider.fetch(
    {
      kind: "import",
      source: "editor",
      language: "typescript",
      workspaceRoot: workspace,
      location: { uri: "file:///tmp/index.ts", line: 0, column: 0 },
      text: "axios",
      metadata: { lineText: "import axios from 'axios'" },
    },
    { config: defaultConfig, signal: new AbortController().signal },
  );

  assert.equal(cards.length, 1);
  assert.match(cards[0]?.body ?? "", /package\.json/);
  assert.match(cards[0]?.body ?? "", /1\.7\.0/);
});

test("runProviders merges and sorts by priority", async () => {
  const cards = await runProviders(
    {
      kind: "symbol",
      source: "editor",
      language: "typescript",
      location: { uri: "file:///tmp/a.ts", line: 0, column: 0 },
      text: "useEffect",
      metadata: { lineText: "useEffect()" },
    },
    [rulesProvider, importsProvider],
    {
      ...defaultConfig,
      rules: [{ match: "useEffect", title: "Rule card", body: "rule" }],
    },
    new AbortController().signal,
  );

  assert.ok(cards.length >= 1);
  assert.equal(cards[0]?.source, "rules");
});
