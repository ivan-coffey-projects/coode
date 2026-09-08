import Markdown from "react-markdown";
import type { InfoCard } from "@coode/core";

interface CardListProps {
  cards: InfoCard[];
}

export function CardList({ cards }: CardListProps) {
  if (cards.length === 0) {
    return (
      <section className="empty">
        <h2>Waiting for context</h2>
        <p>
          Open a file in Cursor with the coode bridge enabled, then move the
          cursor over a symbol or import.
        </p>
      </section>
    );
  }

  return (
    <section className="card-list">
      {cards.map((card) => (
        <article key={card.id} className="card">
          <header className="card__header">
            <h2>{card.title}</h2>
            <span className="card__source">{card.source}</span>
          </header>
          <div className="card__body">
            <Markdown>{card.body}</Markdown>
          </div>
        </article>
      ))}
    </section>
  );
}
