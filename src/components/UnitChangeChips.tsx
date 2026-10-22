import { Box, Typography } from "@mui/material";
import type { UnitChange } from "../game-core/gameSession";
import { defineMessages, useMessages } from "../i18n/useI18n";
import GameIcon, { GameIconName } from "./GameIcon";

const TEXT = defineMessages({
  es: {
    morale: (n: string) => `Moral ${n} este turno`,
    ammo: (n: string) => `Munición ${n} este turno`,
    luck: (n: string) => `Suerte ${n} este turno`,
  },
  en: {
    morale: (n: string) => `Morale ${n} this turn`,
    ammo: (n: string) => `Ammo ${n} this turn`,
    luck: (n: string) => `Luck ${n} this turn`,
  },
});

/** A change signed, luck to one decimal */
export const signedChange = (value: number, decimals = 0): string => {
  const text = Math.abs(value).toFixed(decimals);
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
};

/**
 * What a unit of this side lost or gained this turn, in a row of a list: morale lost to flags,
 * ammo or shells spent, luck moved, each with its icon. Nothing when nothing changed
 */
function UnitChangeChips({ change }: { change: UnitChange | undefined }) {
  const t = useMessages(TEXT);
  if (!change) return null;
  const parts: { icon: GameIconName; text: string; label: string }[] = [];
  if (change.morale !== 0) parts.push({ icon: "morale", text: signedChange(change.morale), label: t.morale(signedChange(change.morale)) });
  if (change.ammo !== 0) parts.push({ icon: "ammo", text: signedChange(change.ammo), label: t.ammo(signedChange(change.ammo)) });
  if (Math.abs(change.luck) >= 0.05) {
    parts.push({ icon: "luck", text: signedChange(change.luck, 1), label: t.luck(signedChange(change.luck, 1)) });
  }
  if (parts.length === 0) return null;
  return (
    <Box component="span" data-testid="unit-changes" sx={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
      {parts.map((part) => (
        <Box key={part.icon} component="span" role="img" aria-label={part.label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
          <GameIcon name={part.icon} size={14} />
          <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
            {part.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default UnitChangeChips;
