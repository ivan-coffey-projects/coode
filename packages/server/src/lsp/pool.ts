import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ContextTarget, InfoCard, InfoProvider } from "@coode/core";
import { JsonRpcClient, spawnLanguageServer } from "./json-rpc.js";

interface LanguageServerSpec {
  command: string;
  args: string[];
}

interface OpenDocument {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

interface DiagnosticEntry {
  line: number;
  message: string;
  severity?: number;
  source?: string;
}

const LANGUAGE_SERVERS: Record<string, LanguageServerSpec> = {
  typescript: { command: "typescript-language-server", args: ["--stdio"] },
  javascript: { command: "typescript-language-server", args: ["--stdio"] },
  typescriptreact: { command: "typescript-language-server", args: ["--stdio"] },
  javascriptreact: { command: "typescript-language-server", args: ["--stdio"] },
  python: { command: "pyright-langserver", args: ["--stdio"] },
  go: { command: "gopls", args: [] },
};

export class LspPool {
  private readonly sessions = new Map<string, LspSession>();
  private readonly diagnostics = new Map<string, DiagnosticEntry[]>();
  private readonly unavailable = new Set<string>();

  getDiagnostics(uri: string, line: number): DiagnosticEntry[] {
    return (this.diagnostics.get(uri) ?? []).filter((entry) => entry.line === line);
  }

  async hover(target: ContextTarget, signal: AbortSignal): Promise<InfoCard[]> {
    const language = target.language;
    if (!language || !target.workspaceRoot) {
      return [];
    }

    const spec = LANGUAGE_SERVERS[language];
    if (!spec) {
      return [];
    }

    const session = await this.getSession(target.workspaceRoot, language, spec, signal);
    const uri = target.location.uri;
    const filePath = uriToPath(uri);
    const text = await readFile(filePath, "utf8").catch(() => "");

    if (!text) {
      return [];
    }

    await session.openDocument({
      uri,
      languageId: language,
      version: Date.now(),
      text,
    });

    const result = (await session.client.request("textDocument/hover", {
      textDocument: { uri },
      position: { line: target.location.line, character: target.location.column },
    })) as
      | {
          contents?:
            | string
            | { value: string }
            | Array<string | { value: string }>;
        }
      | null
      | undefined;

    const body = formatHoverContents(result?.contents);
    if (!body) {
      return [];
    }

    return [
      {
        id: `lsp:hover:${uri}:${target.location.line}:${target.location.column}`,
        title: target.text || "Symbol",
        body,
        priority: 90,
        source: "lsp",
      },
    ];
  }

  private async getSession(
    workspaceRoot: string,
    language: string,
    spec: LanguageServerSpec,
    signal: AbortSignal,
  ): Promise<LspSession> {
    const key = `${workspaceRoot}::${language}`;
    if (this.unavailable.has(key)) {
      throw new Error(`language server unavailable for ${language}`);
    }

    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }

    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (!commandExists(spec.command)) {
      this.unavailable.add(key);
      throw new Error(`language server not installed: ${spec.command}`);
    }

    const proc = spawnLanguageServer(spec.command, spec.args);
    const client = new JsonRpcClient(proc);
    client.onNotification = (method, params) => {
      if (method !== "textDocument/publishDiagnostics") {
        return;
      }

      const payload = params as {
        uri?: string;
        diagnostics?: Array<{
          message?: string;
          severity?: number;
          source?: string;
          range?: { start?: { line?: number } };
        }>;
      };

      if (!payload.uri) {
        return;
      }

      this.diagnostics.set(
        payload.uri,
        (payload.diagnostics ?? []).map((diagnostic) => ({
          line: diagnostic.range?.start?.line ?? 0,
          message: diagnostic.message ?? "Diagnostic",
          severity: diagnostic.severity,
          source: diagnostic.source,
        })),
      );
    };

    const session = new LspSession(client, workspaceRoot);

    try {
      await session.initialize(language);
    } catch (error) {
      client.dispose();
      this.unavailable.add(key);
      throw error;
    }

    this.sessions.set(key, session);
    return session;
  }
}

class LspSession {
  private readonly openDocuments = new Map<string, OpenDocument>();

  constructor(
    readonly client: JsonRpcClient,
    private readonly workspaceRoot: string,
  ) {}

  async initialize(languageId: string): Promise<void> {
    const rootUri = pathToUri(this.workspaceRoot);
    await this.client.request("initialize", {
      processId: process.pid,
      rootUri,
      capabilities: {
        textDocument: {
          hover: { contentFormat: ["markdown", "plaintext"] },
          publishDiagnostics: { relatedInformation: false },
        },
      },
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
    });

    this.client.notify("initialized", {});
    this.client.notify("workspace/didChangeConfiguration", {
      settings: languageId === "python" ? { python: { analysis: { typeCheckingMode: "basic" } } } : {},
    });
  }

  async openDocument(document: OpenDocument): Promise<void> {
    const existing = this.openDocuments.get(document.uri);
    if (existing?.text === document.text) {
      return;
    }

    this.openDocuments.set(document.uri, document);

    if (existing) {
      this.client.notify("textDocument/didChange", {
        textDocument: { uri: document.uri, version: document.version },
        contentChanges: [{ text: document.text }],
      });
      return;
    }

    this.client.notify("textDocument/didOpen", {
      textDocument: {
        uri: document.uri,
        languageId: document.languageId,
        version: document.version,
      },
      text: document.text,
    });
  }
}

export function createLspProvider(pool: LspPool): InfoProvider {
  return {
    id: "lsp",
    label: "Language Server",
    match(target, config) {
      return (
        config.providers.lsp.enabled &&
        Boolean(target.language && config.providers.lsp.languages.includes(target.language)) &&
        target.kind !== "import"
      );
    },
    async fetch(target, { signal }) {
      if (signal.aborted) {
        return [];
      }

      try {
        return await pool.hover(target, signal);
      } catch {
        return [];
      }
    },
  };
}

export function createDiagnosticsProvider(pool: LspPool): InfoProvider {
  return {
    id: "diagnostics",
    label: "Diagnostics",
    match(_target, config) {
      return config.providers.diagnostics.enabled;
    },
    async fetch(target) {
      const diagnostics = pool.getDiagnostics(target.location.uri, target.location.line);
      return diagnostics.map((diagnostic, index) => ({
        id: `diagnostics:${target.location.uri}:${target.location.line}:${index}`,
        title: diagnostic.severity === 1 ? "Error" : "Diagnostic",
        body: [diagnostic.source, diagnostic.message].filter(Boolean).join(": "),
        priority: diagnostic.severity === 1 ? 88 : 75,
        source: "diagnostics",
      }));
    },
  };
}

function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}

function pathToUri(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

function commandExists(command: string): boolean {
  try {
    execSync(`command -v ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function formatHoverContents(
  contents:
    | string
    | { value: string }
    | Array<string | { value: string }>
    | undefined,
): string | undefined {
  if (!contents) {
    return undefined;
  }

  if (typeof contents === "string") {
    return contents;
  }

  if ("value" in contents) {
    return contents.value;
  }

  return contents
    .map((entry) => (typeof entry === "string" ? entry : entry.value))
    .join("\n\n");
}
