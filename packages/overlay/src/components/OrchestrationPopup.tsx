import type { OrchestrationState } from "@coode/core";

interface OrchestrationPopupProps {
  state: OrchestrationState | null;
  visible: boolean;
}

export function OrchestrationPopup({ state, visible }: OrchestrationPopupProps) {
  if (!visible || !state) {
    return null;
  }

  const { harness, mcps, harnesses } = state;
  const modeNames = Object.keys(harness.modes);
  const modelSlots = Object.keys(harness.models);

  return (
    <div className="holo" role="dialog" aria-label="Harness orchestration">
      <div className="holo__scanlines" aria-hidden="true" />
      <header className="holo__header">
        <span className="holo__mark" aria-hidden="true" />
        <div>
          <p className="holo__eyebrow">dev-harness</p>
          <h1 className="holo__title">
            {harness.name}
            {harness.active_mode ? (
              <span className="holo__active"> · {harness.active_mode.mode}</span>
            ) : null}
          </h1>
        </div>
      </header>

      {state.host ? (
        <section className="holo__block holo__block--wide holo__vitals" aria-label="Host vitals">
          <h2>
            Host <span className={`holo__status holo__status--${state.host.vitals.status}`}>{state.host.vitals.status}</span>
          </h2>
          <div className="holo__chips">
            <span className="holo__chip">
              RAM {state.host.vitals.mem_avail_mb} MB free
            </span>
            <span className="holo__chip">
              swap {state.host.vitals.swap_used_pct.toFixed(0)}%
            </span>
            <span className="holo__chip">
              load {state.host.vitals.load_1m.toFixed(1)}
            </span>
            <span className="holo__chip">
              build {state.host.build.policy} {state.host.build.holders.length}/{state.host.build.max_concurrent}
            </span>
            {state.host.build.waiting.length > 0 ? (
              <span className="holo__chip holo__chip--warn">
                {state.host.build.waiting.length} queued
              </span>
            ) : null}
          </div>
          {state.host.alerts.length > 0 ? (
            <p className="holo__alert">{state.host.alerts[0]}</p>
          ) : null}
        </section>
      ) : null}

      <div className="holo__row">
        <section className="holo__block">
          <h2>Gateway</h2>
          <code>{harness.gateway.base_url}</code>
        </section>
        <section className="holo__block">
          <h2>Modes</h2>
          <div className="holo__chips">
            {modeNames.map((m) => (
              <span key={m} className="holo__chip">
                {m}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="holo__row">
        <section className="holo__block">
          <h2>LLMs</h2>
          <ul className="holo__list">
            {modelSlots.map((slot) => (
              <li key={slot}>
                <span>{slot}</span>
                <code>{harness.models[slot].id}</code>
              </li>
            ))}
          </ul>
        </section>
        <section className="holo__block">
          <h2>MCPs ({mcps.length})</h2>
          <ul className="holo__list">
            {mcps.slice(0, 6).map((mcp) => (
              <li key={mcp.name}>
                <span>{mcp.name}</span>
                <em>{mcp.transport}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {harnesses.length > 0 ? (
        <section className="holo__block holo__block--wide">
          <h2>Harnesses ({harnesses.length})</h2>
          <div className="holo__chips">
            {harnesses.slice(0, 10).map((h) => (
              <span key={h.path} className="holo__chip holo__chip--dim">
                {h.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
