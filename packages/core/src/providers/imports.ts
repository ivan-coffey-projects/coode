import type { ContextTarget, CoodeConfig, InfoCard, InfoProvider } from "../types.js";
import { resolveImport } from "../manifest.js";

const IMPORT_PATTERNS = [
  /^import\s+.+from\s+['"]([^'"]+)['"]/,
  /^from\s+['"]([^'"]+)['"]\s+import/,
  /^import\s+['"]([^'"]+)['"]/,
  /^import\s*\(\s*['"]([^'"]+)['"]\s*\)/,
  /^\s*import\s+"([^"]+)"/,
  /^import\s+([a-zA-Z0-9_.]+)/,
  /^import\s+(?:\w+\s+)?"([^"]+)"/,
];

export const importsProvider: InfoProvider = {
  id: "imports",
  label: "Import resolver",
  match(target, config) {
    return config.providers.imports.enabled && target.kind === "import";
  },
  async fetch(target) {
    const lineText =
      typeof target.metadata?.lineText === "string"
        ? target.metadata.lineText
        : target.surrounding ?? "";

    const moduleName = extractModuleName(lineText);
    if (!moduleName) {
      return [];
    }

    const language = target.language ?? "unknown";
    let manifestBody: string | undefined;

    if (target.workspaceRoot) {
      const resolved = await resolveImport(moduleName, language, target.workspaceRoot);
      if (resolved) {
        manifestBody = [
          `**Source:** ${resolved.source}`,
          resolved.version ? `**Version:** \`${resolved.version}\`` : "",
          resolved.detail,
        ]
          .filter(Boolean)
          .join("\n\n");
      }
    }

    if (!manifestBody) {
      const manifestHint = manifestFileForLanguage(language);
      manifestBody = [
        `Module \`${moduleName}\` on line ${target.location.line + 1}.`,
        manifestHint
          ? `Not found in \`${manifestHint}\` — may be stdlib or transitive.`
          : "No manifest mapping for this language yet.",
      ].join("\n\n");
    }

    return [
      {
        id: `imports:${moduleName}`,
        title: `Import: ${moduleName}`,
        body: manifestBody,
        priority: 70,
        source: "imports",
      },
    ];
  },
};

function extractModuleName(lineText: string): string | undefined {
  for (const pattern of IMPORT_PATTERNS) {
    const match = lineText.trim().match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

function manifestFileForLanguage(language: string): string | undefined {
  switch (language) {
    case "typescript":
    case "javascript":
    case "typescriptreact":
    case "javascriptreact":
      return "package.json";
    case "python":
      return "pyproject.toml";
    case "go":
      return "go.mod";
    default:
      return undefined;
  }
}
