import { useState } from "react";
import { Alert, Box, Button, FormControlLabel, Stack, Switch, ToggleButton, Typography } from "@mui/material";
import { DieFace } from "../game-core/dice";
import DieFaceIcon from "./DieFaceIcon";
import BoardManager from "../game-core/BoardManager";
import CommandCard from "../game-core/commandCard";
import { FireContext, calculateFireDice } from "../game-core/fireRules";
import { FireTarget, mapAnswers } from "../game-core/fireTargets";
import { samePosition } from "../game-core/position";
import { ADJACENT_ENEMY_ANSWER, FIRE_QUESTIONS, PINNED_ANSWER, PINNED_FIRE_DICE, TARGET_INFANTRY, TARGET_OTHER, fireBonusSteps } from "../data/fireQuestions";
import { TargetKinds } from "../data/hitRules";
import { Position } from "../types/scenario";
import { Faction } from "../types/faction";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import Board from "./Board";
import DicePool, { DICE_TEXT } from "./DicePool";
import HexThumbnail from "./HexThumbnail";
import InfoButton from "./InfoButton";
import SandbagsIcon from "./SandbagsIcon";
import CamouflageIcon from "./CamouflageIcon";
import TargetKindPicker, { TargetChoice, initialChoice } from "./TargetKindPicker";

const TEXT = defineMessages({
  es: {
    noTargets: "No hay ninguna casilla a la que disparar desde aquí: todas están fuera de alcance, tapadas o sin ningún dado.",
    notThatHex:
      "Esa casilla no: está fuera de alcance, tapada (bosque, pueblo, colina, seto o una unidad tuya) o no llega ningún dado.",
    tapTarget: "Toca la casilla del objetivo. El número son los dados que tirarías.",
    target: "Objetivo",
    targetPlace: (terrain: string, distance: number) =>
      `${terrain} · a ${distance} ${distance === 1 ? "casilla (asalto cercano)" : "casillas"}`,
    tapHex: "Toca una casilla en el mapa.",
    isInfantry: "¿Es infantería?",
    sandbags: "¿Sacos terreros?",
    camouflaged: "¿Camuflada?",
    pinned: "¿Tu unidad está inmovilizada? (recibió una bandera este turno)",
    adjacentEnemy: "¿Hay una unidad enemiga junto a la tuya? Solo puede disparar en asalto cercano",
    suppressive: "Fuego de supresión: una cara de infantería es bandera",
    concentrated: "Fuego concentrado: suma unidades que no se movieron",
    joinUnit: (unit: string, dice: number) => `${unit} · +${dice} ${dice === 1 ? "dado" : "dados"}`,
    knownInfantry: "Infantería",
    knownOther: "Blindados o artillería",
    knownSandbags: "con sacos terreros",
    whereDiceComeFrom: "De dónde salen los dados",
    total: (dice: string) => `Total: ${dice}`,
    fire: "Disparar",
  },
  en: {
    noTargets: "There's no hex to fire at from here: they're all out of range, blocked or without a single die.",
    notThatHex:
      "Not that hex: it's out of range, blocked (forest, town, hill, hedgerow or one of your units) or no die gets through.",
    tapTarget: "Tap the target's hex. The number is the dice you'd roll.",
    target: "Target",
    targetPlace: (terrain: string, distance: number) =>
      `${terrain} · ${distance} ${distance === 1 ? "hex away (close assault)" : "hexes away"}`,
    tapHex: "Tap a hex on the map.",
    isInfantry: "Is it infantry?",
    sandbags: "Sandbags?",
    camouflaged: "Camouflaged?",
    pinned: "Is your unit pinned? (it took a flag this turn)",
    adjacentEnemy: "Is an enemy unit next to yours? It can only fire in close assault",
    suppressive: "Suppressive Fire: an infantry side is a flag",
    concentrated: "Concentrated Fire: add units that didn't move",
    joinUnit: (unit: string, dice: number) => `${unit} · +${dice} ${dice === 1 ? "die" : "dice"}`,
    knownInfantry: "Infantry",
    knownOther: "Armor or artillery",
    knownSandbags: "behind sandbags",
    whereDiceComeFrom: "Where the dice come from",
    total: (dice: string) => `Total: ${dice}`,
    fire: "Fire",
  },
});

export interface FireAimChoice {
  position: Position;
  /** The target is infantry (otherwise armour or artillery) */
  infantry: boolean;
  sandbags: boolean;
  /** The target has the camouflage badge (only a close assault can hit it) */
  camouflaged?: boolean;
  /** Suppressive Fire: roll the die with a flag in place of one infantry side */
  suppressive?: boolean;
  /** Concentrated Fire: the other orders whose units roll with this one */
  joined?: readonly number[];
  /** The firing unit is pinned (own tablets: the player says) */
  pinned?: boolean;
  /** An enemy unit is next to the firing unit, which fires in close assault only (own tablets: the player says) */
  adjacentEnemy?: boolean;
}

/** Concentrated Fire: a unit that can roll with the one firing, where it stands and the dice it adds */
export interface JoinableUnit {
  order: number;
  dice: number;
  label: string;
  position: Position;
}

interface FireAimProps {
  board: BoardManager;
  /** The scenario's board art */
  image?: string;
  faction: Faction;
  /** Where the unit fires from */
  from: Position;
  /** Every hex in range, from the session */
  targets: readonly FireTarget[];
  context: FireContext;
  card: CommandCard | null;
  longRangeDie: boolean;
  /** What the enemy can have in the scenario */
  targetKinds: TargetKinds;
  /** Pass and play: what's on each target hex is known, so the unit type and sandbags aren't asked */
  knownTarget?: (position: Position) => { infantry: boolean; sandbags: boolean } | null;
  /** Suppressive Fire was played: a switch for this shot */
  suppressiveFire?: boolean;
  /** Concentrated Fire: the units that could roll with this one at the target as chosen so far */
  joinable?: (choice: FireAimChoice) => readonly JoinableUnit[];
  onFire: (choice: FireAimChoice) => void;
}

const formatDice = (dice: number) => (dice > 0 ? `+${dice}` : `${dice}`);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Aiming a shot on the map: the part of the board the unit can reach, with
 * the hexes it can fire at (in range, in sight, with dice) and their dice.
 * The player taps the target's hex, then says what unit is there and whether
 * it has sandbags; the dice are worked out as they go.
 */
function FireAim({
  board,
  image,
  faction,
  from,
  targets,
  context,
  longRangeDie,
  targetKinds,
  knownTarget,
  suppressiveFire = false,
  joinable,
  onFire,
}: FireAimProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const diceText = useMessages(DICE_TEXT).dice;
  const [picked, setPicked] = useState<Position | null>(null);
  const [chosenKind, setKind] = useState<TargetChoice | null>(initialChoice(targetKinds));
  const [chosenSandbags, setSandbags] = useState(false);
  const [camouflaged, setCamouflaged] = useState(false);
  const [suppressive, setSuppressive] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [adjacentEnemy, setAdjacentEnemy] = useState(false);
  const [chosenJoined, setJoined] = useState<readonly number[]>([]);
  const [missed, setMissed] = useState(false);

  const inReach = targets.filter((t) => t.lineOfSight && t.dice > 0);
  // With an enemy next to it, the unit fires in close assault only: on own tablets the player says, pass and play knows
  const asksAdjacent = !knownTarget && context.adjacentEnemy === undefined && inReach.some((t) => t.distance > 1);
  const closeOnly = asksAdjacent && adjacentEnemy;
  const firable = closeOnly ? inReach.filter((t) => t.distance === 1) : inReach;
  const target = picked ? (firable.find((t) => samePosition(t.position, picked)) ?? null) : null;
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";
  // Pass and play knows the target: nothing to ask
  const known = target && knownTarget ? knownTarget(target.position) : null;
  const kind: TargetChoice | null = known ? (known.infantry ? "infantry" : "other") : chosenKind;
  const sandbags = known ? known.sandbags : chosenSandbags;

  const answers: Record<string, string> = target
    ? {
        ...mapAnswers(target),
        targetType: kind === "other" ? TARGET_OTHER : TARGET_INFANTRY,
        sandbags: sandbags ? "yes" : "no",
        camouflage: camouflaged ? "yes" : "no",
        [PINNED_ANSWER]: pinned ? "yes" : "no",
        [ADJACENT_ENEMY_ANSWER]: closeOnly ? "yes" : "no",
      }
    : {};
  // A pinned unit (a flag this turn) may lose a die: on own tablets the player says, pass and play knows
  const asksPinned = context.pinned === undefined && PINNED_FIRE_DICE[context.unitType] !== 0;
  // The enemy may have the Camouflage card: a target at range may be out of reach
  const asksCamouflage = !knownTarget && !!context.enemyCamouflage && !!target && target.distance > 1;
  // Concentrated Fire: the units that can join this shot as it stands, and the ones joined that still can
  const choiceSoFar: FireAimChoice | null =
    target && kind
      ? {
          position: target.position,
          infantry: kind === "infantry",
          sandbags,
          camouflaged: asksCamouflage && camouflaged,
          suppressive,
          pinned: asksPinned && pinned,
          adjacentEnemy: closeOnly,
        }
      : null;
  const joinOptions = choiceSoFar && joinable ? joinable(choiceSoFar) : [];
  const joined = chosenJoined.filter((order) => joinOptions.some((option) => option.order === order));
  const joinedDice = joinOptions.filter((option) => joined.includes(option.order)).reduce((sum, option) => sum + option.dice, 0);
  const toggleJoined = (order: number) =>
    setJoined(joined.includes(order) ? joined.filter((o) => o !== order) : [...joined, order]);
  const result = target ? calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps) : null;
  const eightSided = longRangeDie && !!target && target.distance > 1;

  const tap = (position: Position) => {
    const hit = firable.some((t) => samePosition(t.position, position));
    setMissed(!hit && !samePosition(position, from));
    if (hit) setPicked(position);
  };

  const step = (n: number, title: string) => (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          bgcolor: "var(--m44-primary)",
          color: "var(--m44-on-primary)",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          flex: "none",
        }}
      >
        {n}
      </Box>
      {title && (
        <Typography variant="h6" component="h3" sx={{ fontSize: "1.05rem" }}>
          {title}
        </Typography>
      )}
    </Stack>
  );

  return (
    <Box className="fire-aim">
      <Stack className="fire-aim__map" sx={{ gap: 1 }}>
        <Box className="fire-aim__board" data-testid="fire-map">
          <Board
            onTileClick={tap}
            unitHexPosition={from}
            possibleMovePositions={[]}
            possibleMoveAndFirePositions={[]}
            boardManager={board}
            orders={[]}
            backgroundImage={image}
            fireTargets={firable}
            selectedTarget={target?.position ?? null}
            focus={[from, ...targets.map((t) => t.position)]}
            faction={faction}
          />
        </Box>
        <Typography variant="body2" color={missed ? "warning.main" : "text.secondary"} aria-live="polite">
          {firable.length === 0
            ? t.noTargets
            : missed
              ? t.notThatHex
              : t.tapTarget}
        </Typography>
      </Stack>

      <Stack className="fire-aim__questions" sx={{ gap: 2 }}>
        {asksAdjacent && (
          <FormControlLabel
            control={<Switch checked={adjacentEnemy} onChange={(e) => setAdjacentEnemy(e.target.checked)} />}
            label={t.adjacentEnemy}
            labelPlacement="start"
            sx={{ minHeight: 48, m: 0, justifyContent: "space-between", gap: 1 }}
            data-testid="adjacent-enemy"
          />
        )}
        <Stack sx={{ gap: 1 }}>
          {step(1, t.target)}
          {target ? (
            <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }} data-testid="fire-target">
              <HexThumbnail board={board} position={target.position} image={image} faction={faction} size={44} />
              <Typography variant="body1">
                {t.targetPlace(capitalize(labels.terrain[target.terrain]), target.distance)}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body1" color="text.secondary">
              {t.tapHex}
            </Typography>
          )}
        </Stack>

        {knownTarget ? (
          known && (
            <Typography variant="body1" data-testid="known-target">
              {known.infantry ? t.knownInfantry : t.knownOther}
              {known.sandbags && ` · ${t.knownSandbags}`}
            </Typography>
          )
        ) : (
          <Stack sx={{ gap: 1 }}>
            {step(2, t.isInfantry)}
            <TargetKindPicker kinds={targetKinds} value={kind} onChange={setKind} enemy={enemy} />
          </Stack>
        )}

        <Stack sx={{ gap: 0.5 }}>
          {/* One line: the sandbags and a switch */}
          {!knownTarget && (
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              {step(3, "")}
              <SandbagsIcon />
              <FormControlLabel
                control={<Switch checked={sandbags} onChange={(e) => setSandbags(e.target.checked)} />}
                label={t.sandbags}
                labelPlacement="start"
                sx={{ minHeight: 48, m: 0, flex: 1, justifyContent: "space-between" }}
              />
            </Stack>
          )}
          {asksCamouflage && (
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              {step(4, "")}
              <CamouflageIcon />
              <FormControlLabel
                control={<Switch checked={camouflaged} onChange={(e) => setCamouflaged(e.target.checked)} />}
                label={t.camouflaged}
                labelPlacement="start"
                sx={{ minHeight: 48, m: 0, flex: 1, justifyContent: "space-between" }}
              />
            </Stack>
          )}
        </Stack>

        {asksPinned && (
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "inline-flex", "& .die": { width: 28, height: 28 } }}>
              <DieFaceIcon face={DieFace.FLAG} faction={faction} />
            </Box>
            <FormControlLabel
              control={<Switch checked={pinned} onChange={(e) => setPinned(e.target.checked)} />}
              label={t.pinned}
              labelPlacement="start"
              sx={{ minHeight: 48, m: 0, flex: 1, justifyContent: "space-between" }}
            />
          </Stack>
        )}

        {suppressiveFire && (
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "inline-flex", "& .die": { width: 28, height: 28 } }}>
              <DieFaceIcon face={DieFace.FLAG} faction={faction} />
            </Box>
            <FormControlLabel
              control={<Switch checked={suppressive} onChange={(e) => setSuppressive(e.target.checked)} />}
              label={t.suppressive}
              labelPlacement="start"
              sx={{ minHeight: 48, m: 0, flex: 1, justifyContent: "space-between" }}
            />
          </Stack>
        )}

        {joinOptions.length > 0 && (
          <Stack sx={{ gap: 1 }} data-testid="concentrated-fire">
            <Typography variant="body2" color="text.secondary">
              {t.concentrated}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {joinOptions.map((option) => (
                <ToggleButton
                  key={option.order}
                  value={option.order}
                  selected={joined.includes(option.order)}
                  onChange={() => toggleJoined(option.order)}
                  sx={{ gap: 1, textTransform: "none", minHeight: 48 }}
                >
                  <HexThumbnail board={board} position={option.position} image={image} faction={faction} size={28} />
                  {t.joinUnit(option.label, option.dice)}
                </ToggleButton>
              ))}
            </Stack>
          </Stack>
        )}

        {result?.blocked && (
          <Alert severity="warning" data-testid="fire-blocked">
            {tr(result.blocked)}
          </Alert>
        )}
        {result && !result.blocked && (
          <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5 }}>
            <DicePool dice={result.dice + joinedDice} eightSided={eightSided} faction={faction}>
              <InfoButton title={t.whereDiceComeFrom}>
                <Stack sx={{ gap: 0.5 }} data-testid="fire-breakdown">
                  {result.steps.map((s) => (
                    <Stack key={s.label.es} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                      <Typography variant="body1">{tr(s.label)}</Typography>
                      <Typography variant="body1">{formatDice(s.dice)}</Typography>
                    </Stack>
                  ))}
                  {joinOptions
                    .filter((option) => joined.includes(option.order))
                    .map((option) => (
                      <Stack key={option.order} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                        <Typography variant="body1">{option.label}</Typography>
                        <Typography variant="body1">{formatDice(option.dice)}</Typography>
                      </Stack>
                    ))}
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {t.total(diceText(result.dice + joinedDice, eightSided))}
                  </Typography>
                </Stack>
              </InfoButton>
            </DicePool>
          </Box>
        )}

        <Button
          size="large"
          fullWidth
          disabled={!target || !kind || !!result?.blocked}
          onClick={() =>
            target &&
            kind &&
            onFire({ ...choiceSoFar!, joined })
          }
        >
          {t.fire}
        </Button>
      </Stack>
    </Box>
  );
}

export default FireAim;
