import { useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import FireOrderList from "../../FireOrderList";
import BattleReserve from "./BattleReserve";
import BattleInstructions from "./BattleInstructions";
import "./BattleView.css";
import FireDialog from "../../FireDialog";
import CollisionDialog from "../../CollisionDialog";
import BattleMap from "./BattleMap";
import CloseAssaultMap from "./CloseAssaultMap";
import GameIcon from "../../GameIcon";
import { describePlace } from "../../../labels";
import CardAttackDialog from "../../CardAttackDialog";
import { useSound } from "../../../sound";

interface BattleViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onEndBattle: () => void;
  /** Open the coin ledger; the battle shows the coins itself, instead of the header */
  onShowCoins: () => void;
}

/**
 * Battle phase. The battle is played on the physical board, so the map is
 * hidden: the screen shows the fire order, where each unit fires, and the
 * reserve of coins and combat cards. The map, with the cards played, and the
 * instructions are one tap away.
 */
function BattleView({ faction, session, game, onEndBattle, onShowCoins }: BattleViewProps) {
  const [showMap, setShowMap] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
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
        // Landscape: the fire order on the left, the reserve (coins and battle
        // combat cards) filling the rest. Portrait: the reserve first.
        <Box className="battle-view">
          <Stack direction="row" className="battle-view__toolbar" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h5" component="h2">
              Batalla
            </Typography>
            <Chip
              icon={<GameIcon name="fire" size={18} />}
              label={session.attacking ? "Atacante: disparas tú primero" : "Defensor: dispara primero el rival"}
              onClick={() => setShowInstructions(true)}
              variant="outlined"
              data-testid="fire-order"
            />
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => setShowInstructions(true)} startIcon={<GameIcon name="history" />}>
              Instrucciones
            </Button>
            <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
              Ver mapa
            </Button>
            <Button onClick={requestEndBattle} startIcon={<GameIcon name="endTurn" />}>
              Terminar batalla
            </Button>
          </Stack>

          <Box className="battle-view__fire">
            <FireOrderList
              summaries={summaries}
              board={session.board}
              image={session.scenario.image}
              faction={faction}
              onCollision={anyMoved ? () => setCollisionOpen(true) : undefined}
              attack={
                attackCard && {
                  card: attackCard,
                  markers: game.markers,
                  attackOn,
                  pending: game.attacksPending,
                  onOpen: setAttackingHex,
                }
              }
              onMarkCloseAssault={closeAssaultCard ? () => setMarkingCloseAssault(true) : undefined}
              // Units wait for the attack combat card's rolls
              onFire={game.attacksPending ? undefined : (summary) => setFiringIndex(summary.index)}
              withCoins={!game.extraTurn}
              onSkipUnmoved={() => setConfirmingSkip(true)}
              emptyText={
                closeAssaultCard ? "Marca las unidades en asalto cercano para que disparen." : "No se dieron órdenes este turno."
              }
            />
          </Box>

          <Box className="battle-view__reserve">
            <BattleReserve
              faction={faction}
              coins={game.coins}
              onShowCoins={onShowCoins}
              canPlayCombatCards={game.canPlayCombatCards}
              battleCards={battleCards}
              played={game.battleCombatCard}
              canUndo={!bonusUsed}
              onPlay={(card) => {
                const done = session.playBattleCombatCard(card);
                if (done) play("cardPlay");
                return done;
              }}
              onUndo={() => session.undoBattleCombatCard()}
            />
          </Box>
        </Box>
      )}

      <BattleInstructions
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        attacking={session.attacking}
      />

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
