import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { defaultConfig, mergeConfig, parseConfig } from "./config.js";
import type { CoodeConfig } from "./types.js";

export function getConfigDir(): string {
  return process.env.COODE_CONFIG_DIR ?? join(homedir(), ".config", "coode");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.yaml");
}

export async function loadConfig(workspaceConfigPath?: string): Promise<CoodeConfig> {
  let config = defaultConfig;

  try {
    const userRaw = parseYaml(await readFile(getConfigPath(), "utf8"));
    config = mergeConfig(config, userRaw);
  } catch {
    // User config is optional on first run.
  }

  if (workspaceConfigPath) {
    try {
      const workspaceRaw = parseYaml(await readFile(workspaceConfigPath, "utf8"));
      config = mergeConfig(config, workspaceRaw);
    } catch {
      // Workspace config is optional.
    }
  }

  return parseConfig(config);
}
