import type { OrchestrationState } from "@coode/core";
import { HostVitalsSection } from "./HostVitalsSection";

interface OrchestrationDeskProps {
  state: OrchestrationState | null;
  loading: boolean;
  error: string | null;
}

export function OrchestrationDesk({ state, loading, error }: OrchestrationDeskProps) {
  if (loading) {
    return (
      <div className="desk desk--loading">
        <p>Loading orchestration…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="desk desk--error">
        <h2>Orchestration unavailable</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  const { harness, mcps, harnesses } = state;

  return (
    <div className="desk">
      <section className="desk__section desk__section--hero">
        <p className="desk__eyebrow">Holographic config</p>
        <h2>{harness.name}</h2>
        <p className="desk__gateway">
          Gateway <code>{harness.gateway.base_url}</code>
          <span className="desk__pill">{harness.gateway.default}</span>
          {harness.active_mode ? (
            <span className="desk__pill desk__pill--active">
              active: {harness.active_mode.mode}
            </span>
          ) : null}
        </p>
      </section>

      {state.host ? <HostVitalsSection host={state.host} /> : null}

      <div className="desk__grid">
        <section className="desk__section">
          <h3>Modes</h3>
          <ul className="desk__list">
            {Object.entries(harness.modes).map(([name, mode]) => (
              <li key={name} className="desk__item">
                <span className="desk__item-title">{name}</span>
                <span className="desk__item-meta">
                  {mode.model} · {mode.tools.length} tools
                </span>
                <span className="desk__item-desc">{mode.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="desk__section">
          <h3>LLMs</h3>
          <ul className="desk__list">
            {Object.entries(harness.models).map(([slot, spec]) => (
              <li key={slot} className="desk__item desk__item--compact">
                <span className="desk__item-title">{slot}</span>
                <code className="desk__model-id">{spec.id}</code>
                <span className="desk__tags">{spec.tags.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="desk__section">
          <h3>MCPs</h3>
          {mcps.length === 0 ? (
            <p className="desk__empty">No MCP servers in .cursor/mcp.json</p>
          ) : (
            <ul className="desk__list">
              {mcps.map((mcp) => (
                <li key={mcp.name} className="desk__item desk__item--compact">
                  <span className="desk__item-title">{mcp.name}</span>
                  <span className="desk__item-meta">{mcp.transport}</span>
                  <code className="desk__mcp-detail">
                    {mcp.url ?? [mcp.command, ...(mcp.args ?? [])].filter(Boolean).join(" ")}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="desk__section">
          <h3>Harnesses</h3>
          {harnesses.length === 0 ? (
            <p className="desk__empty">No other harness.yaml projects found</p>
          ) : (
            <ul className="desk__list">
              {harnesses.map((h) => (
                <li key={h.path} className="desk__item desk__item--compact">
                  <span className="desk__item-title">{h.name}</span>
                  <span className="desk__pill desk__pill--tier">{h.tier}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
