import CommandCard from "../../../game-core/commandCard";
import Hand from "../../../game-core/hand";
import CommandCardComponent from "../../CommandCardComponent";

interface CardsViewProps {
  commandCardsPlayer: Hand;
  onCardClick: (card: CommandCard) => void;
}

function CardsView({ commandCardsPlayer, onCardClick }: CardsViewProps) {
  return (
    <div className="cards-view">
      {/* Header */}
      <div className="cards-header mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">
          Choose a Command Card
        </h3>
        <p className="text-gray-300 text-sm">
          Select a card to execute your strategy ({commandCardsPlayer.cards.length} cards available)
        </p>
      </div>

      {/* Cards Grid */}
      <div className="cards-grid">
        {commandCardsPlayer.cards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {commandCardsPlayer.cards.map((card) => (
              <CommandCardComponent
                key={card.id}
                cardData={card}
                onClick={onCardClick}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-50">🎴</div>
              <h4 className="text-xl font-semibold text-gray-300 mb-2">
                No Cards Available
              </h4>
              <p className="text-gray-500">
                You don't have any command cards in your hand.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Optional: Card count indicator */}
      <div className="cards-footer mt-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
          <span className="text-sm text-gray-300">Cards in hand:</span>
          <span className="font-bold text-white">{commandCardsPlayer.cards.length}</span>
        </div>
      </div>
    </div>
  );
}

export default CardsView;