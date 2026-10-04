import { useState } from "react";
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { UnitType } from "../game-core/unit";
import { TargetKinds, onlyTargetKind } from "../data/hitRules";
import { Faction } from "../types/faction";
import { targetLabel } from "../labels";
import { unitSprite } from "./UnitComponent";

/** A choice in the picker: infantry, any other unit, or (when offered) an empty hex */
export type TargetChoice = "infantry" | "other" | "empty";

export const choiceFor = (infantry: boolean): TargetChoice => (infantry ? "infantry" : "other");

/** The picker's starting choice: the only kind the enemy can have, when there's no empty option */
export const initialChoice = (kinds: TargetKinds, emptyLabel?: string): TargetChoice | null => {
  const only = onlyTargetKind(kinds);
  return only === null || emptyLabel ? null : choiceFor(only);
};

const SPRITES: Record<"infantry" | "other", UnitType[]> = {
  infantry: [UnitType.INFANTRY],
  other: [UnitType.TANK, UnitType.ARTILLERY],
};

/** The enemy's unit art for a kind of target: infantry, or armour and artillery */
export function TargetSprites({ infantry, enemy, size = 26 }: { infantry: boolean; enemy: Faction; size?: number }) {
  return (
    <Stack direction="row" aria-hidden>
      {SPRITES[infantry ? "infantry" : "other"].map((type) => (
        <Box key={type} component="img" src={unitSprite(enemy, type)} alt="" sx={{ width: size, height: size }} />
      ))}
    </Stack>
  );
}

interface TargetKindPickerProps {
  /** What the enemy starts the scenario with */
  kinds: TargetKinds;
  value: TargetChoice | null;
  onChange: (choice: TargetChoice) => void;
  /** The enemy, for the unit art */
  enemy: Faction;
  /** Also offer an empty hex, with this label (then both kinds are always offered) */
  emptyLabel?: string;
}

/**
 * Whether the enemy unit is infantry or not: that's all the dice need (the
 * tank face hits armour and artillery). When the enemy started with only one
 * kind, there's nothing to ask and it just says which, with "Cambiar" for a
 * unit of the other kind brought by the Reinforcements card.
 */
function TargetKindPicker({ kinds, value, onChange, enemy, emptyLabel }: TargetKindPickerProps) {
  const [askBoth, setAskBoth] = useState(false);
  const only = askBoth || emptyLabel ? null : onlyTargetKind(kinds);

  if (only !== null) {
    return (
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, minHeight: 48 }} data-testid="target-kind-fixed">
        <TargetSprites infantry={only} enemy={enemy} />
        <Typography variant="body2" sx={{ flex: 1 }}>
          {targetLabel(only)}: el rival no empezó con {only ? "blindados ni artillería" : "infantería"}.
        </Typography>
        <Button variant="text" size="small" onClick={() => setAskBoth(true)}>
          Cambiar
        </Button>
      </Stack>
    );
  }

  const options = ["infantry", "other"] as const;

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, choice: TargetChoice | null) => choice && onChange(choice)}
      aria-label="Tipo de objetivo"
      sx={{ display: "grid", gridTemplateColumns: `repeat(${options.length + (emptyLabel ? 1 : 0)}, 1fr)` }}
    >
      {options.map((choice) => (
        <ToggleButton key={choice} value={choice} sx={{ gap: 0.75, px: 1, minHeight: 48 }}>
          <TargetSprites infantry={choice === "infantry"} enemy={enemy} />
          <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
            {targetLabel(choice === "infantry")}
          </Typography>
        </ToggleButton>
      ))}
      {emptyLabel && (
        <ToggleButton value="empty" sx={{ minHeight: 48 }}>
          <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
            {emptyLabel}
          </Typography>
        </ToggleButton>
      )}
    </ToggleButtonGroup>
  );
}

export default TargetKindPicker;
