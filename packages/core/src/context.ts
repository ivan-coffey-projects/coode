import type {
  BridgeContextPayload,
  ContextTarget,
  CoodeConfig,
  InfoCard,
  InfoProvider,
  ProviderContext,
} from "./types.js";

export function bridgePayloadToTarget(payload: BridgeContextPayload): ContextTarget {
  return {
    kind: inferKind(payload),
    source: "editor",
    language: payload.languageId,
    workspaceRoot: payload.workspaceRoot,
    processName: payload.processName,
    location: {
      uri: payload.uri,
      line: payload.line,
      column: payload.character,
    },
    text: payload.word || payload.lineText.trim(),
    surrounding: payload.surroundingLines,
    metadata: {
      lineText: payload.lineText,
    },
  };
}

function inferKind(payload: BridgeContextPayload): ContextTarget["kind"] {
  const line = payload.lineText.trim();
  if (/^(import|from)\s/.test(line) || /^import\s*\(/.test(line) || /^\s*import\s+"/.test(line)) {
    return "import";
  }
  if (payload.word) {
    return "symbol";
  }
  return "unknown";
}

export async function runProviders(
  target: ContextTarget,
  providers: InfoProvider[],
  config: CoodeConfig,
  signal: AbortSignal,
): Promise<InfoCard[]> {
  const ctx: ProviderContext = { config, signal };
  const active = providers.filter((provider) => provider.match(target, config));

  const results = await Promise.all(
    active.map(async (provider) => {
      try {
        return await provider.fetch(target, ctx);
      } catch {
        return [] as InfoCard[];
      }
    }),
  );

  return results
    .flat()
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

export { rulesProvider } from "./providers/rules.js";
export { importsProvider } from "./providers/imports.js";
export { contextProvider } from "./providers/context.js";
