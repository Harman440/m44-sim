import { useState } from "react";
import { Alert, Button, Stack } from "@mui/material";
import { ShotRoll } from "../game-core/gameSession";
import { appliedFaces } from "../game-core/rollResult";
import { Faction } from "../types/faction";
import DiceResult, { rollDuration } from "./DiceResult";
import RollReading from "./RollReading";

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
 * A shot's dice and what they mean on the table. The player can apply fewer
 * results than were rolled (a unit with few figures keeps at most as many
 * results as it has): they tap the dice to apply, and the rest stay on show,
 * greyed out as discarded.
 */
function ShotDice({ shot, rollId, faction, rolling = false, onKeepResults }: ShotDiceProps) {
  /** The dice picked so far while choosing; null when not choosing */
  const [picked, setPicked] = useState<number[] | null>(null);
  if (shot.dice === 0) return null;

  const allDice = shot.faces.map((_, i) => i);
  const toggle = (index: number) =>
    setPicked((prev) => (prev?.includes(index) ? prev.filter((i) => i !== index) : [...(prev ?? []), index]));
  const apply = () => {
    if (picked && onKeepResults?.(picked)) setPicked(null);
  };
  const faces = picked ? appliedFaces(shot.faces, picked) : appliedFaces(shot.faces, shot.kept);

  return (
    <>
      {picked && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Toca los dados cuyo resultado aplicas. Los demás se descartan.
        </Alert>
      )}
      {/* The dice, with changing which results apply on their right */}
      <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", columnGap: 3 }}>
        <DiceResult
          roll={{ faces: [...shot.faces], id: rollId }}
          faction={faction}
          kept={shot.kept}
          die={shot.target.die}
          picking={picked ? { selected: picked, onToggle: toggle } : undefined}
          target={shot.target}
          rolling={rolling}
        />
        {onKeepResults && (
          <Stack sx={{ alignItems: "flex-start", gap: 0.5, mt: 1.5 }}>
            {picked ? (
              <>
                <Button onClick={apply}>
                  Aplicar {picked.length} de {shot.faces.length}
                </Button>
                <Button variant="outlined" onClick={() => setPicked(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button variant="text" size="small" onClick={() => setPicked(shot.kept ? [...shot.kept] : allDice)}>
                  {shot.kept ? "Cambiar resultados aplicados" : "Aplicar menos resultados"}
                </Button>
                {shot.kept && (
                  <Button variant="text" size="small" onClick={() => onKeepResults(null)}>
                    Aplicar todos
                  </Button>
                )}
              </>
            )}
          </Stack>
        )}
      </Stack>
      <RollReading
        faces={faces}
        target={shot.target}
        withCoins
        delay={rolling ? rollDuration(shot.faces.length) : 0}
      />
    </>
  );
}

export default ShotDice;
