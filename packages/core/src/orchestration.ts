import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface McpServerInfo {
  name: string;
  transport: "stdio" | "url" | "unknown";
  command?: string;
  args?: string[];
  url?: string;
}

export interface HarnessRef {
  name: string;
  path: string;
  tier: "boiler-room" | "main-stage" | "local";
}

export interface HostVitalsState {
  hostname: string;
  mem_total_mb: number;
  mem_avail_mb: number;
  mem_used_pct: number;
  swap_total_mb: number;
  swap_used_mb: number;
  swap_used_pct: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
  status: "ok" | "warn" | "critical";
  reasons: string[];
}

export interface HostBusState {
  updated: string;
  hostname: string;
  vitals: HostVitalsState;
  build: {
    policy: "warn" | "gate" | "queue" | "kill";
    max_concurrent: number;
    holders: Array<{
      token: string;
      pid: number;
      harness: string;
      project: string;
      mode: string;
      since: string;
    }>;
    waiting: Array<{
      token: string;
      harness: string;
      project: string;
      mode: string;
      since: string;
    }>;
  };
  alerts: string[];
}

export interface OrchestrationState {
  harness: {
    name: string;
    version: number;
    root: string;
    active_mode?: { mode: string; updated: string } | null;
    gateway: {
      default: string;
      base_url: string;
      api_key_env: string;
    };
    models: Record<string, { id: string; tags: string[] }>;
    modes: Record<
      string,
      { description: string; model: string; tools: string[]; write: boolean }
    >;
    routing: { default: string; keywords: Record<string, string[]> };
  };
  host?: HostBusState;
  mcps: McpServerInfo[];
  harnesses: HarnessRef[];
  render: {
    targets: string[];
    cursor_mcp: string;
    codex_config: string;
  };
}

const BOILER_ROOM = join(homedir(), "CODE", "Boiler Room", "_current");
const MAIN_STAGE = join(homedir(), "CODE", "Main Stage");

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readMcpServers(harnessRoot: string): Promise<McpServerInfo[]> {
  const mcpPath = join(harnessRoot, ".cursor", "mcp.json");
  if (!(await fileExists(mcpPath))) {
    return [];
  }
  try {
    const raw = JSON.parse(await readFile(mcpPath, "utf8")) as Record<
      string,
      unknown
    >;
    const servers =
      (raw.mcpServers as Record<string, Record<string, unknown>>) ??
      (raw.mcp_servers as Record<string, Record<string, unknown>>) ??
      {};
    return Object.entries(servers).map(([name, spec]) => {
      if (spec.url) {
        return {
          name,
          transport: "url" as const,
          url: String(spec.url),
        };
      }
      if (spec.command) {
        return {
          name,
          transport: "stdio" as const,
          command: String(spec.command),
          args: Array.isArray(spec.args) ? spec.args.map(String) : undefined,
        };
      }
      return { name, transport: "unknown" as const };
    });
  } catch {
    return [];
  }
}

async function discoverHarnesses(): Promise<HarnessRef[]> {
  const found: HarnessRef[] = [];
  const bases: Array<{ path: string; tier: HarnessRef["tier"] }> = [
    { path: BOILER_ROOM, tier: "boiler-room" },
    { path: MAIN_STAGE, tier: "main-stage" },
  ];

  for (const base of bases) {
    if (!(await fileExists(base.path))) {
      continue;
    }
    let entries: string[];
    try {
      entries = await readdir(base.path);
    } catch {
      continue;
    }
    for (const name of entries.sort()) {
      const child = join(base.path, name);
      if (await fileExists(join(child, "harness.yaml"))) {
        found.push({ name, path: child, tier: base.tier });
      }
    }
  }
  return found;
}

export async function loadOrchestration(
  harnessRoot: string,
): Promise<OrchestrationState> {
  const cached = join(harnessRoot, ".harness", "orchestration.json");
  const harnessYaml = join(harnessRoot, "harness.yaml");

  // Rebuild if cached is stale or missing
  let useCache = false;
  if (await fileExists(cached)) {
    try {
      const cachedStat = await stat(cached);
      const yamlStat = await stat(harnessYaml);
      useCache = cachedStat.mtimeMs >= yamlStat.mtimeMs;
    } catch {
      useCache = false;
    }
  }
  if (useCache) {
    try {
      return JSON.parse(await readFile(cached, "utf8")) as OrchestrationState;
    } catch {
      // fall through to live read
    }
  }

  const raw = parseYaml(await readFile(harnessYaml, "utf8")) as Record<
    string,
    unknown
  >;

  const gateway = raw.gateway as OrchestrationState["harness"]["gateway"] & {
    endpoints: Record<
      string,
      { base_url: string; api_key_env?: string }
    >;
  };
  const defaultGw = gateway.default;
  const ep = gateway.endpoints[defaultGw];

  const modelsRaw = (raw.models ?? {}) as Record<
    string,
    { id: string; tags?: string[] }
  >;
  const modesRaw = (raw.modes ?? {}) as Record<
    string,
    {
      description?: string;
      model: string;
      tools?: string[];
      write?: boolean;
    }
  >;
  const routing = (raw.routing ?? {}) as {
    default?: string;
    keywords?: Record<string, string[]>;
  };
  const render = (raw.render ?? {}) as {
    targets?: string[];
    cursor?: { mcp_file?: string };
    codex?: { config_file?: string };
  };

  let activeMode: OrchestrationState["harness"]["active_mode"] = null;
  const activePath = join(harnessRoot, ".harness", "active-mode.json");
  if (await fileExists(activePath)) {
    try {
      const activeRaw = JSON.parse(await readFile(activePath, "utf8")) as {
        mode?: string;
        updated?: string;
      };
      if (activeRaw.mode) {
        activeMode = {
          mode: activeRaw.mode,
          updated: activeRaw.updated ?? "",
        };
      }
    } catch {
      activeMode = null;
    }
  }

  return {
    harness: {
      name: String(raw.name ?? "dev-harness"),
      version: Number(raw.version ?? 1),
      root: harnessRoot,
      active_mode: activeMode,
      gateway: {
        default: defaultGw,
        base_url: ep.base_url,
        api_key_env: ep.api_key_env ?? "NEWAPI_API_KEY",
      },
      models: Object.fromEntries(
        Object.entries(modelsRaw).map(([k, v]) => [
          k,
          { id: v.id, tags: v.tags ?? [] },
        ]),
      ),
      modes: Object.fromEntries(
        Object.entries(modesRaw).map(([k, v]) => [
          k,
          {
            description: v.description ?? "",
            model: v.model,
            tools: v.tools ?? [],
            write: v.write ?? false,
          },
        ]),
      ),
      routing: {
        default: routing.default ?? "build",
        keywords: routing.keywords ?? {},
      },
    },
    mcps: await readMcpServers(harnessRoot),
    harnesses: await discoverHarnesses(),
    render: {
      targets: render.targets ?? ["cursor", "codex"],
      cursor_mcp: render.cursor?.mcp_file ?? ".cursor/mcp.json",
      codex_config: render.codex?.config_file ?? ".codex/config.toml",
    },
  };
}
