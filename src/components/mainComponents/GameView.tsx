/*NOTE: If you're using a class-based state management pattern, 
make sure your state updates return new instances rather than mutating existing ones. 
This is a fundamental React principle - state should be treated as immutable.
I am not using class-based state for now. */

import { useCallback, useState } from "react";
import { Scenario } from "../../types/scenario";
import Deck from "../../game-core/deck";
import commandCards from "../../data/commandCards";
import { TurnPhase } from "../../types/gameManager";
import CommandCard from "../../game-core/commandCard";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";
import BoardManager from "../../game-core/BoardManager";
import Hand from "../../game-core/hand";

interface GameViewProps {
    boardSide: string,
    scenario: Scenario,
    initCommandCards: number,
}

function GameView({
    boardSide,
    scenario,
    initCommandCards
}: GameViewProps) {
    const [boardManager] = useState<BoardManager>(() => new BoardManager(scenario, boardSide));//TODO: selected in main menu

    const [commandCardsDeck, setCommandCardsDeck] = useState<Deck>(() => new Deck(commandCards));
    const [commandCardsPlayer, setCommandCardsPlayer] = useState<Hand>(() => new Hand(commandCardsDeck.draw(initCommandCards)));

    const [turnPhase, setTurnPhase] = useState<TurnPhase>(() => TurnPhase.PICK_CARDS);//TODO this will be set to pickCards initially when the game is set up.
    const [chosenCommandCard, setChosenCommandCard] = useState<CommandCard | null>(null);
    const [currentTurn, setCurrentTurn] = useState<number>(() => 1);

    //handle click on card
    const handleCardClick = useCallback((card: CommandCard) => {
        console.log(`Card clicked: ${card.name}`);
        setChosenCommandCard(card);
        setTurnPhase(TurnPhase.ORDER_UNITS);
    }, []); // No dependencies needed with the functional update

    //Handle Finish Turn
    //TODO: Finish phase needs to know and render actual state of board
    //TODO: improve this. update turn phase by phase and then show on app. lastly update game state with turn data
    const handleFinsihTurn = useCallback(() => {
        setTurnPhase(TurnPhase.PICK_CARDS);
        setChosenCommandCard(null);
        commandCardsPlayer.remove(chosenCommandCard!); //BUG: remove correctly
        commandCardsPlayer.add(commandCardsDeck.draw(1)[0] ?? null);//TODO: set discard pile correctly if needed
        console.log(`Cards Left in deck: ${commandCardsDeck.drawPile.length}`);

        //BUG: units shoudnt be able to be ordered again

        setCurrentTurn(prevTurn => prevTurn + 1);
    }, []);

    return (
        <div>

            {turnPhase === TurnPhase.PICK_CARDS && (
                <CardsView
                    commandCardsPlayer={commandCardsPlayer}
                    onCardClick={handleCardClick}
                />
            )}

            {turnPhase === TurnPhase.ORDER_UNITS && (
                <OrdersView
                    boardSide={boardSide}
                    boardManager={boardManager}
                    chosenCommandCard={chosenCommandCard!}
                    setTurnPhase={setTurnPhase}
                />
            )}

            {turnPhase === TurnPhase.BATTLE && (
                <div className="mb-4">
                <h3 className="font-bold mb-2">Fase Batalla</h3>
                    <button
                    onClick={() => handleFinsihTurn()}
                    className={`text-white p-2 rounded text-sm hover:opacity-80`}
                    >
                    Terminar Turno
                    </button>
                    {/*TODO: Add delete units from board*/}
                </div>
            )}

            <div className="game__instructions">
                {turnPhase === TurnPhase.PICK_CARDS && 
                <div className="text-red-600">
                    Pick a card first
                </div>
                }
                {turnPhase === TurnPhase.ORDER_UNITS && 
                <div className="text-blue-600">
                    Order your units: {3} | 
                    Click on any hexagon to select it | 
                </div>
                }
                {/*TODO: Move this to OrdersView*/}
            </div>

            <div className='game_info'>
                Turn: {currentTurn} |
                Phase: {turnPhase}
            </div>
        </div>
    )
}

export default GameView;