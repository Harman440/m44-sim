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
import CloseAssaultMap from "./CloseAssaultMap";
import GameIcon from "../../GameIcon";
import CombatCardComponent from "../../CombatCardComponent";
import { coinsText } from "../../../labels";
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
  const [markingCloseAssault, setMarkingCloseAssault] = useState(false);
  const closeAssaultCard = game.activeCard?.closeAssaultOnly ?? false;
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
  const battleCards = game.combatHand.filter((card) => card.phase === "battle");

  /** After a shot: the dice sound, or the stamp for a shot with no dice */
  const withSound = (fired: boolean) => {
    if (fired) play((session.getSnapshot().shots.at(-1)?.dice ?? 0) > 0 ? "dice" : "stamp");
    return fired;
  };

  const requestEndBattle = () => setConfirmingEnd(true);

  return (
    <>
      {markingCloseAssault && (
        <CloseAssaultMap
          faction={faction}
          session={session}
          game={game}
          onDone={() => setMarkingCloseAssault(false)}
        />
      )}

      {showMap && !markingCloseAssault && (
        <BattleMap
          faction={faction}
          session={session}
          game={game}
          onShowSummary={() => setShowMap(false)}
          onEndBattle={requestEndBattle}
        />
      )}

      {!showMap && !markingCloseAssault && (
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

          {closeAssaultCard && (
            <Alert
              severity="warning"
              icon={<GameIcon name="battle" />}
              action={
                <Button color="warning" onClick={() => setMarkingCloseAssault(true)}>
                  Marcar unidades
                </Button>
              }
              sx={{ alignItems: "center", flexWrap: "wrap", "& .MuiAlert-action": { pl: 0, ml: "auto" } }}
            >
              Asalto cercano: marca en el mapa cada unidad tuya adyacente a una unidad enemiga.
            </Alert>
          )}

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
            card={game.activeCard}
            summaries={summaries}
            faction={faction}
            onFire={(summary) => setFiringIndex(summary.index)}
            withCoins={!game.extraTurn}
            onSkipUnmoved={() => setConfirmingSkip(true)}
          />

          {game.canPlayCombatCards && (
            <Box component="section" aria-labelledby="battle-combat-title" data-testid="battle-combat-cards">
              <Typography variant="h6" component="h3" id="battle-combat-title">
                Cartas de combate
              </Typography>
              {game.orderCombatCard && (
                <Typography variant="body2" color="text.secondary">
                  Con las órdenes: {game.orderCombatCard.name}. {game.orderCombatCard.description}
                </Typography>
              )}
              {game.battleCombatCard ? (
                <Alert
                  severity="success"
                  icon={<GameIcon name="cards" />}
                  sx={{ mt: 1 }}
                  action={
                    <Button color="inherit" onClick={() => session.undoBattleCombatCard()}>
                      Deshacer
                    </Button>
                  }
                >
                  <strong>Has jugado {game.battleCombatCard.name}</strong> (pagada:{" "}
                  {coinsText(game.battleCombatCard.cost)}). {game.battleCombatCard.description} Solo se juega una por batalla.
                </Alert>
              ) : battleCards.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No tienes cartas de combate para la batalla.
                </Typography>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Puedes jugar una en cualquier momento de la batalla, normalmente cuando dispara el rival. Se paga al
                    jugarla y se resuelve en la mesa.
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    {battleCards.map((card) => (
                      <CombatCardComponent key={card.id} card={card} disabled={card.cost > game.coins}>
                        <Button
                          onClick={() => session.playBattleCombatCard(card) && play("cardPlay")}
                          disabled={card.cost > game.coins}
                          aria-label={`Jugar ${card.name}`}
                        >
                          Jugar
                        </Button>
                        {card.cost > game.coins && (
                          <Typography variant="caption" sx={{ alignSelf: "center" }}>
                            No tienes monedas suficientes
                          </Typography>
                        )}
                      </CombatCardComponent>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </Stack>
      )}

      {/* Keyed by unit so every unit starts a fresh questionnaire */}
      <FireDialog
        key={firingIndex ?? "closed"}
        summary={firing}
        // An extra order bought with coins gets none of the card's bonuses
        card={firing?.extra ? null : game.activeCard}
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
        card={game.activeCard}
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
