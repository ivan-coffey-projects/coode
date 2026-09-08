import {
  bridgePayloadToTarget,
  contextProvider,
  importsProvider,
  loadConfig,
  rulesProvider,
  harnessProvider,
  runProviders,
  type BridgeContextPayload,
  type CoodeConfig,
  type ContextTarget,
  type ContextUpdateMessage,
  type InfoCard,
  type InfoProvider,
} from "@coode/core";
import {
  createDiagnosticsProvider,
  createLspProvider,
  LspPool,
} from "./lsp/pool.js";

export class CoodeEngine {
  private config: CoodeConfig;
  private currentTarget: ContextTarget | null = null;
  private currentCards: InfoCard[] = [];
  private abortController: AbortController | null = null;
  private listeners = new Set<(message: ContextUpdateMessage) => void>();
  private readonly lspPool = new LspPool();
  private readonly providers: InfoProvider[];

  private constructor(config: CoodeConfig) {
    this.config = config;
    this.providers = [
      createDiagnosticsProvider(this.lspPool),
      createLspProvider(this.lspPool),
      rulesProvider,
      harnessProvider,
      importsProvider,
      contextProvider,
    ];
  }

  static async create(workspaceConfigPath?: string): Promise<CoodeEngine> {
    const config = await loadConfig(workspaceConfigPath);
    return new CoodeEngine(config);
  }

  getConfig(): CoodeConfig {
    return this.config;
  }

  getSnapshot(): ContextUpdateMessage | null {
    if (!this.currentTarget) {
      return null;
    }

    return {
      type: "context",
      target: this.currentTarget,
      cards: this.currentCards,
      timestamp: Date.now(),
    };
  }

  subscribe(listener: (message: ContextUpdateMessage) => void): () => void {
    this.listeners.add(listener);
    const snapshot = this.getSnapshot();
    if (snapshot) {
      listener(snapshot);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  async updateFromBridge(payload: BridgeContextPayload): Promise<ContextUpdateMessage> {
    const target = bridgePayloadToTarget(payload);
    return this.updateTarget(target);
  }

  async updateTarget(target: ContextTarget): Promise<ContextUpdateMessage> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    this.currentTarget = target;
    this.currentCards = await runProviders(
      target,
      this.providers,
      this.config,
      this.abortController.signal,
    );

    const message: ContextUpdateMessage = {
      type: "context",
      target,
      cards: this.currentCards,
      timestamp: Date.now(),
    };

    for (const listener of this.listeners) {
      listener(message);
    }

    return message;
  }
}
