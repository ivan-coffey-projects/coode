#!/usr/bin/env node
import { startServer } from "./server.js";

const workspaceConfig = process.env.COODE_WORKSPACE_CONFIG;
const harnessRoot = process.env.DEV_HARNESS_ROOT;

startServer({ workspaceConfigPath: workspaceConfig, harnessRoot }).catch((error) => {
  console.error("Failed to start coode-server:", error);
  process.exit(1);
});
