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
import CardAttackDialog from "../../CardAttackDialog";
import AmbushDialog from "../../AmbushDialog";
import { useSound } from "../../../sound";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    battle: "Batalla",
    attackerFirst: "Atacante: disparas tú primero",
    defenderSecond: "Defensor: dispara primero el rival",
    instructions: "Instrucciones",
    seeMap: "Ver mapa",
    endBattle: "Terminar batalla",
    emptyCloseAssault: "Marca las unidades en asalto cercano para que disparen.",
    emptyNoOrders: "No se dieron órdenes este turno.",
    seeAmbush: "Ver emboscada",
    fireFirst: "Disparar primero",
    tapFiresFirst: "Toca en el orden de fuego la unidad que dispara primero.",
    onlyBeforeFiring: "Solo antes de que dispare ninguna unidad.",
    skipTitle: "¿Pasar a las unidades movidas?",
    skipText: (n: number) =>
      `${
        n === 1
          ? "La unidad sin mover que no ha disparado pierde el disparo."
          : `Las ${n} unidades sin mover que no han disparado pierden el disparo.`
      } No se puede deshacer.`,
    keepUnmoved: "Seguir con las sin mover",
    skip: "Pasar",
    endTitle: "¿Terminar la batalla?",
    endUnfired: (n: number) =>
      `${n === 1 ? "Queda 1 unidad" : `Quedan ${n} unidades`} sin disparar. Si terminas, pierden el disparo.`,
    endAllFired: "Pasarás a la fase final, donde reflejarás en el mapa las bajas y retiradas. No se puede deshacer.",
    keepBattling: "Seguir en batalla",
    endAnyway: "Terminar igualmente",
  },
  en: {
    battle: "Battle",
    attackerFirst: "Attacker: you fire first",
    defenderSecond: "Defender: the opponent fires first",
    instructions: "Instructions",
    seeMap: "See map",
    endBattle: "End battle",
    emptyCloseAssault: "Mark the units in close assault so they fire.",
    emptyNoOrders: "No orders were given this turn.",
    seeAmbush: "See ambush",
    fireFirst: "Fire first",
    tapFiresFirst: "In the firing order, tap the unit that fires first.",
    onlyBeforeFiring: "Only before any unit fires.",
    skipTitle: "On to the moved units?",
    skipText: (n: number) =>
      `${
        n === 1
          ? "The unit that didn't move and hasn't fired loses its shot."
          : `The ${n} units that didn't move and haven't fired lose their shot.`
      } This can't be undone.`,
    keepUnmoved: "Keep going with the unmoved units",
    skip: "Skip",
    endTitle: "End the battle?",
    endUnfired: (n: number) =>
      `${n === 1 ? "1 unit hasn't" : `${n} units haven't`} fired. If you end now, they lose their shot.`,
    endAllFired: "You'll go to the final phase, where you'll mirror casualties and retreats on the map. This can't be undone.",
    keepBattling: "Keep battling",
    endAnyway: "End anyway",
  },
});

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
  const [ambushOpen, setAmbushOpen] = useState(false);
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const ambushPlayed = game.battleCombatCard?.effect?.kind === "ambush";
  // ¡Fusiles arriba! goes before any unit fires (collisions aside)
  const unitFired = game.shots.some((shot) => !shot.collision);
  const anyFiresFirst = game.battleCombatCard?.effect?.kind === "firesFirst";
  const closeAssaultCard = game.activeCard?.closeAssaultOnly ?? false;
  const summaries = summarizeOrders(
    game.orders,
    session.board,
    game.shots,
    game.unmovedFireSkipped,
    { orderCombatCard: game.orderCombatCard, battleCombatCard: game.battleCombatCard }
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
              {t.battle}
            </Typography>
            <Chip
              icon={<GameIcon name="fire" size={18} />}
              label={session.attacking ? t.attackerFirst : t.defenderSecond}
              onClick={() => setShowInstructions(true)}
              variant="outlined"
              data-testid="fire-order"
            />
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => setShowInstructions(true)} startIcon={<GameIcon name="history" />}>
              {t.instructions}
            </Button>
            <Button variant="outlined" onClick={() => setShowMap(true)} startIcon={<GameIcon name="map" />}>
              {t.seeMap}
            </Button>
            <Button onClick={requestEndBattle} startIcon={<GameIcon name="endTurn" />}>
              {t.endBattle}
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
              onSkipUnmoved={() => setConfirmingSkip(true)}
              emptyText={closeAssaultCard ? t.emptyCloseAssault : t.emptyNoOrders}
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
              canUndo={!bonusUsed && !game.ambush}
              playedAction={
                ambushPlayed ? (
                  <Button onClick={() => setAmbushOpen(true)} startIcon={<GameIcon name="fire" />}>
                    {game.ambush ? t.seeAmbush : t.fireFirst}
                  </Button>
                ) : (
                  anyFiresFirst &&
                  !unitFired && (
                    <Typography variant="body2" sx={{ textAlign: "center" }}>
                      {t.tapFiresFirst}
                    </Typography>
                  )
                )
              }
              blockedReason={(card) =>
                card.effect?.kind === "firesFirst" && unitFired ? t.onlyBeforeFiring : null
              }
              onPlay={(card) => {
                const done = session.playBattleCombatCard(card);
                if (done) play("cardPlay");
                // Ambush: straight to the map, to pick the unit attacked and fire first
                if (done && card.effect?.kind === "ambush") setAmbushOpen(true);
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
        board={session.board}
        image={session.scenario.image}
        targets={firingIndex === null ? [] : session.fireTargetsFor(firingIndex)}
        onFireAt={(choice) => withSound(firingIndex !== null && session.fireAt(firingIndex, choice))}
        canTakeGround={firingIndex !== null && session.canTakeGround(firingIndex)}
        onTakeGround={() => firingIndex !== null && session.takeGround(firingIndex)}
        onUndoTakeGround={() => firingIndex !== null && session.undoTakeGround(firingIndex)}
        longRangeDie={session.longRangeDie}
        targetKinds={session.targetKinds}
        canRemoveWire={firingIndex !== null && (game.canRemoveWire[firingIndex] ?? false)}
        onRemoveWire={() => withSound(firingIndex !== null && session.removeWire(firingIndex))}
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
              : { index: attackingHex, place: labels.describePlace(session.board.getHex(game.markers[attackingHex]!)) }
          }
          cardName={tr(attackCard.name)}
          dicePerHex={attackCard.effect.dicePerHex}
          attack={attackingHex === null ? null : attackOn(attackingHex)}
          faction={faction}
          targetKinds={session.targetKinds}
          onAttack={(infantry) => {
            const done = attackingHex !== null && session.attackHex(attackingHex, infantry);
            if (done && infantry !== null) play("dice");
            return done;
          }}
          onUndo={() => attackingHex !== null && session.undoCardAttack(attackingHex)}
          onClose={() => setAttackingHex(null)}
        />
      )}

      <AmbushDialog
        open={ambushOpen && ambushPlayed}
        faction={faction}
        session={session}
        game={game}
        onFired={() => play((session.getSnapshot().ambush?.dice ?? 0) > 0 ? "dice" : "stamp")}
        onClose={() => setAmbushOpen(false)}
      />

      <CollisionDialog
        open={collisionOpen}
        summaries={summaries}
        card={game.activeCard}
        faction={faction}
        targetKinds={session.targetKinds}
        onRoll={(orderIndex, infantry) => withSound(session.fireCollision(orderIndex, infantry))}
        onKeepResults={(orderIndex, shotNumber, kept) => session.keepResults(orderIndex, shotNumber, kept)}
        onClose={() => setCollisionOpen(false)}
      />

      <Dialog open={confirmingSkip} onClose={() => setConfirmingSkip(false)}>
        <DialogTitle>{t.skipTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t.skipText(unmovedUnfired)}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmingSkip(false)}>
            {t.keepUnmoved}
          </Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirmingSkip(false);
              session.skipUnmovedFire();
            }}
          >
            {t.skip}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmingEnd} onClose={() => setConfirmingEnd(false)}>
        <DialogTitle>{t.endTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unfired > 0 ? t.endUnfired(unfired) : t.endAllFired}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirmingEnd(false)}>
            {t.keepBattling}
          </Button>
          <Button
            color={unfired > 0 ? "warning" : "primary"}
            onClick={() => {
              setConfirmingEnd(false);
              onEndBattle();
            }}
          >
            {unfired > 0 ? t.endAnyway : t.endBattle}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default BattleView;
