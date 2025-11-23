import { useState } from "react";
import CommandCard from "../../../game-core/commandCard";
import Hand from "../../../game-core/hand";
import CommandCardComponent from "../../CommandCardComponent";
import "./CardsView.css";
import Deck from "../../../game-core/deck";

type CardSource = 'deck' | 'hand' | 'discard' | 'choice';

interface CardsViewProps {
  commandCardsDeck: Deck;
  commandCardsPlayer: Hand;
  onCardClick: (card: CommandCard) => void;
}

function CardsView({ commandCardsDeck, commandCardsPlayer, onCardClick }: CardsViewProps) {
  const [message, setMessage] = useState('Selecciona una carta para jugarla');
  const [animatingCard, setAnimatingCard] = useState<(CommandCard & { from: CardSource }) | null>(null);
  const [choiceCards, setChoiceCards] = useState<CommandCard[]>([]);

  //TODO: add this animation when finishing turn and drawing card
  const drawCard = () => {
    const [drawnCard] = commandCardsDeck.draw(); //TODO: Check if calling this functions updates react component

    if (!drawnCard) {
      setMessage('Mazo esta vacio!');//TODO: barajar
      return;
    }
    setAnimatingCard({ ...drawnCard, from: 'deck' });

    setTimeout(() => {
      commandCardsPlayer.add(drawnCard);
      setAnimatingCard(null);
      setMessage('Nueva Carta, Selecciona una carta para jugarla');
    }, 500);
  };

  const drawChoice = () => {
    const drawnCards = commandCardsDeck.draw();
    if (drawnCards.length < 2) {
      setMessage('No hay suficientes cartas en el mazo!');//TODO: barajar
      return;
    }

    setChoiceCards(drawnCards);
    setMessage('Eleige una Carta para añadirla a tu mano');
  };

  const chooseCard = (card: CommandCard) => {
    setAnimatingCard({ ...card, from: 'choice' });

    const otherCard = choiceCards.find(c => c.id !== card.id);

    commandCardsDeck.discard(otherCard!);
    setChoiceCards([]);

    setTimeout(() => {
      commandCardsPlayer.add(card);
      setAnimatingCard(null);
      setMessage('Carta Elegida, Selecciona una carta para jugarla');
    }, 500);
  };

  return (
    <div className="cards-view">
      {/* Header */}
      <div className="cards-header">
        <h3>Zona de Mando</h3>
        <p>{message}</p>
      </div>

      {/* Choice Cards Area */}
      {choiceCards.length > 0 && (
        <div className="choice-area">
          <p className="choice-title">Elige una Carta:</p>
          <div className="choice-cards">
            {choiceCards.map(card => (
              <div className="choice-card">
                <CommandCardComponent
                  key={card.id}
                  cardData={card}
                  onClick={() => chooseCard(card)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Area - Deck and Discard */}
      <div className="top-area">
        <div className="deck-section">
          <p className="pile-label">Cartas ({commandCardsDeck.drawPile.length})</p>
          <div className="deck-pile">
            <div className="deck-back">?</div>
          </div>
          <button onClick={drawChoice} className="choice-button">
            Coge 2 Cartas
          </button>
        </div>

        <div className="deck-section">
          <p className="pile-label">Descarte ({commandCardsDeck.discardPile.length})</p>
          <div className="discard-pile">
            {commandCardsDeck.discardPile.length > 0 && (
              <div className="deck-back">?</div>
            )}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="cards-grid"> {/* TODO: assuming there are always cards available*/}
        <div className="grid">
          {commandCardsPlayer.cards.map((card) => (
            <CommandCardComponent
              key={card.id}
              cardData={card}
              onClick={onCardClick}
            />
          ))}
        </div>
      </div>

      {/* Animating Card Overlay */}
      {animatingCard && (
        <div
          className={`animating-card ${animatingCard.from}`}
        >
          <CommandCardComponent
            key={999}
            cardData={animatingCard}
            onClick={() => { }}
          />
        </div>
      )}
    </div>
  );
}

export default CardsView;