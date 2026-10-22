import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { ShotRoll } from "../game-core/gameSession";
import { appliedFaces, keptForFigures, limitingFigures } from "../game-core/rollResult";
import { placedDice } from "../game-core/fireRules";
import { Faction } from "../types/faction";
import DiceResult, { rollDuration } from "./DiceResult";
import RollReading from "./RollReading";
import { defineMessages, useMessages } from "../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    figuresQuestion: "¿Cuántas figuras disparan?",
    figuresHint: (bonus: boolean) =>
      `No se aplican más impactos que figuras${bonus ? " (uno más por la carta)" : ""}: la app descarta los de más, guardando antes las granadas. Las banderas y los suministros cuentan siempre.`,
    figures: (n: number) => (n === 1 ? "1 figura" : `${n} figuras`),
    cancel: "Cancelar",
    changeFigures: (n: number) => `${n === 1 ? "1 figura" : `${n} figuras`} · Cambiar`,
    applyFewer: "Aplicar menos impactos",
    applyAll: "Aplicar todos",
  },
  en: {
    figuresQuestion: "How many figures are firing?",
    figuresHint: (bonus: boolean) =>
      `No more hits apply than there are figures${bonus ? " (one more for the card)" : ""}: the app drops the extra ones, keeping grenades first. Flags and supplies always count.`,
    figures: (n: number) => (n === 1 ? "1 figure" : `${n} figures`),
    cancel: "Cancel",
    changeFigures: (n: number) => `${n === 1 ? "1 figure" : `${n} figures`} · Change`,
    applyFewer: "Apply fewer hits",
    applyAll: "Apply all",
  },
});

interface ShotDiceProps {
  shot: ShotRoll;
  /** Changes on every roll so the dice animate again */
  rollId: number;
  faction: Faction;
  /** The dice were just rolled: throw them in, then show what they mean */
  rolling?: boolean;
  /** Apply only these dice (indexes into the faces), or all of them with null; left out, the results can't be changed */
  onKeepResults?: (kept: number[] | null) => boolean;
}

/**
 * A shot's dice and what they mean on the table. A unit with few figures deals at most as many
 * hits as it has (limited damage): the player says how many figures fired and the app leaves out
 * the extra hits, which stay on show greyed out as discarded. Flags and supplies always count
 */
function ShotDice({ shot, rollId, faction, rolling = false, onKeepResults }: ShotDiceProps) {
  const t = useMessages(TEXT);
  /** Asking how many figures fired */
  const [asking, setAsking] = useState(false);
  if (shot.dice === 0) return null;

  const options = limitingFigures(shot);
  const sameKept = (a: readonly number[] | null, b: readonly number[] | null) =>
    a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));
  /** The figures the results applied now were worked out from */
  const figures = shot.kept ? options.find((n) => sameKept(keptForFigures(shot, n), shot.kept)) : undefined;
  const pick = (n: number) => {
    if (onKeepResults?.(keptForFigures(shot, n))) setAsking(false);
  };

  return (
    <>
      {/* The dice, with changing which results apply on their right */}
      <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", columnGap: 3 }}>
        <DiceResult
          roll={{ faces: [...shot.faces], id: rollId }}
          faction={faction}
          kept={shot.kept}
          die={shot.target.die}
          target={shot.target}
          rolling={rolling}
          placed={placedDice(shot)}
        />
        {onKeepResults && !asking && (options.length > 0 || shot.kept) && (
          <Stack sx={{ alignItems: "flex-start", gap: 0.5, mt: 1.5 }}>
            {options.length > 0 && (
              <Button variant="text" size="small" onClick={() => setAsking(true)}>
                {figures !== undefined ? t.changeFigures(figures) : t.applyFewer}
              </Button>
            )}
            {shot.kept && (
              <Button variant="text" size="small" onClick={() => onKeepResults(null)}>
                {t.applyAll}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
      {onKeepResults && asking && (
        <Alert severity="info" icon={false} sx={{ mt: 2 }} data-testid="figures-question">
          <Typography variant="subtitle2">{t.figuresQuestion}</Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t.figuresHint(shot.combatBonus)}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            {options.map((n) => (
              <Button key={n} variant={n === figures ? "contained" : "outlined"} onClick={() => pick(n)}>
                {t.figures(n)}
              </Button>
            ))}
            <Button variant="text" onClick={() => setAsking(false)}>
              {t.cancel}
            </Button>
          </Stack>
        </Alert>
      )}
      <RollReading
        faces={appliedFaces(shot.faces, shot.kept)}
        target={shot.target}
        withCoins
        delay={rolling ? rollDuration(shot.faces.length) : 0}
      />
    </>
  );
}

export default ShotDice;
