import { useCallback, useState, useSyncExternalStore } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { TurnPhase } from "../../types/gameManager";
import CommandCard from "../../game-core/commandCard";
import GameSession from "../../game-core/gameSession";
import CardsView from "./GameViews/CardsView";
import OrdersView from "./GameViews/OrdersView";
import BattleView from "./GameViews/BattleView";

interface GameViewProps {
  /** Owns all game rules; React re-renders when it publishes a new snapshot */
  session: GameSession;
  /** The game was restored from a save (e.g. after a reload) */
  resumed?: boolean;
  /** Leave the game and go back to the menu */
  onExit: () => void;
}

const PHASE_STEPS: { phase: TurnPhase; label: string }[] = [
  { phase: TurnPhase.PICK_CARDS, label: "Carta" },
  { phase: TurnPhase.ORDER_UNITS, label: "Órdenes" },
  { phase: TurnPhase.BATTLE, label: "Batalla" },
];

function GameView({ session, resumed = false, onExit }: GameViewProps) {
  const { scenario, faction: boardSide } = session;
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [showResumed, setShowResumed] = useState(resumed);
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);

  // Cards already animated into the hand. Kept here (UI state, not game state)
  // so it survives CardsView unmounting during the other phases.
  // A resumed game's hand was already dealt before the reload.
  const [dealtCardIds, setDealtCardIds] = useState<ReadonlySet<string>>(
    () => new Set(resumed ? session.getSnapshot().hand.map((card) => card.id) : [])
  );

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
      <Box
        component="header"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.5,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1 }}>
            {scenario.name} · {boardSide === "Axis" ? "Eje" : "Aliados"}
          </Typography>
          <Chip label={`Turno ${game.turn}`} size="small" />
          {PHASE_STEPS.map(({ phase, label }, i) => (
            <Chip
              key={phase}
              label={`${i + 1}. ${label}`}
              size="small"
              color={phase === game.phase ? "primary" : "default"}
              variant={phase === game.phase ? "filled" : "outlined"}
              aria-current={phase === game.phase ? "step" : undefined}
            />
          ))}
        </Stack>
        <Button variant="text" onClick={() => setConfirmingExit(true)}>
          Menú
        </Button>
      </Box>

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

      <Snackbar
        open={showResumed}
        autoHideDuration={3000}
        onClose={() => setShowResumed(false)}
        message={`Partida recuperada · Turno ${game.turn}`}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      <Dialog open={confirmingExit} onClose={() => setConfirmingExit(false)}>
        <DialogTitle>¿Salir al menú?</DialogTitle>
        <DialogContent>
          <DialogContentText>Se perderá la partida en curso.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmingExit(false)}>
            Seguir jugando
          </Button>
          <Button color="error" onClick={onExit}>
            Salir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GameView;
