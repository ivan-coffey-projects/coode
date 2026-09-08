import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { ContextUpdateMessage, CoodeConfig, OrchestrationState } from "@coode/core";
import { OrchestrationPopup } from "./components/OrchestrationPopup";
import { Popup } from "./components/Popup";

interface RuntimeConfig {
  serverUrl: string;
  displayMode: string;
  overlayEnabled: boolean;
  maxWidth: number;
}

const defaultRuntime: RuntimeConfig = {
  serverUrl: "http://127.0.0.1:17420",
  displayMode: "both",
  overlayEnabled: true,
  maxWidth: 480,
};

export function App() {
  const [runtime, setRuntime] = useState<RuntimeConfig>(defaultRuntime);
  const [message, setMessage] = useState<ContextUpdateMessage | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationState | null>(null);
  const [connected, setConnected] = useState(false);
  const [holoPinned, setHoloPinned] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    invoke<RuntimeConfig>("get_runtime_config")
      .then((config) => setRuntime(config))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--popup-max-width",
      `${runtime.maxWidth}px`,
    );
  }, [runtime.maxWidth]);

  useEffect(() => {
    const serverUrl = runtime.serverUrl.replace(/\/$/, "");
    const wsUrl = serverUrl.replace(/^http/, "ws") + "/ws";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      setMessage(JSON.parse(event.data) as ContextUpdateMessage);
    };

    fetch(`${serverUrl}/api/config`)
      .then((response) => response.json())
      .then((config: CoodeConfig) => {
        setRuntime((current) => ({
          ...current,
          displayMode: config.display.default,
          maxWidth: config.display.popup.maxWidth,
          overlayEnabled: config.display.overlay.enabled,
        }));
      })
      .catch(() => undefined);

    fetch(`${serverUrl}/api/orchestration`)
      .then((response) => response.json())
      .then((state: OrchestrationState) => setOrchestration(state))
      .catch(() => undefined);

    const orchPoll = window.setInterval(() => {
      fetch(`${serverUrl}/api/orchestration`)
        .then((response) => response.json())
        .then((state: OrchestrationState) => setOrchestration(state))
        .catch(() => undefined);
    }, 30_000);

    fetch(`${serverUrl}/api/context`)
      .then((response) => response.json())
      .then((snapshot) => {
        if (snapshot?.target) {
          setMessage(snapshot as ContextUpdateMessage);
        }
      })
      .catch(() => undefined);

    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "H") {
        setHoloPinned((pinned) => !pinned);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      ws.close();
      window.clearInterval(orchPoll);
      window.removeEventListener("keydown", onKey);
    };
  }, [runtime.serverUrl]);

  const overlayAllowed =
    runtime.overlayEnabled &&
    (runtime.displayMode === "popup" || runtime.displayMode === "both");
  const hasCards = (message?.cards.length ?? 0) > 0;
  const contextVisible = overlayAllowed && hasCards;
  const holoVisible =
    overlayAllowed && holoPinned && orchestration !== null && !hasCards;
  const visible = contextVisible || holoVisible;

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }

    invoke("set_overlay_visible", { visible }).catch(() => undefined);

    if (!visible) {
      hideTimer.current = setTimeout(() => setMessage(null), 150);
    }
  }, [visible]);

  if (!visible && !import.meta.env.DEV) {
    return null;
  }

  if (holoVisible && orchestration) {
    return (
      <OrchestrationPopup state={orchestration} visible={holoVisible} />
    );
  }

  return (
    <Popup
      cards={message?.cards ?? []}
      connected={connected}
      targetText={message?.target.text ?? ""}
      preview={import.meta.env.DEV && !visible}
    />
  );
}
