import type { ContextTarget } from "@coode/core";

interface StatusBarProps {
  connected: boolean;
  target: ContextTarget;
}

export function StatusBar({ connected, target }: StatusBarProps) {
  const fileName = target.location.uri
    ? target.location.uri.split("/").pop()
    : "no file";

  return (
    <div className="status">
      <span className={connected ? "status__dot status__dot--on" : "status__dot"} />
      <span>{connected ? "Connected" : "Disconnected"}</span>
      <span className="status__divider">•</span>
      <span>{fileName}</span>
      {target.text ? (
        <>
          <span className="status__divider">•</span>
          <code>{target.text}</code>
        </>
      ) : null}
    </div>
  );
}
