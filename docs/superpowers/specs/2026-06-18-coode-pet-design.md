# coode Pet — Design Spec

**Date:** 2026-06-18
**Status:** Approved

## Goal

A taskbar companion that explains selected code. Answers appear on the robot's face screen; the LLM also returns a **mood** that drives eye expression.

## Core loop

```
Global hotkey → grab selection (clipboard) → Ollama LLM → { text, mood } → face display
```

## What drives what

| Concern | Owner |
|---------|--------|
| Answer text | LLM (`text` field) |
| Eye expression | LLM (`mood` field) |
| Typewriter / scroll / layout | Renderer |
| Walk along taskbar | App state machine |
| Errors (no selection, Ollama down) | App copy on face, mood `alert` |

## LLM contract

```json
{
  "text": "This function mutates the array in place…",
  "mood": "neutral"
}
```

**Moods (LLM):** `neutral`, `pleased`, `alert`, `surprised`
**Moods (app-only):** `thinking` (while waiting), `speaking` (during typewriter)

System prompt constrains JSON output. Ollama `format: json` when available.

## Graphics (v1)

Assist-first, simple 2D:

- Layered CSS robot (reference-inspired chibi silhouette)
- HTML face screen with wrapped text
- Green pixel-style eyes; CSS variants per mood
- Horizontal patrol along bottom of screen (`translateX` + bob)

3D / GLTF deferred to v1.5.

## Architecture

```
packages/pet/
  src/main/       Electron: overlay window, globalShortcut, clipboard, LLM, STT stub
  src/renderer/   Robot sprite, face renderer, patrol + assist state machine
  assets/         Reference art
```

Separate from `@coode/overlay` (cursor-following context popup). Pet is hotkey-driven code assist.

## Voice (deferred)

`STTProvider` interface + IPC registered; returns `{ ok: false, reason: 'not_implemented' }` until Whisper is wired.

## Config

`~/.config/coode/pet.json`:

- `hotkey` (default `CommandOrControl+Shift+.`)
- `ollama.baseUrl`, `ollama.model`
- `patrolSpeed`, `displayTimeoutMs`

## Platform notes

- Linux: selection via simulated Ctrl+C (`xdotool` when available)
- Wayland: clipboard grab may be flaky; show honest error on face
- Transparent always-on-top strip along taskbar (`workArea` bottom)

## Out of scope (v1)

- Hermes gateway, TTS, lip-sync
- Three.js / GLTF robot
- VS Code bridge integration (pet is global hotkey)
