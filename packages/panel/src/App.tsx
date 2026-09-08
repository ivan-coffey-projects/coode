import { useEffect, useState } from "react";
import type { ContextUpdateMessage, OrchestrationState } from "@coode/core";
import { CardList } from "./components/CardList";
import { OrchestrationDesk } from "./components/OrchestrationDesk";
import { StatusBar } from "./components/StatusBar";

const emptyMessage: ContextUpdateMessage = {
  type: "context",
  target: {
    kind: "unknown",
    source: "unknown",
    location: { uri: "", line: 0, column: 0 },
    text: "",
  },
  cards: [],
  timestamp: Date.now(),
};

type DeskTab = "desk" | "context";

export function App() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState<ContextUpdateMessage>(emptyMessage);
  const [tab, setTab] = useState<DeskTab>("desk");
  const [orchestration, setOrchestration] = useState<OrchestrationState | null>(null);
  const [orchLoading, setOrchLoading] = useState(true);
  const [orchError, setOrchError] = useState<string | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      setMessage(JSON.parse(event.data) as ContextUpdateMessage);
    };

    fetch("/api/context")
      .then((response) => response.json())
      .then((snapshot) => {
        if (snapshot?.target) {
          setMessage(snapshot as ContextUpdateMessage);
        }
      })
      .catch(() => undefined);

    return () => ws.close();
  }, []);

  useEffect(() => {
    setOrchLoading(true);
    fetch("/api/orchestration")
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }
        return response.json() as Promise<OrchestrationState>;
      })
      .then((state) => {
        setOrchestration(state);
        setOrchError(null);
      })
      .catch((error: Error) => {
        setOrchError(error.message);
      })
      .finally(() => setOrchLoading(false));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>dev-harness desk</h1>
          <p className="app__subtitle">Orchestrate modes, MCPs, LLMs — holographic popup on overlay</p>
        </div>
        <StatusBar connected={connected} target={message.target} />
      </header>

      <nav className="app__tabs" aria-label="Panel views">
        <button
          type="button"
          className={tab === "desk" ? "app__tab app__tab--active" : "app__tab"}
          onClick={() => setTab("desk")}
        >
          Desk
        </button>
        <button
          type="button"
          className={tab === "context" ? "app__tab app__tab--active" : "app__tab"}
          onClick={() => setTab("context")}
        >
          Context
        </button>
      </nav>

      <main>
        {tab === "desk" ? (
          <OrchestrationDesk
            state={orchestration}
            loading={orchLoading}
            error={orchError}
          />
        ) : (
          <CardList cards={message.cards} />
        )}
      </main>
    </div>
  );
}
