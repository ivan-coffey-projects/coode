import * as vscode from "vscode";

export interface BridgePayload {
  uri: string;
  languageId: string;
  line: number;
  character: number;
  word: string;
  lineText: string;
  surroundingLines: string;
  workspaceRoot?: string;
  processName?: string;
}

export class CoodeClient {
  constructor(private readonly getServerUrl: () => string) {}

  async pushContext(payload: BridgePayload): Promise<void> {
    const response = await fetch(`${this.getServerUrl()}/api/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`coode server responded with ${response.status}`);
    }
  }

  async refreshOrchestration(): Promise<void> {
    const response = await fetch(`${this.getServerUrl()}/api/orchestration`);
    if (!response.ok) {
      throw new Error(`coode orchestration responded with ${response.status}`);
    }
  }

  openPanel(): void {
    const url = `${this.getServerUrl()}/`;
    vscode.env.openExternal(vscode.Uri.parse(url));
  }
}
