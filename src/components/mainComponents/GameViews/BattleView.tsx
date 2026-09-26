import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import { summarizeOrders } from "../../../game-core/turnSummary";
import TurnSummary from "../../TurnSummary";
import FireDialog from "../../FireDialog";
import BattleMap from "./BattleMap";

interface BattleViewProps {
  boardSide: string;
  session: GameSession;
  game: GameSnapshot;
  onFinishTurn: () => void;
}

/**
 * Battle phase. The battle is played on the physical board, so by default the
 * map is hidden and the whole screen shows the turn summary, where each unit
 * fires. The map is one tap away for syncing casualties and retreats.
 */
function BattleView({ boardSide, session, game, onFinishTurn }: BattleViewProps) {
  const [showMap, setShowMap] = useState(false);
  const [firingIndex, setFiringIndex] = useState<number | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const summaries = summarizeOrders(game.orders, session.board, game.shots, game.firesPerUnit);
  const firing = firingIndex === null ? null : (summaries[firingIndex] ?? null);
  const unfired = summaries.filter((s) => s.shotsLeft > 0).length;

  const requestFinishTurn = () => setConfirmingEnd(true);

  return (
    <>
      {showMap && (
        <BattleMap
          boardSide={boardSide}
          session={session}
          game={game}
          onShowSummary={() => setShowMap(false)}
          onFinishTurn={requestFinishTurn}
        />
      )}

      {!showMap && (
        <Stack spacing={2} sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="h5" component="h2">
                Batalla
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dispara con cada unidad y resuelve la batalla en el tablero físico. Si hay bajas o
                retiradas, actualízalas en el mapa.
              </Typography>
            </Box>
            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
              <Button variant="outlined" onClick={() => setShowMap(true)}>
                Ver mapa
              </Button>
              <Button onClick={requestFinishTurn}>Terminar Turno</Button>
            </Stack>
          </Box>

          <TurnSummary
            card={game.chosenCard}
            summaries={summaries}
            onFire={(summary) => setFiringIndex(summary.index)}
          />
        </Stack>
      )}

      {/* Keyed by unit so every unit starts a fresh questionnaire */}
      <FireDialog
        key={firingIndex ?? "closed"}
        summary={firing}
        card={game.chosenCard}
        faction={boardSide}
        onFire={(answers) => firingIndex !== null && session.fire(firingIndex, answers)}
        onQuickFire={(dice) => firingIndex !== null && session.fireQuick(firingIndex, dice)}
        onUndoShot={() => firingIndex !== null && session.undoShot(firingIndex)}
        onClose={() => setFiringIndex(null)}
      />

      <Dialog open={confirmingEnd} onClose={() => setConfirmingEnd(false)}>
        <DialogTitle>¿Terminar el turno?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unfired > 0
              ? `${unfired === 1 ? "Queda 1 unidad" : `Quedan ${unfired} unidades`} sin disparar. Si terminas, pierden el disparo.`
              : "No se puede deshacer."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmingEnd(false)}>
            Seguir en batalla
          </Button>
          <Button
            color={unfired > 0 ? "warning" : "primary"}
            onClick={() => {
              setConfirmingEnd(false);
              onFinishTurn();
            }}
          >
            {unfired > 0 ? "Terminar igualmente" : "Terminar Turno"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default BattleView;
