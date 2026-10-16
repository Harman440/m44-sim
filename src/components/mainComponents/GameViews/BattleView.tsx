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
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const closeAssaultCard = game.activeCard?.closeAssaultOnly ?? false;
  const summaries = summarizeOrders(
    game.orders,
    session.board,
    game.shots,
    game.unmovedFireSkipped,
    game.combatCardsPlayed
  );
  const firing = firingIndex === null ? null : (summaries[firingIndex] ?? null);
  const unfired = summaries.filter((s) => s.shotsLeft > 0).length;
  const unmovedUnfired = summaries.filter((s) => s.unmovedGroup && s.shotsLeft > 0).length;
  // Only units that moved (and are still on the board) can have collided with an enemy unit
  const anyMoved = summaries.some((s) => !s.hold && !s.removed);
  const play = useSound();
  const [attackingHex, setAttackingHex] = useState<number | null>(null);
  const attackMark = attackingHex === null ? null : (game.attackMarks.find((mark) => mark.marker === attackingHex) ?? null);
  const attackOn = (marker: number) => game.cardAttacks.find((attack) => attack.marker === marker) ?? null;

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
              attack={{
                marks: game.attackMarks,
                attackOn,
                pending: game.attacksPending,
                onOpen: setAttackingHex,
              }}
              onMarkCloseAssault={closeAssaultCard ? () => setMarkingCloseAssault(true) : undefined}
              assignments={game.assignments}
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
              played={game.combatCardsPlayed}
              assignments={game.assignments}
            />
          </Box>
        </Box>
      )}

      <BattleInstructions
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        attacking={session.attacking}
        reminders={game.combatCardsPlayed.flatMap((card) => (card.battleReminder ? [tr(card.battleReminder)] : []))}
      />

      {/* Keyed by unit so every unit starts a fresh questionnaire */}
      <FireDialog
        key={firingIndex ?? "closed"}
        summary={firing}
        // An extra order bought with coins gets none of the card's bonuses
        card={firing?.extra ? null : game.activeCard}
        combatBonuses={firingIndex === null ? undefined : session.combatBonusesFor(firingIndex)}
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
        canFortify={firingIndex !== null && (game.canFortify[firingIndex] ?? false)}
        onFortify={() => withSound(firingIndex !== null && session.fortify(firingIndex))}
        enemyCamouflage={session.enemyCamouflage}
        suppressiveFire={game.suppressiveFire}
        joinable={(choice) =>
          firingIndex === null
            ? []
            : session.joinable(firingIndex, choice).map(({ order, dice }) => ({
                order,
                dice,
                label: labels.unitKind(summaries[order]!.unitType, summaries[order]!.elite),
                position: summaries[order]!.firingFrom,
              }))
        }
        orderUnit={(order) => (summaries[order] ? labels.unitKind(summaries[order]!.unitType, summaries[order]!.elite) : "")}
        onUndoShot={() => firingIndex !== null && session.undoShot(firingIndex)}
        onKeepResults={(shotNumber, kept) => firingIndex !== null && session.keepResults(firingIndex, shotNumber, kept)}
        onClose={() => setFiringIndex(null)}
      />

      {game.attackMarks.length > 0 && (
        <CardAttackDialog
          key={`attack-${attackingHex ?? "closed"}`}
          hex={
            attackMark === null
              ? null
              : { index: attackMark.marker, place: labels.describePlace(session.board.getHex(attackMark.position)) }
          }
          cardName={attackMark ? tr(attackMark.card.name) : ""}
          dicePerHex={attackMark?.dicePerHex ?? 0}
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
