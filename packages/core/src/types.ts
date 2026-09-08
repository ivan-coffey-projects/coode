export type ContextKind =
  | "symbol"
  | "import"
  | "type"
  | "error"
  | "file"
  | "url"
  | "unknown";

export type ContextSource = "editor" | "browser" | "accessibility" | "unknown";

export interface CursorLocation {
  uri: string;
  line: number;
  column: number;
}

export interface ContextTarget {
  kind: ContextKind;
  source: ContextSource;
  language?: string;
  workspaceRoot?: string;
  processName?: string;
  location: CursorLocation;
  text: string;
  surrounding?: string;
  metadata?: Record<string, unknown>;
}

export interface InfoAction {
  label: string;
  command: string;
  args?: Record<string, unknown>;
}

export interface InfoCard {
  id: string;
  title: string;
  body: string;
  priority: number;
  source: string;
  actions?: InfoAction[];
}

export interface ProviderContext {
  config: CoodeConfig;
  signal: AbortSignal;
}

export interface InfoProvider {
  id: string;
  label: string;
  match(target: ContextTarget, config: CoodeConfig): boolean;
  fetch(target: ContextTarget, ctx: ProviderContext): Promise<InfoCard[]>;
}

export type DisplayMode = "popup" | "panel" | "both";

export interface CoodeConfig {
  server: {
    host: string;
    port: number;
  };
  display: {
    default: DisplayMode;
    hoverDelayMs: number;
    popup: {
      maxWidth: number;
      offset: { x: number; y: number };
    };
    panel: {
      dock: "left" | "right" | "floating";
    };
    overlay: {
      enabled: boolean;
    };
  };
  targets: Array<{
    id: string;
    match: { process: string[] };
    context: string;
    enabled: boolean;
  }>;
  providers: {
    lsp: { enabled: boolean; languages: string[] };
    imports: { enabled: boolean };
    diagnostics: { enabled: boolean };
    rules: { enabled: boolean };
    harness: { enabled: boolean };
  };
  rules: Array<{
    match: string;
    title: string;
    body: string;
  }>;
}

export interface ContextUpdateMessage {
  type: "context";
  target: ContextTarget;
  cards: InfoCard[];
  timestamp: number;
}

export interface BridgeContextPayload {
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
