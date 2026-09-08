import { z } from "zod";
import type { CoodeConfig } from "./types.js";

const displayModeSchema = z.enum(["popup", "panel", "both"]);

export const coodeConfigSchema = z.object({
  server: z
    .object({
      host: z.string().default("127.0.0.1"),
      port: z.number().int().min(1).max(65535).default(17420),
    })
    .default({}),
  display: z
    .object({
      default: displayModeSchema.default("both"),
      hoverDelayMs: z.number().int().min(0).default(350),
      popup: z
        .object({
          maxWidth: z.number().int().min(200).default(420),
          offset: z
            .object({
              x: z.number().int().default(16),
              y: z.number().int().default(16),
            })
            .default({}),
        })
        .default({}),
      panel: z
        .object({
          dock: z.enum(["left", "right", "floating"]).default("right"),
        })
        .default({}),
      overlay: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),
  targets: z
    .array(
      z.object({
        id: z.string(),
        match: z.object({
          process: z.array(z.string()).min(1),
        }),
        context: z.string(),
        enabled: z.boolean().default(true),
      }),
    )
    .default([]),
  providers: z
    .object({
      lsp: z
        .object({
          enabled: z.boolean().default(true),
          languages: z
            .array(z.string())
            .default(["typescript", "javascript", "python", "go"]),
        })
        .default({}),
      imports: z.object({ enabled: z.boolean().default(true) }).default({}),
      diagnostics: z.object({ enabled: z.boolean().default(true) }).default({}),
      rules: z.object({ enabled: z.boolean().default(true) }).default({}),
      harness: z.object({ enabled: z.boolean().default(true) }).default({}),
    })
    .default({}),
  rules: z
    .array(
      z.object({
        match: z.string(),
        title: z.string(),
        body: z.string(),
      }),
    )
    .default([]),
});

export const defaultConfig: CoodeConfig = coodeConfigSchema.parse({});

export function parseConfig(raw: unknown): CoodeConfig {
  return coodeConfigSchema.parse(raw);
}

export function mergeConfig(base: CoodeConfig, override: unknown): CoodeConfig {
  return coodeConfigSchema.parse({
    ...base,
    ...(typeof override === "object" && override !== null ? override : {}),
  });
}
