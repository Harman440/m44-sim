import { useCallback, useState, useSyncExternalStore } from "react";
import { Box, Typography } from "@mui/material";
import { Scenario } from "../../types/scenario";
import commandCards from "../../data/commandCards";
import { TurnPhase } from "../../types/gameManager";
import CommandCard from "../../game-core/commandCard";
import GameSession from "../../game-core/gameSession";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";
import BattleView from "./GameViews/BattleView";

interface GameViewProps {
  boardSide: string;
  scenario: Scenario;
}

function GameView({ boardSide, scenario }: GameViewProps) {
  // All game rules live in the session; React re-renders when it publishes a new snapshot
  const [session] = useState(
    () =>
      new GameSession({
        scenario,
        faction: boardSide,
        initialHandSize: scenario.initialHandSize[boardSide === "Axis" ? "axis" : "allies"],
        commandCards,
      })
  );
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);

  // Cards already animated into the hand. Kept here (UI state, not game state)
  // so it survives CardsView unmounting during the other phases.
  const [dealtCardIds, setDealtCardIds] = useState<ReadonlySet<string>>(() => new Set());

  const handleCardDealt = useCallback((card: CommandCard) => {
    setDealtCardIds((prev) => new Set(prev).add(card.id));
  }, []);

  const handleFinishTurn = () => {
    const playedCard = game.chosenCard;
    if (!playedCard || !session.endTurn()) return;

    // A discarded card can be drawn again later and should animate in again
    setDealtCardIds((prev) => {
      const next = new Set(prev);
      next.delete(playedCard.id);
      return next;
    });
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 1400 }}>
      {game.phase === TurnPhase.PICK_CARDS && (
        <CardsView
          handCards={game.hand}
          choiceCards={game.choiceCards}
          drawPileCount={game.drawPileCount}
          discardPileCount={game.discardPileCount}
          dealtCardIds={dealtCardIds}
          onCardDealt={handleCardDealt}
          onDrawChoice={() => session.drawChoice()}
          onChooseCard={(card) => session.chooseCard(card)}
          onCardClick={(card) => session.pickCard(card)}
        />
      )}

      {game.phase === TurnPhase.ORDER_UNITS && (
        <OrdersView boardSide={boardSide} session={session} game={game} />
      )}

      {game.phase === TurnPhase.BATTLE && (
        <BattleView
          boardSide={boardSide}
          session={session}
          game={game}
          onFinishTurn={handleFinishTurn}
        />
      )}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 2, textAlign: "center" }}
      >
        Turno: {game.turn} | Fase: {TurnPhase[game.phase]}
      </Typography>
    </Box>
  );
}

export default GameView;
