import { useState } from "react";
import {
  Alert,
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
import CollisionDialog from "../../CollisionDialog";
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
  const [collisionOpen, setCollisionOpen] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const summaries = summarizeOrders(
    game.orders,
    session.board,
    game.shots,
    game.unmovedFireSkipped
  );
  const firing = firingIndex === null ? null : (summaries[firingIndex] ?? null);
  const unfired = summaries.filter((s) => s.shotsLeft > 0).length;
  const unmovedUnfired = summaries.filter((s) => s.hold && s.shotsLeft > 0).length;
  // Only units that moved (and are still on the board) can have collided with an enemy unit
  const anyMoved = summaries.some((s) => !s.hold && !s.removed);
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
                Dispara con cada unidad y resuelve la batalla en el tablero físico. Marca las retiradas
                en la mesa: se hacen en la fase final, y hasta entonces la unidad marcada puede
                disparar pero no tomar terreno.
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

          {anyMoved && (
            <Alert
              severity="warning"
              icon={<GameIcon name="battle" />}
              action={
                <Button color="warning" onClick={() => setCollisionOpen(true)}>
                  ¿Ha habido un choque?
                </Button>
              }
              sx={{ alignItems: "center", flexWrap: "wrap", "& .MuiAlert-action": { pl: 0, ml: "auto" } }}
            >
              Resuelve los choques antes que cualquier otro disparo.
            </Alert>
          )}

          <Alert severity="info" icon={<GameIcon name="fire" />} data-testid="fire-order">
            {session.attacking
              ? "Eres el bando atacante: disparas primero."
              : "Dispara primero el rival: es el bando atacante."}{" "}
            Después alternáis, una unidad cada uno. Primero disparan todas las unidades que no se han
            movido (de los dos bandos) y luego las que se movieron.
          </Alert>

          <TurnSummary
            card={game.chosenCard}
            summaries={summaries}
            faction={faction}
            onFire={(summary) => setFiringIndex(summary.index)}
            withCoins={!game.extraTurn}
            onSkipUnmoved={() => setConfirmingSkip(true)}
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
        onQuickFire={(dice, target) =>
          withSound(firingIndex !== null && session.fireQuick(firingIndex, dice, target))
        }
        withCoins={!game.extraTurn}
        onUndoShot={() => firingIndex !== null && session.undoShot(firingIndex)}
        onClose={() => setFiringIndex(null)}
      />

      <CollisionDialog
        open={collisionOpen}
        summaries={summaries}
        card={game.chosenCard}
        faction={faction}
        onRoll={(orderIndex, targetType) => withSound(session.fireCollision(orderIndex, targetType))}
        withCoins={!game.extraTurn}
        onClose={() => setCollisionOpen(false)}
      />

      <Dialog open={confirmingSkip} onClose={() => setConfirmingSkip(false)}>
        <DialogTitle>¿Pasar a las unidades movidas?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unmovedUnfired === 1
              ? "La unidad sin mover que no ha disparado pierde el disparo."
              : `Las ${unmovedUnfired} unidades sin mover que no han disparado pierden el disparo.`}{" "}
            No se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmingSkip(false)}>
            Seguir con las sin mover
          </Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirmingSkip(false);
              session.skipUnmovedFire();
            }}
          >
            Pasar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmingEnd} onClose={() => setConfirmingEnd(false)}>
        <DialogTitle>¿Terminar la batalla?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unfired > 0
              ? `${unfired === 1 ? "Queda 1 unidad" : `Quedan ${unfired} unidades`} sin disparar. Si terminas, pierden el disparo.`
              : "Pasarás a la fase final, donde reflejarás en el mapa las bajas y retiradas. No se puede deshacer."}
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
