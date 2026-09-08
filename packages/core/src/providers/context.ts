import type { ContextTarget, CoodeConfig, InfoCard, InfoProvider } from "../types.js";

export const contextProvider: InfoProvider = {
  id: "context",
  label: "Cursor context",
  match() {
    return true;
  },
  async fetch(target) {
    const fileName = target.location.uri.split("/").pop() ?? target.location.uri;
    const cards: InfoCard[] = [
      {
        id: "context:location",
        title: fileName,
        body: [
          `**Language:** ${target.language ?? "unknown"}`,
          `**Line:** ${target.location.line + 1}, column ${target.location.column + 1}`,
          `**Token:** \`${target.text || "(empty)"}\``,
          target.workspaceRoot ? `**Workspace:** ${target.workspaceRoot}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        priority: 10,
        source: "context",
      },
    ];

    if (target.surrounding?.trim()) {
      cards.push({
        id: "context:surrounding",
        title: "Nearby code",
        body: ["```", target.surrounding.trim(), "```"].join("\n"),
        priority: 5,
        source: "context",
      });
    }

    return cards;
  },
};
