/*NOTE: If you're using a class-based state management pattern, 
make sure your state updates return new instances rather than mutating existing ones. 
This is a fundamental React principle - state should be treated as immutable.
I am not using class-based state for now. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import { Scenario } from "../../types/scenario";
import Deck from "../../game-core/deck";
import commandCards from "../../data/commandCards";
import { TurnPhase } from "../../types/gameManager";
import CommandCard from "../../game-core/commandCard";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";
import BoardManager from "../../game-core/BoardManager";
import Hand from "../../game-core/hand";
import Order from "../../game-core/order";

interface GameViewProps {
  boardSide: string;
  scenario: Scenario;
  initCommandCards: number;
}

function GameView({ boardSide, scenario, initCommandCards }: GameViewProps) {
  const [boardManager] = useState<BoardManager>(
    () => new BoardManager(scenario, boardSide)
  );

  const [commandCardsDeck] = useState(() => new Deck(commandCards));
  const [commandCardsPlayer, setCommandCardsPlayer] = useState<Hand>(() => new Hand([]));
  // Cards already animated into the hand. Kept here so it survives CardsView
  // unmounting during the other phases.
  const [dealtCardIds, setDealtCardIds] = useState<ReadonlySet<string>>(() => new Set());

  const hasDrawnInitialHand = useRef(false); //NOTE: added so that the draw card function is not called twice

  useEffect(() => {
    if (!hasDrawnInitialHand.current) {
      const hand = commandCardsDeck.draw(initCommandCards);
      setCommandCardsPlayer(new Hand(hand));
      hasDrawnInitialHand.current = true;
    }
  }, []);

  const handleCardDealt = useCallback((card: CommandCard) => {
    setDealtCardIds((prev) => new Set(prev).add(card.id));
  }, []);

  const handleAddCardToHand = useCallback((card: CommandCard) => {
    setCommandCardsPlayer((prev) => new Hand([...prev.cards, card]));
  }, []);

  const [turnPhase, setTurnPhase] = useState<TurnPhase>(
    () => TurnPhase.PICK_CARDS
  );
  const [chosenCommandCard, setChosenCommandCard] =
    useState<CommandCard | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(() => 1);

  const [orders, setOrders] = useState<Order[]>([]);

  //handle click on card
  const handleCardClick = useCallback((card: CommandCard) => {
    setChosenCommandCard(card);
    setTurnPhase(TurnPhase.ORDER_UNITS);
  }, []); // No dependencies needed with the functional update

  //Handle Finish Turn
  const handleFinishTurn = useCallback(() => {
    setTurnPhase(TurnPhase.PICK_CARDS);

    if (!chosenCommandCard) {
      console.warn("No card chosen when finishing turn");
      return;
    }

    // Discard first so a reshuffle on an empty deck can bring the card back
    commandCardsDeck.discard(chosenCommandCard);
    const drawnCards = commandCardsDeck.draw(1);
    setCommandCardsPlayer((prev) => {
      const next = new Hand(prev.cards);
      next.remove(chosenCommandCard);
      next.addMultiple(drawnCards);
      return next;
    });
    // A discarded card can be drawn again later and should animate in again
    setDealtCardIds((prev) => {
      const next = new Set(prev);
      next.delete(chosenCommandCard.id);
      return next;
    });
    setChosenCommandCard(null);

    boardManager.removeOrders();

    setOrders([]);

    setCurrentTurn((prevTurn) => prevTurn + 1);
  }, [chosenCommandCard, commandCardsDeck, boardManager]);

  return (
    <div>
      {turnPhase === TurnPhase.PICK_CARDS && (
        <CardsView
          commandCardsDeck={commandCardsDeck}
          handCards={commandCardsPlayer.cards}
          dealtCardIds={dealtCardIds}
          onCardDealt={handleCardDealt}
          onAddCardToHand={handleAddCardToHand}
          onCardClick={handleCardClick}
        />
      )}

      {turnPhase === TurnPhase.ORDER_UNITS && (
        <OrdersView
          boardSide={boardSide}
          boardManager={boardManager}
          chosenCommandCard={chosenCommandCard!}
          setTurnPhase={setTurnPhase}
          setOrders={setOrders}
          orders={orders}
        />
      )}

      {turnPhase === TurnPhase.BATTLE && (
        <Stack spacing={1} sx={{ alignItems: "center", my: 2 }}>
          <Typography variant="h6">Fase Batalla</Typography>
          <Button onClick={() => handleFinishTurn()}>Terminar Turno</Button>
          {/*TODO: Add delete units from board*/}
        </Stack>
      )}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2, textAlign: "center" }}
      >
        Turno: {currentTurn} | Fase: {TurnPhase[turnPhase]}
      </Typography>
    </div>
  );
}

export default GameView;
