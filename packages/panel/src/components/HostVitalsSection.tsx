import type { HostBusState } from "@coode/core";

interface HostVitalsSectionProps {
  host: HostBusState;
}

export function HostVitalsSection({ host }: HostVitalsSectionProps) {
  const { vitals, build, alerts } = host;
  const statusClass = `desk__vitals desk__vitals--${vitals.status}`;

  return (
    <section className={statusClass} aria-label="Host vitals">
      <div className="desk__vitals-head">
        <h3>Host</h3>
        <span className="desk__pill desk__pill--status">{vitals.status}</span>
        <span className="desk__pill">
          build: {build.policy} ({build.holders.length}/{build.max_concurrent})
        </span>
        {build.waiting.length > 0 ? (
          <span className="desk__pill desk__pill--warn">{build.waiting.length} queued</span>
        ) : null}
      </div>
      <div className="desk__vitals-bars">
        <div className="desk__meter">
          <span>RAM</span>
          <div className="desk__meter-track">
            <div
              className="desk__meter-fill"
              style={{ width: `${Math.min(100, vitals.mem_used_pct)}%` }}
            />
          </div>
          <code>{vitals.mem_avail_mb} MB free</code>
        </div>
        <div className="desk__meter">
          <span>Swap</span>
          <div className="desk__meter-track">
            <div
              className="desk__meter-fill desk__meter-fill--swap"
              style={{ width: `${Math.min(100, vitals.swap_used_pct)}%` }}
            />
          </div>
          <code>{vitals.swap_used_pct.toFixed(0)}%</code>
        </div>
        <div className="desk__meter">
          <span>Load</span>
          <code>{vitals.load_1m.toFixed(1)}</code>
        </div>
      </div>
      {alerts.length > 0 ? (
        <ul className="desk__alerts">
          {alerts.map((alert) => (
            <li key={alert}>{alert}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
