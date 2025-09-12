import { useCallback, useState } from "react";
import { Scenario } from "../../types/scenario";
import GameState from "../../game-core/gameState";
import Deck from "../../game-core/deck";
import commandCards from "../../data/commandCards";
import { GamePhase, TurnPhase } from "../../types/gameManager";
import CommandCard from "../../game-core/commandCard";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";

interface GameViewProps {
    boardSide: string,
    scenario: Scenario,
}

function GameView({
    boardSide,
    scenario
}: GameViewProps) {
    const [gameState, setGameState] = useState<GameState>(() => new GameState({
        faction: "axis", //TODO: this has to be used to add new rules depending on the faction. check if not used anywhere else
        initNumCommandCards: 3,
        commandCardsDeck: new Deck(commandCards),
        phase: GamePhase.PLAYING //TODO: start in setup/main menu
    }));//TODO: change initial state in main menu

    const [turnPhase, setTurnPhase] = useState<TurnPhase>(() => TurnPhase.PICK_CARDS);//TODO this will be set to pickCards initially when the game is set up.
    const [chosenCommandCard, setChosenCommandCard] = useState<CommandCard | null>(null);

    //handle click on card
    //TODO: move to CardView
    const handleCardClick = useCallback((card: CommandCard) => {
        console.log(`Card clicked: ${card.name}`);
        setChosenCommandCard(card);
        setTurnPhase(TurnPhase.ORDER_UNITS);
        
        // setTurnState(prevTurnState => {
        // // Clone the previous state
        // const newTurnState = prevTurnState.clone(); 
        // /*NOTE: If you're using a class-based state management pattern, 
        // make sure your state updates return new instances rather than mutating existing ones. 
        // This is a fundamental React principle - state should be treated as immutable.*/
        // newTurnState.setCommandCard(card);
        // newTurnState.printTurnInfo();
        // return newTurnState;
        // });
    }, []); // No dependencies needed with the functional update

    //Handle Finish Turn
    //TODO: Move to FinishTurn Phase,
    //TODO: Finish phase needs to know and render actual state of board
    //TODO: improve this. update turn phase by phase and then show on app. lastly update game state with turn data
    const handleFinsihTurn = useCallback(() => {
        setTurnPhase(TurnPhase.PICK_CARDS);
        setChosenCommandCard(null);
        //TODO set orders commited to false
        // setTurnState(prevTurnState => {
        // // Clone the previous state
        // const newTurnState = prevTurnState.clone();
        // /*NOTE: If you're using a class-based state management pattern, 
        // make sure your state updates return new instances rather than mutating existing ones. 
        // This is a fundamental React principle - state should be treated as immutable.*/
        // newTurnState.startNewTurn();
        // return newTurnState;
        // });
        // Apply all turn changes to game state atomically
        setGameState(prevGameState => {
        const newGameState = prevGameState;

        newGameState.currentTurn++;
        newGameState.commandCardsPlayer.remove(chosenCommandCard!); //TODO: remove correctly
        //TODO: set discard pile correctly if needed
        newGameState.commandCardsPlayer.add(newGameState.commandCardsDeck.draw(1)[0] ?? null);

        //TODO: units can be ordered again

        return newGameState;
        })
    }, []);

    //TODO: React, rendering shoudnt depend on game state and turn state. I think
    return (
        <div>

            {turnPhase === TurnPhase.PICK_CARDS && (
                <CardsView
                    commandCardsPlayer={gameState.commandCardsPlayer}
                    onCardClick={handleCardClick}
                />
            )}

            {turnPhase === TurnPhase.ORDER_UNITS && (
                <OrdersView
                    boardSide={boardSide}
                    scenario={scenario}
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
                Turn: {gameState.currentTurn} |
                Phase: {turnPhase}
            </div>
        </div>
    )
}

export default GameView;