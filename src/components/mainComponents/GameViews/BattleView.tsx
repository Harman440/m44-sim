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
import { Faction } from "../../../types/faction";
import { summarizeOrders } from "../../../game-core/turnSummary";
import TurnSummary from "../../TurnSummary";
import FireDialog from "../../FireDialog";
import BattleMap from "./BattleMap";
import GameIcon from "../../GameIcon";
import { useSound } from "../../../sound";

interface BattleViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onEndBattle: () => void;
}

/**
 * Battle phase. The battle is played on the physical board, so by default the
 * map is hidden and the whole screen shows the turn summary, where each unit
 * fires. The map is one tap away for syncing casualties and retreats.
 */
function BattleView({ faction, session, game, onEndBattle }: BattleViewProps) {
  const [showMap, setShowMap] = useState(false);
  const [firingIndex, setFiringIndex] = useState<number | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const summaries = summarizeOrders(game.orders, session.board, game.shots, game.firesPerUnit);
  const firing = firingIndex === null ? null : (summaries[firingIndex] ?? null);
  const unfired = summaries.filter((s) => s.shotsLeft > 0).length;
  const play = useSound();

  /** After a shot: the dice sound, or the stamp for a shot with no dice */
  const withSound = (fired: boolean) => {
    if (fired) play((session.getSnapshot().shots.at(-1)?.dice ?? 0) > 0 ? "dice" : "stamp");
    return fired;
  };

  const requestEndBattle = () => setConfirmingEnd(true);

  return (
    <>
      {showMap && (
        <BattleMap
          faction={faction}
          session={session}
          game={game}
          onShowSummary={() => setShowMap(false)}
          onEndBattle={requestEndBattle}
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
              <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
                Ver mapa
              </Button>
              <Button onClick={requestEndBattle} startIcon={<GameIcon name="endTurn" />}>
                Terminar batalla
              </Button>
            </Stack>
          </Box>

          <TurnSummary
            card={game.chosenCard}
            summaries={summaries}
            faction={faction}
            onFire={(summary) => setFiringIndex(summary.index)}
          />
        </Stack>
      )}

      {/* Keyed by unit so every unit starts a fresh questionnaire */}
      <FireDialog
        key={firingIndex ?? "closed"}
        summary={firing}
        card={game.chosenCard}
        faction={faction}
        onFire={(answers) => withSound(firingIndex !== null && session.fire(firingIndex, answers))}
        onQuickFire={(dice) => withSound(firingIndex !== null && session.fireQuick(firingIndex, dice))}
        onUndoShot={() => firingIndex !== null && session.undoShot(firingIndex)}
        onClose={() => setFiringIndex(null)}
      />

      <Dialog open={confirmingEnd} onClose={() => setConfirmingEnd(false)}>
        <DialogTitle>¿Terminar la batalla?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unfired > 0
              ? `${unfired === 1 ? "Queda 1 unidad" : `Quedan ${unfired} unidades`} sin disparar. Si terminas, pierden el disparo.`
              : "Pasarás a la fase final. No se puede deshacer."}
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
              onEndBattle();
            }}
          >
            {unfired > 0 ? "Terminar igualmente" : "Terminar batalla"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default BattleView;
