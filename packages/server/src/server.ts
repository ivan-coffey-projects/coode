import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getConfigDir,
  loadOrchestration,
  type BridgeContextPayload,
  type ContextUpdateMessage,
} from "@coode/core";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import { CoodeEngine } from "./engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  workspaceConfigPath?: string;
  harnessRoot?: string;
  panelDistPath?: string;
  port?: number;
  host?: string;
  quiet?: boolean;
}

export async function startServer(options: ServerOptions = {}) {
  const engine = await CoodeEngine.create(options.workspaceConfigPath);
  const config = engine.getConfig();
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      configDir: getConfigDir(),
      display: config.display.default,
    });
  });

  app.get("/api/config", (_req, res) => {
    res.json(config);
  });

  const harnessRoot =
    options.harnessRoot ??
    process.env.DEV_HARNESS_ROOT ??
    process.cwd();

  app.get("/api/orchestration", async (_req, res) => {
    try {
      const state = await loadOrchestration(harnessRoot);
      res.json(state);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "orchestration failed",
      });
    }
  });

  app.get("/api/context", (_req, res) => {
    const snapshot = engine.getSnapshot();
    res.json(snapshot ?? { type: "context", target: null, cards: [], timestamp: Date.now() });
  });

  app.post("/api/context", async (req, res) => {
    const payload = req.body as BridgeContextPayload;
    const message = await engine.updateFromBridge(payload);
    res.json(message);
  });

  const panelDist =
    options.panelDistPath ?? join(__dirname, "../../panel/dist");

  app.use(express.static(panelDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(panelDist, "index.html"));
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    const unsubscribe = engine.subscribe((message: ContextUpdateMessage) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });

    socket.on("close", unsubscribe);
  });

  const host = options.host ?? config.server.host;
  const port = options.port ?? config.server.port;

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  if (!options.quiet) {
    const address = server.address();
    const actualPort =
      typeof address === "object" && address ? address.port : port;
    console.log(`coode-server listening on http://${host}:${actualPort}`);
    console.log(`panel UI: http://${host}:${actualPort}/`);
    console.log(`config dir: ${getConfigDir()}`);
  }

  return { server, engine, config };
}
