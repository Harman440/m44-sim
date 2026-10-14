import { useState, useSyncExternalStore } from "react";
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
import { MotionConfig } from "motion/react";
import PassAndPlayMatch, { otherSide } from "../../../game-core/passAndPlay";
import { UnitType } from "../../../game-core/unit";
import { Faction } from "../../../types/faction";
import { Position } from "../../../types/scenario";
import { turnedRound } from "../../../game-core/BoardManager";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import FireDialog from "../../FireDialog";
import AmbushDialog from "../../AmbushDialog";
import ShotDice from "../../ShotDice";
import HexThumbnail from "../../HexThumbnail";
import FactionInsignia from "../../FactionInsignia";
import BattleReserve from "./BattleReserve";
import CoinsDialog from "../../CoinsDialog";
import { OpponentContext } from "../../OpponentContext";
import { useSound } from "../../../sound";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import "../GameView.css";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    title: (turn: number) => `Turno ${turn}: la batalla`,
    fires: { Allies: "Disparan los Aliados", Axis: "Dispara el Eje" },
    groups: { unmoved: "Unidades que no se movieron", moved: "Unidades que se movieron" },
    tapUnit: "Toca la unidad que dispara.",
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    hold: "No disparar",
    holdLabel: (unit: string) => `${unit}: no disparar`,
    nobody: "Ninguna unidad puede disparar ya.",
    choose: (n: number) => `Sacó más resultados que figuras: en el disparo, toca los ${n} dados que aplica.`,
    apply: "Aplicar los resultados",
    cards: { Allies: "Cartas de los Aliados", Axis: "Cartas del Eje" },
    cardsPrivate: "Solo su jugador mira estas cartas.",
    close: "Cerrar",
    end: "Terminar la batalla",
    confirmEndTitle: "¿Terminar la batalla?",
    confirmEndText: (n: number) =>
      n === 1 ? "Una unidad aún puede disparar y perderá su disparo." : `${n} unidades aún pueden disparar y perderán su disparo.`,
    keepFighting: "Seguir",
    groundTitle: "¿Tomar terreno?",
    groundText: (unit: string) =>
      `Tras el asalto cercano, ${unit} puede tomar la casilla: la unidad enemiga se retira ya, y la tuya entra y dispara otra vez. Si no, el enemigo se retira tras la batalla.`,
    takeGround: "Tomar terreno",
    stay: "Quedarse",
    retreats: { Allies: "Retirada de los Aliados", Axis: "Retirada del Eje" },
    retreatText: (unit: string, n: number) =>
      `${unit}: ${n === 1 ? "1 casilla" : `${n} casillas`} más. Toca en el mapa la casilla a la que se retira, hacia su borde.`,
    retreatsAfter: "Las unidades marcadas se retiran: primero las del atacante.",
    attack: (card: string, side: string) => `${card} (${side}): se tira antes de que nadie dispare.`,
    rollAttack: "Tirar en las casillas marcadas",
    attackResults: (card: string) => `${card}: resultados`,
    emptyHex: "Casilla vacía: no se tira.",
    ambush: (side: string) => `Emboscada (${side}): tu unidad atacada en asalto cercano dispara primero.`,
    ambushFire: "Disparar primero",
    block: (card: string, side: string) => `${card} (${side}): toca en el mapa la unidad enemiga que no dispara.`,
    noBlockTargets: "Ninguna unidad enemiga puede disparar ya.",
    relocate: { Allies: "Sin munición: los Aliados eligen", Axis: "Sin munición: el Eje elige" },
    relocateText: "Toca en el mapa una casilla vacía de su línea de fondo para la unidad.",
  },
  en: {
    title: (turn: number) => `Turn ${turn}: the battle`,
    fires: { Allies: "The Allies fire", Axis: "The Axis fires" },
    groups: { unmoved: "Units that didn't move", moved: "Units that moved" },
    tapUnit: "Tap the unit that fires.",
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    hold: "Hold fire",
    holdLabel: (unit: string) => `${unit}: hold fire`,
    nobody: "No unit can fire any more.",
    choose: (n: number) => `It rolled more results than it has figures: in the shot, tap the ${n} dice it applies.`,
    apply: "Apply the results",
    cards: { Allies: "Allied cards", Axis: "Axis cards" },
    cardsPrivate: "Only their player looks at these cards.",
    close: "Close",
    end: "End the battle",
    confirmEndTitle: "End the battle?",
    confirmEndText: (n: number) =>
      n === 1 ? "One unit can still fire and will lose its shot." : `${n} units can still fire and will lose their shot.`,
    keepFighting: "Keep fighting",
    groundTitle: "Take ground?",
    groundText: (unit: string) =>
      `After the close assault, ${unit} can take the hex: the enemy unit retreats now, and yours moves in and fires again. If not, the enemy retreats after the battle.`,
    takeGround: "Take ground",
    stay: "Stay",
    retreats: { Allies: "Allied retreat", Axis: "Axis retreat" },
    retreatText: (unit: string, n: number) =>
      `${unit}: ${n === 1 ? "1 more hex" : `${n} more hexes`}. Tap the hex on the map it retreats to, toward its edge.`,
    retreatsAfter: "The marked units retreat, the attacker's first.",
    attack: (card: string, side: string) => `${card} (${side}): rolled before anyone fires.`,
    rollAttack: "Roll on the marked hexes",
    attackResults: (card: string) => `${card}: results`,
    emptyHex: "Empty hex: no roll.",
    ambush: (side: string) => `Ambush (${side}): your unit attacked in close assault fires first.`,
    ambushFire: "Fire first",
    block: (card: string, side: string) => `${card} (${side}): tap the enemy unit on the map that can't fire.`,
    noBlockTargets: "No enemy unit can fire any more.",
    relocate: { Allies: "Out of Ammo: the Allies pick", Axis: "Out of Ammo: the Axis picks" },
    relocateText: "Tap an empty hex on its baseline on the map for the unit.",
  },
});

interface SharedBattleViewProps {
  match: PassAndPlayMatch;
}

const noop = () => {};

/**
 * Pass and play's battle, on one screen for both players: the sides take turns to fire, one unit
 * at a time, and the app deals the hits. Each side's combat cards are behind its own button
 */
function SharedBattleView({ match }: SharedBattleViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const play = useSound();
  const { battle } = useSyncExternalStore(match.subscribe, match.getSnapshot);
  const [firing, setFiring] = useState<{ side: Faction; order: number } | null>(null);
  const [cardsOf, setCardsOf] = useState<Faction | null>(null);
  const [coinsOf, setCoinsOf] = useState<Faction | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [ambushing, setAmbushing] = useState(false);
  const [attackShown, setAttackShown] = useState<Faction | null>(null);
  const tr = useTr();
  if (!battle) return null;

  // The map as the attacker sees it, with both armies
  const viewer = match.scenario.attacker;
  const viewSession = match.sessions[viewer];
  const view = viewSession.getSnapshot();
  const side = battle.side;
  const session = side ? match.sessions[side] : null;
  const summaries = session?.orderSummaries() ?? [];
  const canStillFire = (["Allies", "Axis"] as const).reduce(
    (sum, faction) => sum + match.sessions[faction].orderSummaries().filter((s) => s.shotsLeft > 0).length,
    0
  );

  // The map picks a hex for a unit of one side: a retreat, Out of Ammo's baseline, or the enemy
  // unit a card stops. Positions turn between that side's view and the map's (the attacker's)
  const retreat = battle.retreat;
  const relocate = retreat ? null : battle.relocate;
  const card = retreat || relocate ? null : battle.card;
  const pick = retreat
    ? { side: retreat.side, from: retreat.position as Position | null, options: retreat.options, act: (p: Position) => match.retreat(p) }
    : relocate
      ? { side: relocate.side, from: relocate.position as Position | null, options: relocate.options, act: (p: Position) => match.relocate(p) }
      : card?.kind === "block"
        ? { side: otherSide(card.side), from: null, options: card.targets, act: (p: Position) => match.block(p) }
        : null;
  const toMap = (position: Position) => (pick && pick.side !== viewer ? turnedRound(position) : position);
  const pickOptions = pick?.options.map(toMap) ?? [];
  const tapMap = (position: Position) => {
    if (pick) pick.act(toMap(position));
  };
  // The order combat cards' marks: the attacker's, or else the defender's, turned onto the map
  const otherGame = match.sessions[otherSide(viewer)].getSnapshot();
  const marks =
    view.markers.length > 0 || otherGame.markers.length === 0
      ? { positions: view.markers, kind: view.orderCombatCard?.marker?.kind }
      : { positions: otherGame.markers.map((m) => turnedRound(m)), kind: otherGame.orderCombatCard?.marker?.kind };
  const cardName = (faction: Faction) => {
    const played = match.sessions[faction].getSnapshot().battleCombatCard;
    return played ? tr(played.name) : "";
  };
  const attackCard = (faction: Faction) => {
    const played = match.sessions[faction].getSnapshot().orderCombatCard;
    return played ? tr(played.name) : "";
  };
  const retreatingUnit = retreat
    ? match.sessions[retreat.side].board.getHex(retreat.position)?.unit?.getUnitType()
    : undefined;
  const groundUnit = battle.ground
    ? match.sessions[battle.ground.side].orderSummaries()[battle.ground.order]?.unitType
    : undefined;

  const closeFire = () => {
    // A shot whose results are picked is dealt once its dialog closes
    if (battle.pending && !battle.pending.mustChoose) match.applyShot();
    setFiring(null);
  };

  const fireSession = firing ? match.sessions[firing.side] : null;
  const fireSummary = firing && fireSession ? (fireSession.orderSummaries()[firing.order] ?? null) : null;

  return (
    <MotionConfig reducedMotion="user">
      <Box className="game-screen" sx={{ width: "100%", maxWidth: 1400 }}>
        <Box component="main" className="game-screen__main">
          <div className="phase-layout">
            <div className="phase-layout__board">
              <Board
                onTileClick={pick ? tapMap : noop}
                unitHexPosition={pick?.from ? toMap(pick.from) : null}
                possibleMovePositions={pick?.from ? pickOptions : []}
                markablePositions={pick && !pick.from ? pickOptions : []}
                markers={marks.positions}
                markerKind={marks.kind}
                possibleMoveAndFirePositions={[]}
                boardManager={viewSession.board}
                orders={view.orders}
                backgroundImage={viewSession.scenario.image}
                faction={viewer}
                opponent={match.opponentOf(viewer)}
                strength={view.strength}
                firedUnits={new Set(view.orders.filter((_, i) => viewSession.orderSummaries()[i]?.shots.length).map((o) => o.unit))}
              />
            </div>

            <div className="phase-layout__controls">
              <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                {t.title(battle.turn)}
              </Typography>

              {/* An attack card goes before anyone fires */}
              {battle.attacks.map((faction) => (
                <Stack key={faction} spacing={1} data-testid="card-attack">
                  <Typography variant="body2">{t.attack(attackCard(faction), labels.factions[faction])}</Typography>
                  <Button
                    startIcon={<GameIcon name="bomb" />}
                    onClick={() => {
                      if (match.rollAttacks(faction)) {
                        play("dice");
                        setAttackShown(faction);
                      }
                    }}
                  >
                    {t.rollAttack}
                  </Button>
                </Stack>
              ))}

              {card?.kind === "ambush" && (
                <Stack spacing={1} data-testid="card-ambush">
                  <Typography variant="body2">{t.ambush(labels.factions[card.side])}</Typography>
                  <Button startIcon={<GameIcon name="fire" />} onClick={() => setAmbushing(true)}>
                    {t.ambushFire}
                  </Button>
                </Stack>
              )}
              {card?.kind === "block" && (
                <Typography variant="body2" color={card.targets.length ? "warning.main" : "text.secondary"} data-testid="card-block">
                  {card.targets.length ? t.block(cardName(card.side), labels.factions[card.side]) : t.noBlockTargets}
                </Typography>
              )}

              {relocate ? (
                <Stack spacing={1} data-testid="relocate">
                  <Typography variant="subtitle1" component="h2">
                    {t.relocate[relocate.side]}
                  </Typography>
                  <Typography variant="body2">{t.relocateText}</Typography>
                </Stack>
              ) : retreat ? (
                <Stack spacing={1} data-testid="retreat">
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <FactionInsignia faction={retreat.side} size={28} decorative />
                    <Typography variant="subtitle1" component="h2">
                      {t.retreats[retreat.side]}
                    </Typography>
                  </Stack>
                  {battle.retreating && (
                    <Typography variant="body2" color="text.secondary">
                      {t.retreatsAfter}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    {t.retreatText(retreatingUnit ? labels.units[retreatingUnit] : "", retreat.flags)}
                  </Typography>
                </Stack>
              ) : battle.ground && groundUnit ? (
                <Stack spacing={1} data-testid="take-ground">
                  <Typography variant="subtitle1" component="h2">
                    {t.groundTitle}
                  </Typography>
                  <Typography variant="body2">{t.groundText(labels.units[groundUnit].toLowerCase())}</Typography>
                  <Button color="success" onClick={() => match.decideGround(true)}>
                    {t.takeGround}
                  </Button>
                  <Button variant="outlined" onClick={() => match.decideGround(false)}>
                    {t.stay}
                  </Button>
                </Stack>
              ) : battle.pending ? (
                <Stack spacing={1}>
                  {battle.pending.mustChoose && (
                    <Typography variant="body2" color="warning.main">
                      {t.choose(battle.pending.limit)}
                    </Typography>
                  )}
                  <Button
                    onClick={() => match.applyShot()}
                    disabled={battle.pending.mustChoose}
                    startIcon={<GameIcon name="confirm" />}
                  >
                    {t.apply}
                  </Button>
                </Stack>
              ) : side && session ? (
                <Stack spacing={1} data-testid="fire-turn">
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <FactionInsignia faction={side} size={28} decorative />
                    <Typography variant="subtitle1" component="h2">
                      {t.fires[side]}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t.groups[battle.group!]} · {t.tapUnit}
                  </Typography>
                  {battle.fireable.map((order) => {
                    const summary = summaries[order]!;
                    const figures = session.figuresAt(summary.firingFrom);
                    const unit = labels.units[summary.unitType as UnitType];
                    return (
                      <Stack key={order} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                        <Button
                          variant="outlined"
                          onClick={() => setFiring({ side, order })}
                          sx={{ flex: 1, justifyContent: "flex-start", gap: 1, textTransform: "none" }}
                        >
                          <HexThumbnail
                            board={session.board}
                            position={summary.firingFrom}
                            image={session.scenario.image}
                            faction={side}
                            size={32}
                          />
                          <Box component="span" sx={{ textAlign: "left" }}>
                            {unit}
                            {figures !== null && (
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>
                                {t.figures(figures)}
                              </Typography>
                            )}
                          </Box>
                        </Button>
                        <Button variant="text" size="small" aria-label={t.holdLabel(unit)} onClick={() => match.holdFire(order)}>
                          {t.hold}
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                battle.attacks.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t.nobody}
                  </Typography>
                )
              )}

              <Box sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
                {(["Allies", "Axis"] as const).map((faction) => (
                  <Button
                    key={faction}
                    variant="outlined"
                    startIcon={<GameIcon name="cards" />}
                    onClick={() => setCardsOf(faction)}
                  >
                    {t.cards[faction]}
                  </Button>
                ))}
                <Button
                  onClick={() => (canStillFire > 0 ? setConfirmingEnd(true) : match.endBattle())}
                  disabled={
                    !!battle.pending || !!battle.ground || !!retreat || !!relocate || battle.retreating || battle.attacks.length > 0
                  }
                  startIcon={<GameIcon name="endTurn" />}
                >
                  {t.end}
                </Button>
              </Box>
            </div>
          </div>
        </Box>

        {firing && fireSession && (
          <OpponentContext.Provider
            value={{ opponent: match.opponentOf(firing.side), strength: fireSession.getSnapshot().strength }}
          >
            <FireDialog
              key={`${firing.side}-${firing.order}`}
              summary={fireSummary}
              card={fireSummary?.extra ? null : fireSession.getSnapshot().activeCard}
              combatBonus={fireSession.combatBonusFor(firing.order)}
              faction={firing.side}
              board={fireSession.board}
              image={fireSession.scenario.image}
              targets={fireSession.fireTargetsFor(firing.order)}
              onFireAt={(choice) => {
                const done = match.fire(firing.order, choice.position, choice.useCombatBonus);
                if (done) play("dice");
                return done;
              }}
              longRangeDie={fireSession.longRangeDie}
              targetKinds={fireSession.targetKinds}
              knownTarget={(position) => {
                const enemy = fireSession.enemyAt(position);
                return enemy && { infantry: enemy.unitType === UnitType.INFANTRY, sandbags: enemy.sandbags };
              }}
              canFireAgain={false}
              onKeepResults={(_, kept) => match.keepShotResults(kept)}
              onClose={closeFire}
            />
          </OpponentContext.Provider>
        )}

        {ambushing && card?.kind === "ambush" && (
          <OpponentContext.Provider
            value={{ opponent: match.opponentOf(card.side), strength: match.sessions[card.side].getSnapshot().strength }}
          >
            <AmbushDialog
              open
              faction={card.side}
              session={match.sessions[card.side]}
              game={match.sessions[card.side].getSnapshot()}
              onFired={() => play("dice")}
              onClose={() => {
                if (battle.pending?.ambush && !battle.pending.mustChoose) match.applyShot();
                setAmbushing(false);
              }}
              onAmbush={(from, target) => match.ambush(from, target)}
              knownTarget={(position) => {
                const enemy = match.sessions[card.side].enemyAt(position);
                return enemy && { infantry: enemy.unitType === UnitType.INFANTRY, sandbags: enemy.sandbags };
              }}
              onKeepResults={(kept) => match.keepShotResults(kept)}
            />
          </OpponentContext.Provider>
        )}

        {attackShown && (
          <Dialog open onClose={() => setAttackShown(null)} fullWidth maxWidth="sm">
            <DialogTitle>{t.attackResults(attackCard(attackShown))}</DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                {match.sessions[attackShown].getSnapshot().cardAttacks.map((attack) =>
                  attack.target ? (
                    <ShotDice
                      key={attack.marker}
                      shot={{ steps: [], dice: attack.dice, faces: attack.faces, notes: [], collision: false, target: attack.target, combatBonus: false, kept: null }}
                      rollId={attack.marker + 1}
                      faction={attackShown}
                      rolling
                    />
                  ) : (
                    <Typography key={attack.marker} variant="body2" color="text.secondary">
                      {t.emptyHex}
                    </Typography>
                  )
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button variant="text" onClick={() => setAttackShown(null)}>
                {t.close}
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {cardsOf && (
          <Dialog open onClose={() => setCardsOf(null)} fullWidth maxWidth="md">
            <DialogTitle>{t.cards[cardsOf]}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>{t.cardsPrivate}</DialogContentText>
              {(() => {
                const owner = match.sessions[cardsOf];
                const game = owner.getSnapshot();
                return (
                  <BattleReserve
                    faction={cardsOf}
                    coins={game.coins}
                    onShowCoins={() => setCoinsOf(cardsOf)}
                    canPlayCombatCards={game.canPlayCombatCards}
                    battleCards={game.combatHand.filter((card) => card.phase === "battle")}
                    played={game.battleCombatCard}
                    canUndo={!game.shots.some((shot) => shot.combatBonus)}
                    onPlay={(card) => {
                      const done = owner.playBattleCombatCard(card);
                      if (done) play("cardPlay");
                      return done;
                    }}
                    onUndo={() => owner.undoBattleCombatCard()}
                  />
                );
              })()}
            </DialogContent>
            <DialogActions>
              <Button variant="text" onClick={() => setCardsOf(null)}>
                {t.close}
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {coinsOf && (
          <CoinsDialog
            open
            onClose={() => setCoinsOf(null)}
            session={match.sessions[coinsOf]}
            game={match.sessions[coinsOf].getSnapshot()}
          />
        )}

        <Dialog open={confirmingEnd} onClose={() => setConfirmingEnd(false)}>
          <DialogTitle>{t.confirmEndTitle}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t.confirmEndText(canStillFire)}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setConfirmingEnd(false)}>
              {t.keepFighting}
            </Button>
            <Button
              color="error"
              onClick={() => {
                setConfirmingEnd(false);
                match.endBattle();
              }}
            >
              {t.end}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MotionConfig>
  );
}

export default SharedBattleView;
