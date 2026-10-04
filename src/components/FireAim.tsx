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
import { TERRAIN_LABELS } from "../labels";
import Board from "./Board";
import HexThumbnail from "./HexThumbnail";
import SandbagsIcon from "./SandbagsIcon";
import TargetKindPicker, { TargetChoice, initialChoice } from "./TargetKindPicker";

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
const diceText = (dice: number, eightSided = false) =>
  `${dice} ${dice === 1 ? "dado" : "dados"}${eightSided ? " de 8 caras" : ""}`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Aiming a shot on the map: the part of the board the unit can reach, with
 * the hexes it can fire at (in range, in sight, with dice) and their dice.
 * The player taps the target's hex, then says what unit is there and whether
 * it has sandbags; the dice are worked out as they go.
 */
function FireAim({ board, image, faction, from, targets, context, longRangeDie, targetKinds, onFire }: FireAimProps) {
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
            ? "No hay ninguna casilla a la que disparar desde aquí: todas están fuera de alcance, tapadas o sin ningún dado."
            : missed
              ? "Esa casilla no: está fuera de alcance, tapada (bosque, pueblo, colina, seto o una unidad tuya) o no llega ningún dado."
              : "Toca la casilla del objetivo. El número son los dados que tirarías."}
        </Typography>
      </Stack>

      <Stack className="fire-aim__questions" sx={{ gap: 2 }}>
        <Stack sx={{ gap: 1 }}>
          {step(1, "Objetivo")}
          {target ? (
            <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }} data-testid="fire-target">
              <HexThumbnail board={board} position={target.position} image={image} faction={faction} size={44} />
              <Typography variant="body1">
                {capitalize(TERRAIN_LABELS[target.terrain])} · a {target.distance}{" "}
                {target.distance === 1 ? "casilla (asalto cercano)" : "casillas"}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body1" color="text.secondary">
              Toca una casilla en el mapa.
            </Typography>
          )}
        </Stack>

        <Stack sx={{ gap: 1 }}>
          {step(2, "¿Es infantería?")}
          <TargetKindPicker kinds={targetKinds} value={kind} onChange={setKind} enemy={enemy} />
        </Stack>

        <Stack sx={{ gap: 0.5 }}>
          {/* One line: the sandbags and a switch */}
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            {step(3, "")}
            <SandbagsIcon />
            <FormControlLabel
              control={<Switch checked={sandbags} onChange={(e) => setSandbags(e.target.checked)} />}
              label="¿Sacos terreros?"
              labelPlacement="start"
              sx={{ minHeight: 48, m: 0, flex: 1, justifyContent: "space-between" }}
            />
          </Stack>
          {asksBonus && (
            <FormControlLabel
              control={<Switch checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />}
              label={`${combatBonusQuestion.textFor!(context)} (+${context.combatBonus!.dice})`}
              sx={{ minHeight: 48 }}
            />
          )}
        </Stack>

        {result && (
          <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5 }}>
            <Stack sx={{ gap: 0.25 }} data-testid="fire-breakdown">
              {result.steps.map((s) => (
                <Stack key={s.label} direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2">{s.label}</Typography>
                  <Typography variant="body2">{formatDice(s.dice)}</Typography>
                </Stack>
              ))}
            </Stack>
            <Typography variant="h6" data-testid="fire-total" sx={{ mt: 1 }}>
              Total: {diceText(result.dice, eightSided)}
            </Typography>
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
          {result && kind ? `Disparar ${diceText(result.dice, eightSided)}` : "Disparar"}
        </Button>
      </Stack>
    </Box>
  );
}

export default FireAim;
