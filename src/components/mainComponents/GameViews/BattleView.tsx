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
import "./BattleView.css";
import FireDialog from "../../FireDialog";
import CollisionDialog from "../../CollisionDialog";
import BattleMap from "./BattleMap";
import CloseAssaultMap from "./CloseAssaultMap";
import GameIcon from "../../GameIcon";
import CombatCardComponent from "../../CombatCardComponent";
import { coinsText, describePlace, UNIT_LABELS } from "../../../labels";
import CardAttackDialog from "../../CardAttackDialog";
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
  const [attackingHex, setAttackingHex] = useState<number | null>(null);
  const attackCard = game.orderCombatCard?.effect?.kind === "attack" ? game.orderCombatCard : null;
  const attackOn = (marker: number) => game.cardAttacks.find((attack) => attack.marker === marker) ?? null;
  const bonusUsed = game.shots.some((shot) => shot.combatBonus);

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
        // Landscape: the turn summary on the left, what goes with it (who fires first,
        // an attack card, combat cards) in a column on the right. Portrait: one column.
        <Box className="battle-view">
          <Box className="battle-view__main">
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

            <Box className="battle-view__summary">
              <TurnSummary
                card={game.activeCard}
                summaries={summaries}
                faction={faction}
                // Units wait for the attack combat card's rolls
                onFire={game.attacksPending ? undefined : (summary) => setFiringIndex(summary.index)}
                withCoins={!game.extraTurn}
                onSkipUnmoved={() => setConfirmingSkip(true)}
              />
            </Box>
          </Box>

          <Box className="battle-view__side">
            <Alert severity="info" icon={<GameIcon name="fire" />} data-testid="fire-order">
              {session.attacking
                ? "Eres el bando atacante: disparas primero."
                : "Dispara primero el rival: es el bando atacante."}{" "}
              Después alternáis, una unidad cada uno. Primero disparan todas las unidades que no se han
              movido (de los dos bandos) y luego las que se movieron.
            </Alert>

            {attackCard && (
              <Box component="section" aria-labelledby="card-attacks-title" data-testid="card-attacks">
                <Typography variant="h6" component="h3" id="card-attacks-title">
                  {attackCard.name}
                </Typography>
                <Typography variant="body2" color={game.attacksPending ? "warning.main" : "text.secondary"} sx={{ mb: 1 }}>
                  {game.attacksPending
                    ? "Tira primero en cada casilla marcada: ninguna unidad dispara hasta entonces."
                    : "Ataques resueltos."}
                </Typography>
                <Stack sx={{ gap: 1 }}>
                  {game.markers.map((position, i) => {
                    const attack = attackOn(i);
                    const result = attack?.target
                      ? `${UNIT_LABELS[attack.target.unitType]}: ${attack.faces.length} ${attack.faces.length === 1 ? "dado" : "dados"}`
                      : attack
                        ? "Vacía"
                        : "Sin tirar";
                    return (
                      <Stack key={i} direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="body1">
                          Casilla {i + 1} · {describePlace(session.board.getHex(position))} · {result}
                        </Typography>
                        <Button
                          variant={attack ? "outlined" : "contained"}
                          color={attack ? "primary" : "warning"}
                          onClick={() => setAttackingHex(i)}
                          startIcon={<GameIcon name={attack ? "dice" : "fire"} />}
                          aria-label={`${attack ? "Ver" : "Tirar"} casilla ${i + 1}`}
                        >
                          {attack ? "Ver" : "Tirar"}
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            )}

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
                      !bonusUsed && (
                        <Button color="inherit" onClick={() => session.undoBattleCombatCard()}>
                          Deshacer
                        </Button>
                      )
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
                        <CombatCardComponent key={card.id} faction={faction} card={card} disabled={card.cost > game.coins}>
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
          </Box>
        </Box>
      )}

      {/* Keyed by unit so every unit starts a fresh questionnaire */}
      <FireDialog
        key={firingIndex ?? "closed"}
        summary={firing}
        // An extra order bought with coins gets none of the card's bonuses
        card={firing?.extra ? null : game.activeCard}
        combatBonus={firingIndex === null ? undefined : session.combatBonusFor(firingIndex)}
        faction={faction}
        onFire={(answers) => withSound(firingIndex !== null && session.fire(firingIndex, answers))}
        onQuickFire={(dice, target, useCombatBonus) =>
          withSound(firingIndex !== null && session.fireQuick(firingIndex, dice, target, useCombatBonus))
        }
        withCoins={!game.extraTurn}
        longRangeDie={session.longRangeDie}
        onUndoShot={() => firingIndex !== null && session.undoShot(firingIndex)}
        onKeepResults={(shotNumber, kept) => firingIndex !== null && session.keepResults(firingIndex, shotNumber, kept)}
        onClose={() => setFiringIndex(null)}
      />

      {attackCard && attackCard.effect?.kind === "attack" && (
        <CardAttackDialog
          key={`attack-${attackingHex ?? "closed"}`}
          hex={
            attackingHex === null
              ? null
              : { index: attackingHex, place: describePlace(session.board.getHex(game.markers[attackingHex]!)) }
          }
          cardName={attackCard.name}
          dicePerHex={attackCard.effect.dicePerHex}
          attack={attackingHex === null ? null : attackOn(attackingHex)}
          faction={faction}
          onAttack={(targetType) => {
            const done = attackingHex !== null && session.attackHex(attackingHex, targetType);
            if (done && targetType !== null) play("dice");
            return done;
          }}
          onUndo={() => attackingHex !== null && session.undoCardAttack(attackingHex)}
          onClose={() => setAttackingHex(null)}
        />
      )}

      <CollisionDialog
        open={collisionOpen}
        summaries={summaries}
        card={game.activeCard}
        faction={faction}
        onRoll={(orderIndex, targetType) => withSound(session.fireCollision(orderIndex, targetType))}
        withCoins={!game.extraTurn}
        onKeepResults={(orderIndex, shotNumber, kept) => session.keepResults(orderIndex, shotNumber, kept)}
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
