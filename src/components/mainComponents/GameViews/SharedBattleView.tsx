import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  ToggleButton,
  Typography,
} from "@mui/material";
import { MotionConfig } from "motion/react";
import PassAndPlayMatch, { otherSide } from "../../../game-core/passAndPlay";
import { UnitType } from "../../../game-core/unit";
import { Faction } from "../../../types/faction";
import { Position } from "../../../types/scenario";
import GameSession, { ShotAim } from "../../../game-core/gameSession";
import { samePosition } from "../../../game-core/position";
import { BASE_DICE_BY_DISTANCE } from "../../../data/fireQuestions";
import { turnedRound } from "../../../game-core/BoardManager";
import Board from "../../Board";
import GameIcon from "../../GameIcon";
import SandbagsIcon from "../../SandbagsIcon";
import { BarbedWireIcon } from "../../BarbedWire";
import DiceResult, { rollDuration } from "../../DiceResult";
import RollReading from "../../RollReading";
import ShotSteps from "../../ShotSteps";
import { appliedFaces, readRoll } from "../../../game-core/rollResult";
import { placedDice } from "../../../game-core/fireRules";
import DicePool from "../../DicePool";
import InfoButton from "../../InfoButton";
import ShotDice from "../../ShotDice";
import HexThumbnail from "../../HexThumbnail";
import FactionInsignia from "../../FactionInsignia";
import BattleReserve from "./BattleReserve";
import CoinsDialog from "../../CoinsDialog";
import { OpponentContext } from "../../OpponentContext";
import { useSound } from "../../../sound";
import { computerStep } from "../useComputerPlayer";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import "../GameView.css";
import "./PhaseLayout.css";
import MedalTally from "../../MedalTally";

const TEXT = defineMessages({
  es: {
    title: (turn: number) => `Turno ${turn}: la batalla`,
    fires: { Allies: "Disparan los Aliados", Axis: "Dispara el Eje" },
    groups: { unmoved: "Unidades que no se movieron", moved: "Unidades que se movieron" },
    tapUnit: "Toca en el mapa una de las unidades marcadas.",
    range: (range: string) => `Alcance: ${range}`,
    closeAssaultOnly: "Solo asalto cercano",
    tapTarget: "Toca un objetivo en el mapa: el número son los dados que tira.",
    noTargets: "No tiene a ningún enemigo a tiro.",
    target: (unit: string, terrain: string, distance: number) =>
      `${unit} · ${terrain} · a ${distance} ${distance === 1 ? "casilla (asalto cercano)" : "casillas"}`,
    sandbags: "con sacos terreros",
    whereDiceComeFrom: "De dónde salen los dados",
    total: (dice: number) => `Total: ${dice}`,
    fire: "Disparar",
    rollTitle: (unit: string) => `Disparo: ${unit}`,
    done: "Seguir",
    limited: (kept: number, rolled: number) =>
      `Más impactos que figuras: aplica ${kept === 1 ? "1 impacto" : `${kept} impactos`} de ${rolled}. Las banderas y los suministros cuentan todos.`,
    dice: "Dados tirados",
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    hold: "No disparar",
    holdLabel: (unit: string) => `${unit}: no disparar`,
    fortify: "Fortificar sin disparar",
    removeWire: "Quitar la alambrada sin disparar",
    suppressive: "Fuego de supresión",
    concentrated: "Fuego concentrado: suma unidades",
    joinUnit: (unit: string, dice: number) => `${unit} · +${dice}`,
    nobody: "Ninguna unidad puede disparar ya.",
    thinking: "El ordenador está pensando…",
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
      `Tras el asalto cercano, ${unit} puede tomar la casilla que dejó el enemigo: entra y dispara otra vez, en asalto cercano.`,
    pushText: (unit: string) =>
      `Tras el asalto cercano, ${unit} puede entrar en la casilla de la que se retiró el enemigo, sin volver a disparar.`,
    takeGround: "Tomar terreno",
    stay: "Quedarse",
    retreats: { Allies: "Retirada de los Aliados", Axis: "Retirada del Eje" },
    retreatText: (unit: string, n: number) =>
      `${unit}: otra bandera estando inmovilizada, se retira ya ${n === 1 ? "1 casilla" : `${n} casillas`} y no combate más este turno. Toca en el mapa la casilla a la que se retira, hacia su borde.`,
    attack: (card: string, side: string) => `${card} (${side}): se tira antes de que nadie dispare.`,
    rollAttack: "Tirar en las casillas marcadas",
    attackResults: (card: string) => `${card}: resultados`,
    emptyHex: "Casilla vacía: no se tira.",
  },
  en: {
    title: (turn: number) => `Turn ${turn}: the battle`,
    fires: { Allies: "The Allies fire", Axis: "The Axis fires" },
    groups: { unmoved: "Units that didn't move", moved: "Units that moved" },
    tapUnit: "Tap one of the marked units on the map.",
    range: (range: string) => `Range: ${range}`,
    closeAssaultOnly: "Close assault only",
    tapTarget: "Tap a target on the map: the number is the dice it rolls.",
    noTargets: "No enemy is within its fire.",
    target: (unit: string, terrain: string, distance: number) =>
      `${unit} · ${terrain} · ${distance} ${distance === 1 ? "hex away (close assault)" : "hexes away"}`,
    sandbags: "behind sandbags",
    whereDiceComeFrom: "Where the dice come from",
    total: (dice: number) => `Total: ${dice}`,
    fire: "Fire",
    rollTitle: (unit: string) => `Fire: ${unit}`,
    done: "Continue",
    limited: (kept: number, rolled: number) =>
      `More hits than figures: it applies ${kept === 1 ? "1 hit" : `${kept} hits`} of ${rolled}. Flags and supplies all count.`,
    dice: "Dice rolled",
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    hold: "Hold fire",
    holdLabel: (unit: string) => `${unit}: hold fire`,
    fortify: "Fortify, no shot",
    removeWire: "Remove the wire, no shot",
    suppressive: "Suppressive Fire",
    concentrated: "Concentrated Fire: add units",
    joinUnit: (unit: string, dice: number) => `${unit} · +${dice}`,
    nobody: "No unit can fire any more.",
    thinking: "The computer is thinking…",
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
      `After the close assault, ${unit} can take the hex the enemy left: it moves in and fires again, in close assault.`,
    pushText: (unit: string) =>
      `After the close assault, ${unit} can move into the hex the enemy retreated from, without firing again.`,
    takeGround: "Take ground",
    stay: "Stay",
    retreats: { Allies: "Allied retreat", Axis: "Axis retreat" },
    retreatText: (unit: string, n: number) =>
      `${unit}: another flag while pinned, so it retreats ${n === 1 ? "1 hex" : `${n} hexes`} now and doesn't battle again this turn. Tap the hex on the map it retreats to, toward its edge.`,
    attack: (card: string, side: string) => `${card} (${side}): rolled before anyone fires.`,
    rollAttack: "Roll on the marked hexes",
    attackResults: (card: string) => `${card}: results`,
    emptyHex: "Empty hex: no roll.",
  },
});

interface SharedBattleViewProps {
  match: PassAndPlayMatch;
}

const noop = () => {};

/** How long the computer waits before each thing it does in the battle, so the person can follow */
const COMPUTER_PAUSE_MS = 900;

/** What the computer's side has to do in the battle now, if anything */
function computerTurn(match: PassAndPlayMatch, battle: NonNullable<ReturnType<PassAndPlayMatch["getSnapshot"]>["battle"]>) {
  const computer = match.computer;
  if (!computer) return null;
  if (battle.attacks.includes(computer)) return "attack";
  if (battle.attacks.length > 0) return null;
  if (battle.retreat) return battle.retreat.side === computer ? "retreat" : null;
  if (battle.ground) return battle.ground.side === computer ? "ground" : null;
  return battle.side === computer && battle.fireable.length > 0 ? "fire" : null;
}

interface FiringUnitProps {
  side: Faction;
  session: GameSession;
  order: number;
  /** The enemy units it can fire at, with their dice */
  aims: readonly ShotAim[];
  /** The target picked on the map */
  aim: ShotAim | null;
  /** Fire, with the units joined (Concentrated Fire) and the suppressive die or not */
  onFire: (options: { joined: number[]; suppressive: boolean }) => void;
  onHold: () => void;
  /** Fortify was played: the unit puts sandbags on its hex instead of firing */
  onFortify: () => void;
  /** Infantry on barbed wire removes it instead of firing */
  onRemoveWire: () => void;
}

const formatDice = (dice: number) => (dice > 0 ? `+${dice}` : `${dice}`);

/** The unit picked on the map to fire: where it stands, its target and the dice it rolls */
function FiringUnit({ side, session, order, aims, aim, onFire, onHold, onFortify, onRemoveWire }: FiringUnitProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const summary = session.orderSummaries()[order]!;
  const unit = labels.unitKind(summary.unitType, summary.elite);
  const figures = session.figuresAt(summary.firingFrom);
  const range = BASE_DICE_BY_DISTANCE[summary.unitType];
  const game = session.getSnapshot();
  const [suppressive, setSuppressive] = useState(false);
  const [chosen, setChosen] = useState<number[]>([]);
  // Concentrated Fire: the units that can roll with this one at the target, and the ones joined that still can
  const options = aim ? session.joinable(order, { position: aim.position, infantry: true, sandbags: false, suppressive }) : [];
  const joined = chosen.filter((o) => options.some((option) => option.order === o));
  const joinedOptions = options.filter((option) => joined.includes(option.order));
  const joinedDice = joinedOptions.reduce((sum, option) => sum + option.dice, 0);
  const summaries = session.orderSummaries();

  return (
    <Stack spacing={1} data-testid="firing-unit">
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <HexThumbnail board={session.board} position={summary.firingFrom} image={session.scenario.image} faction={side} size={36} />
        <Box>
          <Typography variant="subtitle2">{unit}</Typography>
          <Typography variant="body2" color="text.secondary">
            {[
              figures !== null && t.figures(figures),
              summary.closeAssaultOnly ? t.closeAssaultOnly : t.range(range.join(" / ")),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        </Box>
      </Stack>

      {aim ? (
        <Stack spacing={1} data-testid="fire-target">
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <HexThumbnail board={session.board} position={aim.position} image={session.scenario.image} faction={side} size={36} />
            <Typography variant="body2">
              {t.target(labels.units[aim.enemy.unitType], labels.terrain[aim.terrain], aim.distance)}
              {aim.enemy.sandbags && ` · ${t.sandbags}`}
            </Typography>
          </Stack>
          {game.suppressiveFire && (
            <FormControlLabel
              control={<Switch checked={suppressive} onChange={(e) => setSuppressive(e.target.checked)} />}
              label={t.suppressive}
              sx={{ minHeight: 48, m: 0 }}
            />
          )}
          {options.length > 0 && (
            <Stack sx={{ gap: 0.5 }} data-testid="concentrated-fire">
              <Typography variant="body2" color="text.secondary">
                {t.concentrated}
              </Typography>
              {options.map((option) => (
                <ToggleButton
                  key={option.order}
                  value={option.order}
                  size="small"
                  selected={joined.includes(option.order)}
                  onChange={() => setChosen(joined.includes(option.order) ? joined.filter((o) => o !== option.order) : [...joined, option.order])}
                  sx={{ gap: 1, textTransform: "none", minHeight: 48, justifyContent: "flex-start" }}
                >
                  <HexThumbnail
                    board={session.board}
                    position={summaries[option.order]!.firingFrom}
                    image={session.scenario.image}
                    faction={side}
                    size={28}
                  />
                  {t.joinUnit(labels.unitKind(summaries[option.order]!.unitType, summaries[option.order]!.elite), option.dice)}
                </ToggleButton>
              ))}
            </Stack>
          )}
          <DicePool dice={aim.dice} eightSided={aim.eightSided} joined={joinedOptions} faction={side}>
            <InfoButton title={t.whereDiceComeFrom}>
              <Stack sx={{ gap: 0.5 }} data-testid="fire-breakdown">
                {aim.steps.map((step) => (
                  <Stack key={step.label.es} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="body1">{tr(step.label)}</Typography>
                    <Typography variant="body1">{formatDice(step.dice)}</Typography>
                  </Stack>
                ))}
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {t.total(aim.dice + joinedDice)}
                </Typography>
              </Stack>
            </InfoButton>
          </DicePool>
          <Button size="large" startIcon={<GameIcon name="fire" />} onClick={() => onFire({ joined, suppressive })}>
            {t.fire}
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2" color={aims.length ? "text.primary" : "warning.main"}>
          {aims.length ? t.tapTarget : t.noTargets}
        </Typography>
      )}

      {game.canRemoveWire[order] && (
        <Button variant="outlined" color="warning" startIcon={<BarbedWireIcon size={28} />} onClick={onRemoveWire}>
          {t.removeWire}
        </Button>
      )}
      {session.getSnapshot().canFortify[order] && (
        <Button variant="outlined" color="warning" startIcon={<SandbagsIcon size={28} />} onClick={onFortify}>
          {t.fortify}
        </Button>
      )}
      <Button variant="outlined" aria-label={t.holdLabel(unit)} onClick={onHold}>
        {t.hold}
      </Button>
    </Stack>
  );
}

/**
 * Pass and play's battle, on one screen for both players: the sides take turns to fire, one unit
 * at a time, and the app deals the hits. The side whose turn it is taps one of its units on the
 * map, then a target (each with its dice); the roll comes up over the map. Each side's combat
 * cards are behind its own button
 */
function SharedBattleView({ match }: SharedBattleViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const play = useSound();
  const { battle } = useSyncExternalStore(match.subscribe, match.getSnapshot);
  /** The unit picked to fire (an order of the side whose turn it is) and its target, on the map */
  const [aiming, setAiming] = useState<{ side: Faction; order: number; target: Position | null } | null>(null);
  /** The shot rolled on this screen, whose dice are thrown in: its side and index in that side's shots */
  const [rolled, setRolled] = useState<{ side: Faction; shot: number } | null>(null);
  const [cardsOf, setCardsOf] = useState<Faction | null>(null);
  const [coinsOf, setCoinsOf] = useState<Faction | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [attackShown, setAttackShown] = useState<Faction | null>(null);
  const tr = useTr();
  const computer = match.computer;
  const computerActs = battle ? computerTurn(match, battle) : null;
  const computerWaits = !!computerActs && !rolled && !attackShown;

  // The computer plays its turn after a pause; its shot stays up until the person taps "Seguir"
  useEffect(() => {
    if (!computerWaits || !computer) return;
    const timer = setTimeout(() => {
      const shots = match.sessions[computer].getSnapshot().shots.length;
      if (!computerStep(match)) return;
      if (computerActs === "attack") {
        play("dice");
        setAttackShown(computer);
      } else if (match.sessions[computer].getSnapshot().shots.length > shots) {
        play("dice");
        setRolled({ side: computer, shot: shots });
      }
    }, COMPUTER_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [computerWaits, computerActs, computer, match, battle, play]);

  if (!battle) return null;

  const mainSide = match.mainSide;
  const side = battle.side;
  const session = side ? match.sessions[side] : null;
  const summaries = session?.orderSummaries() ?? [];
  const canStillFire = (["Allies", "Axis"] as const).reduce(
    (sum, faction) => sum + match.sessions[faction].orderSummaries().filter((s) => s.shotsLeft > 0).length,
    0
  );

  // The map picks a hex for a unit of one side: a retreat. The board drawn is that side's, so its
  // positions need no turning: the map is still seen from the main side (ViewSideContext)
  const retreat = battle.retreat;
  const pick = retreat && retreat.side !== computer
    ? { side: retreat.side, from: retreat.position as Position | null, options: retreat.options, act: (p: Position) => match.retreat(p) }
    : null;

  // The shot rolled here, dealt at once: shown over the map until it's dismissed
  const shown = rolled;
  const shownSession = shown ? match.sessions[shown.side] : null;
  const shownShot = shown ? shownSession!.getSnapshot().shots[shown.shot] : undefined;
  const shownUnit = shownShot ? shownSession!.orderSummaries()[shownShot.orderIndex] : undefined;

  // Firing: the side whose turn it is taps one of its units, then a target
  const fireTurn =
    !pick && !retreat && !shownShot && !battle.ground && side && side !== computer && session ? { side, session } : null;
  const picked = fireTurn && aiming?.side === fireTurn.side && battle.fireable.includes(aiming.order) ? aiming : null;
  const pickedSummary = picked ? summaries[picked.order] : undefined;
  const aims: ShotAim[] =
    picked && fireTurn
      ? fireTurn.session
          .fireTargetsFor(picked.order)
          .filter((target) => target.lineOfSight && target.dice > 0)
          .flatMap((target) => fireTurn.session.aimAt(picked.order, target.position) ?? [])
      : [];
  const aim = picked?.target ? (aims.find((a) => samePosition(a.position, picked.target!)) ?? null) : null;
  const fireablePositions = fireTurn ? battle.fireable.map((order) => summaries[order]!.firingFrom) : [];

  // The board of the side acting now, seen from the main side
  const boardSide: Faction = pick?.side ?? (shownShot ? shown!.side : undefined) ?? fireTurn?.side ?? mainSide;
  const boardSession = match.sessions[boardSide];
  const boardGame = boardSession.getSnapshot();
  const inBoardView = (faction: Faction, position: Position) => (faction === boardSide ? position : turnedRound(position));

  // The combat cards' marks, both sides', the attacker's first
  const defender = otherSide(match.scenario.attacker);
  const markSides = [match.scenario.attacker, defender].map((faction) => ({ faction, game: match.sessions[faction].getSnapshot() }));
  const marks = {
    positions: markSides.flatMap(({ faction, game }) => game.markers.map((m) => inBoardView(faction, m))),
    kind: markSides.flatMap(({ game }) => game.markerKinds),
  };
  // The units each side gave a combat card to
  const cardBadges = markSides.flatMap(({ faction, game }) =>
    game.assignments.map((a) => ({ position: a.position && inBoardView(faction, a.position) }))
  );

  const tapMap = (position: Position) => {
    if (pick) {
      pick.act(position);
      return;
    }
    if (!fireTurn) return;
    const order = battle.fireable.find((o) => samePosition(summaries[o]!.firingFrom, position));
    if (order !== undefined) {
      setAiming(picked?.order === order ? null : { side: fireTurn.side, order, target: null });
    } else if (picked && aims.some((a) => samePosition(a.position, position))) {
      setAiming({ ...picked, target: position });
    }
  };

  const fire = (options: { joined: number[]; suppressive: boolean }) => {
    if (!picked || !aim || !fireTurn) return;
    const shot = fireTurn.session.getSnapshot().shots.length;
    if (!match.fire(picked.order, aim.position, options)) return;
    play("dice");
    setRolled({ side: fireTurn.side, shot });
  };

  const closeRoll = () => {
    setAiming(null);
    setRolled(null);
  };

  /** The attack combat cards a side played (Barrage, Air Power…) */
  const attackCard = (faction: Faction) =>
    match.sessions[faction]
      .getSnapshot()
      .combatCardsPlayed.filter((card) => card.effect?.kind === "attack")
      .map((card) => tr(card.name))
      .join(" · ");
  const retreatingUnit = retreat
    ? match.sessions[retreat.side].board.getHex(retreat.position)?.unit?.getUnitType()
    : undefined;
  const groundUnit = battle.ground
    ? match.sessions[battle.ground.side].orderSummaries()[battle.ground.order]?.unitType
    : undefined;
  const pushesBack = battle.ground ? match.sessions[battle.ground.side].groundRuleFor(battle.ground.order) === "pushBack" : false;

  // The shot shown keeps its unit and target on the map
  const shotFrom = shownUnit?.firingFrom ?? null;
  const shotTarget = shownShot?.targetPosition ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <Box className="game-screen" sx={{ width: "100%", maxWidth: 1400 }}>
        <Box component="main" className="game-screen__main">
          <div className="phase-layout">
            <Box className="phase-layout__board" sx={{ position: "relative" }}>
              <Board
                onTileClick={pick || fireTurn ? tapMap : noop}
                unitHexPosition={pick?.from ?? (shownShot ? shotFrom : (pickedSummary?.firingFrom ?? null))}
                possibleMovePositions={pick?.from ? [...pick.options] : []}
                markablePositions={pick && !pick.from ? pick.options : []}
                orderablePositions={fireTurn ? fireablePositions.filter((p) => !pickedSummary || !samePosition(p, pickedSummary.firingFrom)) : []}
                fireTargets={shownShot ? [] : aims.map((a) => ({ position: a.position, dice: a.dice }))}
                selectedTarget={shownShot ? shotTarget : (picked?.target ?? null)}
                markers={marks.positions}
                markerKind={marks.kind}
                cardBadges={cardBadges}
                camouflaged={boardGame.camouflaged}
                possibleMoveAndFirePositions={[]}
                boardManager={boardSession.board}
                orders={boardGame.orders}
                backgroundImage={boardSession.scenario.image}
                faction={boardSide}
                opponent={match.opponentOf(boardSide)}
                strength={boardGame.strength}
                firedUnits={
                  new Set(boardGame.orders.filter((_, i) => boardSession.orderSummaries()[i]?.shots.length).map((o) => o.unit))
                }
              />

              {/* The dice, thrown onto the map; what they do is in the side column */}
              {shownShot && shown && (
                <Box
                  data-testid="shot-dice"
                  role="group"
                  aria-label={t.dice}
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 6px 8px rgb(0 0 0 / 0.45))",
                  }}
                >
                  <DiceResult
                    roll={{ faces: [...shownShot.faces], id: shown.shot + 1 }}
                    faction={shown.side}
                    kept={shownShot.kept}
                    die={shownShot.target.die}
                    kinds={shownShot.kinds}
                    target={shownShot.target}
                    rolling
                    placed={placedDice(shownShot)}
                  />
                </Box>
              )}
            </Box>

            <div className="phase-layout__controls">
              <Typography variant="h6" component="h1" sx={{ textAlign: "center" }}>
                {t.title(battle.turn)}
              </Typography>
              <MedalTally />

              {/* The shot rolled: how its dice add up and what they do */}
              {shown && shownShot && shownUnit && shownSession && (
                <Stack spacing={1} data-testid="shot-roll">
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <FactionInsignia faction={shown.side} size={28} decorative />
                    <Typography variant="subtitle1" component="h2">
                      {t.rollTitle(labels.unitKind(shownUnit.unitType, shownUnit.elite))}
                    </Typography>
                  </Stack>
                  <ShotSteps
                    shot={shownShot}
                    unitType={shownUnit.unitType}
                    faction={shown.side}
                    targetHex={
                      shownShot.targetPosition && (
                        <HexThumbnail
                          board={shownSession.board}
                          position={shownShot.targetPosition}
                          image={shownSession.scenario.image}
                          faction={shown.side}
                          size={28}
                        />
                      )
                    }
                  />
                  <RollReading
                    faces={appliedFaces(shownShot.faces, shownShot.kept)}
                    target={shownShot.target}
                    withCoins
                    delay={rollDuration(shownShot.faces.length)}
                  />
                  {shownShot.kept && (
                    <Typography variant="body2" color="text.secondary">
                      {t.limited(
                        readRoll(appliedFaces(shownShot.faces, shownShot.kept), shownShot.target).hits,
                        readRoll(shownShot.faces, shownShot.target).hits
                      )}
                    </Typography>
                  )}
                  {shownShot.notes.map((note) => (
                    <Alert key={note.es} severity="info" sx={{ py: 0 }}>
                      {tr(note)}
                    </Alert>
                  ))}
                  <Button onClick={closeRoll} startIcon={<GameIcon name="confirm" />}>
                    {t.done}
                  </Button>
                </Stack>
              )}

              {/* An attack card goes before anyone fires */}
              {battle.attacks.filter((faction) => faction !== computer).map((faction) => (
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

              {retreat ? (
                <Stack spacing={1} data-testid="retreat">
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <FactionInsignia faction={retreat.side} size={28} decorative />
                    <Typography variant="subtitle1" component="h2">
                      {t.retreats[retreat.side]}
                    </Typography>
                  </Stack>
                  <Typography variant="body2">
                    {t.retreatText(retreatingUnit ? labels.units[retreatingUnit] : "", retreat.flags)}
                  </Typography>
                </Stack>
              ) : battle.ground && groundUnit && battle.ground.side !== computer ? (
                <Stack spacing={1} data-testid="take-ground">
                  <Typography variant="subtitle1" component="h2">
                    {t.groundTitle}
                  </Typography>
                  <Typography variant="body2">{(pushesBack ? t.pushText : t.groundText)(labels.units[groundUnit].toLowerCase())}</Typography>
                  <Button color="success" onClick={() => match.decideGround(true)}>
                    {t.takeGround}
                  </Button>
                  <Button variant="outlined" onClick={() => match.decideGround(false)}>
                    {t.stay}
                  </Button>
                </Stack>
              ) : fireTurn ? (
                <Stack spacing={1} data-testid="fire-turn">
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <FactionInsignia faction={fireTurn.side} size={28} decorative />
                    <Typography variant="subtitle1" component="h2">
                      {t.fires[fireTurn.side]}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t.groups[battle.group!]}
                  </Typography>
                  {picked && pickedSummary ? (
                    <FiringUnit
                      key={picked.order}
                      side={fireTurn.side}
                      session={fireTurn.session}
                      order={picked.order}
                      aims={aims}
                      aim={aim}
                      onFire={fire}
                      onHold={() => {
                        if (match.holdFire(picked.order)) setAiming(null);
                      }}
                      onFortify={() => {
                        if (match.fortify(picked.order)) setAiming(null);
                      }}
                      onRemoveWire={() => {
                        if (match.removeWire(picked.order)) setAiming(null);
                      }}
                    />
                  ) : (
                    <Typography variant="body2">{t.tapUnit}</Typography>
                  )}
                </Stack>
              ) : computerActs ? (
                !shownShot && (
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }} data-testid="computer-thinking">
                    {computer && <FactionInsignia faction={computer} size={28} decorative />}
                    <Typography variant="body2" color="text.secondary">
                      {t.thinking}
                    </Typography>
                  </Stack>
                )
              ) : (
                battle.attacks.length === 0 &&
                !shownShot && (
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
                    !!battle.ground || !!retreat || battle.attacks.length > 0
                  }
                  startIcon={<GameIcon name="endTurn" />}
                >
                  {t.end}
                </Button>
              </Box>
            </div>
          </div>
        </Box>

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
                    played={game.combatCardsPlayed}
                    assignments={game.assignments}
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
