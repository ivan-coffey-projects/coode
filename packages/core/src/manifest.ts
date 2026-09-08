import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ManifestResolution {
  moduleName: string;
  version?: string;
  source: "package.json" | "go.mod" | "pyproject.toml" | "requirements.txt";
  detail: string;
}

export async function resolveImport(
  moduleName: string,
  language: string,
  workspaceRoot: string,
): Promise<ManifestResolution | undefined> {
  switch (language) {
    case "typescript":
    case "javascript":
    case "typescriptreact":
    case "javascriptreact":
      return resolveFromPackageJson(moduleName, workspaceRoot);
    case "python":
      return (
        (await resolveFromPyproject(moduleName, workspaceRoot)) ??
        (await resolveFromRequirements(moduleName, workspaceRoot))
      );
    case "go":
      return resolveFromGoMod(moduleName, workspaceRoot);
    default:
      return undefined;
  }
}

async function resolveFromPackageJson(
  moduleName: string,
  workspaceRoot: string,
): Promise<ManifestResolution | undefined> {
  try {
    const raw = await readFile(join(workspaceRoot, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const version =
      pkg.dependencies?.[moduleName] ?? pkg.devDependencies?.[moduleName];

    if (!version) {
      const scoped = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).find(
        (name) => moduleName.startsWith(name),
      );
      if (!scoped) {
        return undefined;
      }
      return {
        moduleName,
        version: pkg.dependencies?.[scoped] ?? pkg.devDependencies?.[scoped],
        source: "package.json",
        detail: `Matched scoped package \`${scoped}\` in package.json`,
      };
    }

    return {
      moduleName,
      version,
      source: "package.json",
      detail: `Listed in package.json dependencies`,
    };
  } catch {
    return undefined;
  }
}

async function resolveFromPyproject(
  moduleName: string,
  workspaceRoot: string,
): Promise<ManifestResolution | undefined> {
  try {
    const raw = await readFile(join(workspaceRoot, "pyproject.toml"), "utf8");
    const normalized = moduleName.toLowerCase().replace(/-/g, "[-_]");
    const pattern = new RegExp(`["']?${normalized}["']?\\s*=\\s*["']([^"']+)["']`, "i");
    const match = raw.match(pattern);

    if (!match) {
      return undefined;
    }

    return {
      moduleName,
      version: match[1],
      source: "pyproject.toml",
      detail: "Listed in pyproject.toml project dependencies",
    };
  } catch {
    return undefined;
  }
}

async function resolveFromRequirements(
  moduleName: string,
  workspaceRoot: string,
): Promise<ManifestResolution | undefined> {
  try {
    const raw = await readFile(join(workspaceRoot, "requirements.txt"), "utf8");
    const lines = raw.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^([a-zA-Z0-9_.-]+)(?:[=<>!~]+(.+))?/);
      if (match?.[1]?.toLowerCase() === moduleName.toLowerCase()) {
        return {
          moduleName,
          version: match[2] ?? "unspecified",
          source: "requirements.txt",
          detail: "Listed in requirements.txt",
        };
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

async function resolveFromGoMod(
  moduleName: string,
  workspaceRoot: string,
): Promise<ManifestResolution | undefined> {
  try {
    const raw = await readFile(join(workspaceRoot, "go.mod"), "utf8");
    const moduleMatch = raw.match(/^module\s+(\S+)/m);
    const modulePath = moduleMatch?.[1];

    if (modulePath && (moduleName === modulePath || moduleName.startsWith(`${modulePath}/`))) {
      return {
        moduleName,
        source: "go.mod",
        detail: `Internal module path under \`${modulePath}\``,
      };
    }

    const requireMatch = raw.match(
      new RegExp(`require\\s+${escapeRegExp(moduleName)}\\s+(\\S+)`, "m"),
    );

    if (requireMatch) {
      return {
        moduleName,
        version: requireMatch[1],
        source: "go.mod",
        detail: "Listed in go.mod require block",
      };
    }

    if (isGoStdLib(moduleName)) {
      return {
        moduleName,
        source: "go.mod",
        detail: "Go standard library package",
      };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function isGoStdLib(moduleName: string): boolean {
  return !moduleName.includes(".") && !moduleName.includes("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
