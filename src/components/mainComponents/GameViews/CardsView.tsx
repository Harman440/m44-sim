import CommandCard from "../../../game-core/commandCard";
import Hand from "../../../game-core/hand";
import CommandCardComponent from "../../CommandCardComponent";
import "./CardsView.css";

interface CardsViewProps {
  commandCardsPlayer: Hand;
  onCardClick: (card: CommandCard) => void;
}

function CardsView({ commandCardsPlayer, onCardClick }: CardsViewProps) {
  return (
    <div>
      {/* Header */}
      <div className="cards-header">
        <h3>Zona de Mando</h3>
        <p>Elige una Carta de Mando</p>
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
    </div>
  );
}

export default CardsView;