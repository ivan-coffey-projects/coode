import Markdown from "react-markdown";
import type { InfoCard } from "@coode/core";

interface PopupProps {
  cards: InfoCard[];
  connected: boolean;
  targetText: string;
  preview?: boolean;
}

export function Popup({ cards, connected, targetText, preview }: PopupProps) {
  if (cards.length === 0) {
    return preview ? (
      <div className="popup popup--preview">
        <p>coode overlay preview — waiting for context from server</p>
      </div>
    ) : null;
  }

  const topCards = cards.slice(0, 2);

  return (
    <div className="popup" data-connected={connected}>
      {targetText ? <div className="popup__token">{targetText}</div> : null}
      {topCards.map((card) => (
        <article key={card.id} className="popup__card">
          <header className="popup__card-header">
            <h2>{card.title}</h2>
            <span>{card.source}</span>
          </header>
          <div className="popup__card-body">
            <Markdown>{card.body}</Markdown>
          </div>
        </article>
      ))}
    </div>
  );
}
