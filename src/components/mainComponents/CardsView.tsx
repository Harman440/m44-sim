//TODO: here cards in hand and deck will be rendered
//TODO: React, rendering shoudnt depend on game state and turn state. I think
//TODO: this should be shown if gameState is in playing and turnPhase is PICK_CARDS

import CommandCard from "../../game-core/commandCard";
import Hand from "../../game-core/hand";
import CommandCardComponent from "../CommandCardComponent";

interface CardsViewProps {
    commandCardsPlayer: Hand;
    onCardClick: (card: CommandCard) => void;
}

function CardsView({
    commandCardsPlayer,
    onCardClick
}: CardsViewProps) {

    return (
        <div className="mb-4">
          <h3 className="font-bold mb-2">Choose a Card</h3>
          <div className="grid grid-cols-1 gap-2">
            {commandCardsPlayer.cards.map(card => (
                <CommandCardComponent
                    key={card.id} 
                    cardData={card}
                    onClick={onCardClick}
                />
            ))}
            {/*TODO: what is the key of the component and how to use it?*/}
          </div>
        </div>
    );
}

export default CardsView;