# coode

Self-hosted contextual info for coding: a local server, editor bridge, side panel, and desktop holographic overlay for whatever your cursor is on.

The desk defaults to `http://127.0.0.1:17420/`. Use the commands below for a
standalone checkout.

## Packages

| Package | Purpose |
|---------|---------|
| `@coode/core` | Shared types, config schema, providers |
| `@coode/server` | Local HTTP + WebSocket API on `127.0.0.1:17420` |
| `@coode/panel` | React side panel UI |
| `@coode/overlay` | Tauri cursor-following popup |
| `coode-bridge` | Cursor/VS Code extension that sends cursor context |

## Quick start

The root package declares Node.js 20+ and pnpm 10.6.5. The locked Vite 7 frontend
requires Node.js 20.19+ or 22.12+. `pnpm build` builds the TypeScript packages and
the panel/overlay web assets; it does not compile or package the native Tauri app.
Native overlay development also needs Rust/Cargo and platform libraries.

```bash
pnpm install
pnpm build

# Start the server (keep this terminal open)
pnpm start
# or for auto-reload during development:
pnpm dev:server

# Terminal 2 — panel hot reload (optional during UI work)
pnpm dev:panel

# Terminal 3 — cursor overlay (requires coode-server running)
pnpm dev:overlay
```

The server serves the built panel. Panel hot reload uses port 5173 and proxies
API/WebSocket requests to port 17420; changing the server port also requires
adjusting those development proxies.

### Config

Copy the example config:

```bash
mkdir -p ~/.config/coode
cp configs/example-config.yaml ~/.config/coode/config.yaml
```

The server loads defaults, then `config.yaml` from `COODE_CONFIG_DIR` (default
`~/.config/coode`), then the optional file named by `COODE_WORKSPACE_CONFIG`.
Overrides replace top-level sections rather than deep-merging them. Unreadable
or invalid optional files are ignored, so verify the effective configuration at
`/api/config` instead of assuming an override loaded.

The native overlay initially reads only the user config to find the server;
`COODE_WORKSPACE_CONFIG` does not change that address. Keep its user config and
the bridge's `coode.serverUrl` aligned with the server. `DEV_HARNESS_ROOT` is
optional and supplies the orchestration endpoint's harness checkout; without it,
the endpoint looks in the server's working directory. It needs `harness.yaml`
and may read that checkout's cached orchestration and MCP metadata.

### Bridge extension

```bash
cd packages/bridge-vscode
pnpm build
```

Then in Cursor/VS Code:

Open `packages/bridge-vscode` in an Extension Development Host using your editor's
development tooling. This repository does not provide a launch configuration or
a prebuilt VSIX. Its optional `package` script calls `vsce`, which is not declared
as a dependency, so building the extension alone does not produce a VSIX.

Commands:

- `dev-harness: Open Desk` (`coode.openPanel`) — opens the configured server URL
- `dev-harness: Push Context` (`coode.pushContext`) — manual refresh
- `dev-harness: Toggle Holographic Config` (`coode.toggleHolo`) — refreshes
  orchestration; it does not directly toggle the native window

Settings:

- `coode.serverUrl` — default `http://127.0.0.1:17420`
- `coode.enabled` — toggle bridge
- `coode.debounceMs` — delay before sending selection/edit updates (default 300 ms)

## Architecture

```
Cursor (bridge-vscode)
        │ POST /api/context
        ▼
coode-server ──WebSocket──► coode-panel
        │
        ├──WebSocket──► coode-overlay (cursor popup)
        └── providers: rules, imports, manifest, LSP hover, diagnostics, context
```

## Commands

```bash
pnpm --filter @coode/core build  # server tests import core's dist/ exports
pnpm test                       # core + server tests
pnpm build                      # build packages and overlay web assets
pnpm start                      # run server at http://127.0.0.1:17420
```

The orchestration integration test is skipped when `DEV_HARNESS_ROOT` is unset;
when set, it expects a compatible dev-harness fixture. Core/server checks cover
providers, HTTP, WebSocket and missing-language-server handling. They do not
establish real language-server integration or visual editor/panel/overlay behavior.
Use isolated networking and an empty user config for offline tests; do not point
them at private harness/runtime data.

### Optional language servers (for LSP hover + diagnostics)

The server looks for these executables on `PATH` for richer symbol cards:

- TypeScript/JavaScript: `typescript-language-server`
- Python: `pyright-langserver`
- Go: `gopls`

### Overlay

The overlay is a transparent, always-on-top Tauri window that follows your mouse when context cards are available.

```bash
pnpm dev:server   # terminal 1
pnpm dev:overlay  # terminal 2
```

Config (`display.default`):

- `popup` — overlay only
- `panel` — side panel only
- `both` — overlay + panel

Set `display.overlay.enabled: false` to disable the overlay entirely.

**Linux note:** global cursor tracking works best on X11. Wayland support varies by compositor.

### Pet status

This checkout has no `packages/pet` workspace. The root `dev:pet` and `start:pet`
scripts reference the absent `@coode/pet` package; they cannot launch a pet from
this tree. Pet launch and screenshot instructions do not apply to this checkout.

**Native build:** this public snapshot disables Tauri bundling because private
icon assets are excluded. Supply your own icons and enable `bundle.active` before
running the separate packaging step. Linux also needs WebKit/GTK development
libraries in addition to Rust/Cargo.

## Privacy and release limits

The bridge sends file paths and nearby source lines to the server. HTTP and
WebSocket routes have no authentication, and HTTP CORS is permissive. Keep the
desk on a trusted local machine; do not expose it as a public service. Harness
views can also reveal local paths, endpoint URLs and MCP command arguments.

Original code and documentation are licensed under MIT; see [LICENSE](LICENSE).
Private deployment configuration and asset files are excluded from this public snapshot.
