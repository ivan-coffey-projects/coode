import * as vscode from "vscode";
import { CoodeClient, type BridgePayload } from "./client";

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const client = new CoodeClient(() => getServerUrl());

  const pushCurrentContext = async () => {
    if (!isEnabled()) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const payload = buildPayload(editor);
    try {
      await client.pushContext(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      vscode.window.setStatusBarMessage(`coode: ${message}`, 4000);
    }
  };

  const schedulePush = () => {
    if (!isEnabled()) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      void pushCurrentContext();
    }, getDebounceMs());
  };

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(schedulePush),
    vscode.window.onDidChangeActiveTextEditor(() => schedulePush()),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const active = vscode.window.activeTextEditor;
      if (active && event.document.uri.toString() === active.document.uri.toString()) {
        schedulePush();
      }
    }),
    vscode.commands.registerCommand("coode.openPanel", () => client.openPanel()),
    vscode.commands.registerCommand("coode.pushContext", () => pushCurrentContext()),
    vscode.commands.registerCommand("coode.toggleHolo", async () => {
      try {
        await client.refreshOrchestration();
        vscode.window.showInformationMessage(
          "Holographic config refreshed — Ctrl+Shift+H on overlay to toggle",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`coode desk: ${message}`);
      }
    }),
  );

  schedulePush();
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}

function isEnabled(): boolean {
  return vscode.workspace.getConfiguration("coode").get<boolean>("enabled", true);
}

function getServerUrl(): string {
  return vscode.workspace
    .getConfiguration("coode")
    .get<string>("serverUrl", "http://127.0.0.1:17420")
    .replace(/\/$/, "");
}

function getDebounceMs(): number {
  return vscode.workspace.getConfiguration("coode").get<number>("debounceMs", 300);
}

function buildPayload(editor: vscode.TextEditor): BridgePayload {
  const document = editor.document;
  const position = editor.selection.active;
  const range = document.getWordRangeAtPosition(position);
  const word = range ? document.getText(range) : "";
  const lineText = document.lineAt(position.line).text;

  const startLine = Math.max(0, position.line - 2);
  const endLine = Math.min(document.lineCount - 1, position.line + 2);
  const surroundingLines = Array.from({ length: endLine - startLine + 1 }, (_, index) => {
    const lineNumber = startLine + index;
    const prefix = lineNumber === position.line ? ">" : " ";
    return `${prefix} ${document.lineAt(lineNumber).text}`;
  }).join("\n");

  const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;

  return {
    uri: document.uri.toString(),
    languageId: document.languageId,
    line: position.line,
    character: position.character,
    word,
    lineText,
    surroundingLines,
    workspaceRoot,
    processName: "cursor",
  };
}
