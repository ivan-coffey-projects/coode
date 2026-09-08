import type { InfoCard, InfoProvider } from "../types.js";
import { loadOrchestration } from "../orchestration.js";

function formatOrchestrationMarkdown(
  state: Awaited<ReturnType<typeof loadOrchestration>>,
): string {
  const lines: string[] = [];
  const { harness, mcps, harnesses } = state;

  lines.push(`**Gateway:** \`${harness.gateway.base_url}\` (${harness.gateway.default})`);
  lines.push("");
  lines.push("**Models**");
  for (const [slot, spec] of Object.entries(harness.models)) {
    lines.push(`- \`${slot}\` → \`${spec.id}\` [${spec.tags.join(", ")}]`);
  }
  lines.push("");
  lines.push("**Modes**");
  for (const [name, mode] of Object.entries(harness.modes)) {
    lines.push(`- **${name}** — ${mode.model} · ${mode.tools.join(", ") || "—"}`);
  }
  lines.push("");
  lines.push(`**MCPs** (${mcps.length})`);
  for (const mcp of mcps) {
    const detail =
      mcp.transport === "url"
        ? mcp.url
        : mcp.command
          ? [mcp.command, ...(mcp.args ?? [])].join(" ")
          : "—";
    lines.push(`- \`${mcp.name}\` (${mcp.transport}) — ${detail}`);
  }
  if (harnesses.length > 0) {
    lines.push("");
    lines.push(`**Other harnesses** (${harnesses.length})`);
    for (const h of harnesses.slice(0, 8)) {
      lines.push(`- **${h.name}** [${h.tier}]`);
    }
    if (harnesses.length > 8) {
      lines.push(`- …and ${harnesses.length - 8} more`);
    }
  }
  return lines.join("\n");
}

export const harnessProvider: InfoProvider = {
  id: "harness",
  label: "Harness orchestration",

  match(target, config) {
    if (!config.providers.harness?.enabled) {
      return false;
    }
    const text = target.text.toLowerCase();
    const keywords = [
      "harness",
      "mcp",
      "mode",
      "gateway",
      "orchestrat",
      "new-api",
      "codex",
      "cursor",
    ];
    return keywords.some((k) => text.includes(k));
  },

  async fetch(target, ctx) {
    const root =
      target.workspaceRoot ??
      process.env.DEV_HARNESS_ROOT ??
      process.cwd();

    try {
      const state = await loadOrchestration(root);
      const cards: InfoCard[] = [
        {
          id: "harness-orchestration",
          title: `${state.harness.name} orchestration`,
          body: formatOrchestrationMarkdown(state),
          priority: 90,
          source: "harness",
        },
      ];

      const modeMatch = Object.keys(state.harness.modes).find(
        (m) => target.text.toLowerCase() === m.toLowerCase(),
      );
      if (modeMatch) {
        const mode = state.harness.modes[modeMatch];
        const modelId = state.harness.models[mode.model]?.id ?? mode.model;
        cards.unshift({
          id: `mode-${modeMatch}`,
          title: `Mode: ${modeMatch}`,
          body: `${mode.description}\n\n**Model:** \`${modelId}\`\n**Tools:** ${mode.tools.join(", ")}\n**Write:** ${mode.write}`,
          priority: 100,
          source: "harness",
        });
      }

      return cards;
    } catch {
      return [
        {
          id: "harness-missing",
          title: "Harness not found",
          body: `No harness.yaml at \`${root}\`. Set DEV_HARNESS_ROOT or open a harness workspace.`,
          priority: 50,
          source: "harness",
        },
      ];
    }
  },
};
