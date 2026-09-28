import { useState } from "react";
import { Box, Button, FormControlLabel, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import BoardManager from "../game-core/BoardManager";
import CommandCard from "../game-core/commandCard";
import { FireContext, calculateFireDice } from "../game-core/fireRules";
import { FireTarget, mapAnswers } from "../game-core/fireTargets";
import { UnitType } from "../game-core/unit";
import { samePosition } from "../game-core/position";
import { FIRE_QUESTIONS, combatBonusQuestion, fireBonusSteps } from "../data/fireQuestions";
import { Position } from "../types/scenario";
import { Faction } from "../types/faction";
import { TERRAIN_LABELS, UNIT_LABELS } from "../labels";
import Board from "./Board";
import HexThumbnail from "./HexThumbnail";
import { unitSprite } from "./UnitComponent";

export interface FireAimChoice {
  position: Position;
  unitType: UnitType;
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
  onFire: (choice: FireAimChoice) => void;
  /** Switch to a quick roll */
  onQuick: () => void;
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
function FireAim({ board, image, faction, from, targets, context, longRangeDie, onFire, onQuick }: FireAimProps) {
  const [picked, setPicked] = useState<Position | null>(null);
  const [unitType, setUnitType] = useState<UnitType | null>(null);
  const [sandbags, setSandbags] = useState(false);
  const [useBonus, setUseBonus] = useState(true);
  const [missed, setMissed] = useState(false);

  const firable = targets.filter((t) => t.lineOfSight && t.dice > 0);
  const target = picked ? (firable.find((t) => samePosition(t.position, picked)) ?? null) : null;
  const enemy: Faction = faction === "Allies" ? "Axis" : "Allies";

  const answers: Record<string, string> = target
    ? { ...mapAnswers(target), targetType: unitType ?? UnitType.INFANTRY, sandbags: sandbags ? "yes" : "no" }
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
      <Typography variant="h6" component="h3" sx={{ fontSize: "1.05rem" }}>
        {title}
      </Typography>
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
            ? "No hay ninguna casilla a la que disparar desde aquí: fuera de alcance, sin dados o tapada. Si en la mesa sí la hay, usa la tirada rápida."
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
          {step(2, "¿Qué unidad es?")}
          <ToggleButtonGroup
            exclusive
            value={unitType}
            onChange={(_, value: UnitType | null) => value && setUnitType(value)}
            aria-label="Tipo de objetivo"
            sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {Object.values(UnitType).map((type) => (
              <ToggleButton key={type} value={type} aria-label={UNIT_LABELS[type]} sx={{ flexDirection: "column", gap: 0.5, py: 1 }}>
                <Box component="img" src={unitSprite(enemy, type)} alt="" sx={{ width: 44, height: 44 }} />
                <Typography component="span" variant="body2">
                  {UNIT_LABELS[type]}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Stack sx={{ gap: 0.5 }}>
          {step(3, "Protección")}
          <FormControlLabel
            control={<Switch checked={sandbags} onChange={(e) => setSandbags(e.target.checked)} />}
            label="Sacos terreros (ignora 1 bandera)"
            sx={{ minHeight: 48 }}
          />
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
          disabled={!target || !unitType}
          onClick={() => target && unitType && onFire({ position: target.position, unitType, sandbags, useCombatBonus: asksBonus && useBonus })}
        >
          {result && unitType ? `Disparar ${diceText(result.dice, eightSided)}` : "Disparar"}
        </Button>
        <Typography variant="body2" color="warning.main">
          No se puede repetir la tirada.
        </Typography>
        <Button variant="text" onClick={onQuick}>
          ¿Ya sabes cuántos dados? Tirada rápida
        </Button>
      </Stack>
    </Box>
  );
}

export default FireAim;
