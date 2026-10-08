import { useState } from "react";
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import BoardManager from "../game-core/BoardManager";
import CommandCard from "../game-core/commandCard";
import { FireContext, calculateFireDice } from "../game-core/fireRules";
import { FireTarget, mapAnswers } from "../game-core/fireTargets";
import { samePosition } from "../game-core/position";
import { FIRE_QUESTIONS, TARGET_INFANTRY, TARGET_OTHER, combatBonusQuestion, fireBonusSteps } from "../data/fireQuestions";
import { TargetKinds } from "../data/hitRules";
import { Position } from "../types/scenario";
import { Faction } from "../types/faction";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import Board from "./Board";
import DicePool, { DICE_TEXT } from "./DicePool";
import HexThumbnail from "./HexThumbnail";
import InfoButton from "./InfoButton";
import SandbagsIcon from "./SandbagsIcon";
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
  useCombatBonus: boolean;
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
function FireAim({ board, image, faction, from, targets, context, longRangeDie, targetKinds, onFire }: FireAimProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const diceText = useMessages(DICE_TEXT).dice;
  const [picked, setPicked] = useState<Position | null>(null);
  const [kind, setKind] = useState<TargetChoice | null>(initialChoice(targetKinds));
  const [sandbags, setSandbags] = useState(false);
  const [useBonus, setUseBonus] = useState(true);
  const [missed, setMissed] = useState(false);

  const firable = targets.filter((t) => t.lineOfSight && t.dice > 0);
  const target = picked ? (firable.find((t) => samePosition(t.position, picked)) ?? null) : null;
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";

  const answers: Record<string, string> = target
    ? { ...mapAnswers(target), targetType: kind === "other" ? TARGET_OTHER : TARGET_INFANTRY, sandbags: sandbags ? "yes" : "no" }
    : {};
  const asksBonus = !!target && (combatBonusQuestion.appliesTo?.(context, answers) ?? false);
  if (asksBonus) answers.combatCard = useBonus ? "yes" : "no";
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

        <Stack sx={{ gap: 1 }}>
          {step(2, t.isInfantry)}
          <TargetKindPicker kinds={targetKinds} value={kind} onChange={setKind} enemy={enemy} />
        </Stack>

        <Stack sx={{ gap: 0.5 }}>
          {/* One line: the sandbags and a switch */}
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
          {asksBonus && (
            <FormControlLabel
              control={<Switch checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />}
              label={`${tr(combatBonusQuestion.textFor!(context))} (+${context.combatBonus!.dice})`}
              sx={{ minHeight: 48 }}
            />
          )}
        </Stack>

        {result && (
          <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5 }}>
            <DicePool dice={result.dice} eightSided={eightSided} faction={faction}>
              <InfoButton title={t.whereDiceComeFrom}>
                <Stack sx={{ gap: 0.5 }} data-testid="fire-breakdown">
                  {result.steps.map((s) => (
                    <Stack key={s.label.es} direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                      <Typography variant="body1">{tr(s.label)}</Typography>
                      <Typography variant="body1">{formatDice(s.dice)}</Typography>
                    </Stack>
                  ))}
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {t.total(diceText(result.dice, eightSided))}
                  </Typography>
                </Stack>
              </InfoButton>
            </DicePool>
          </Box>
        )}

        <Button
          size="large"
          fullWidth
          disabled={!target || !kind}
          onClick={() =>
            target && kind && onFire({ position: target.position, infantry: kind === "infantry", sandbags, useCombatBonus: asksBonus && useBonus })
          }
        >
          {t.fire}
        </Button>
      </Stack>
    </Box>
  );
}

export default FireAim;
