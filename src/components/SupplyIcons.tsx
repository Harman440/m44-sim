import { Box, Typography } from "@mui/material";
import type { SupplyCost } from "../game-core/unitSupplies";
import { Equipment, SUPPLIES, Supply } from "../data/unitSupplies";
import { useLabels } from "../i18n/useI18n";
import GameIcon, { GameIconName } from "./GameIcon";
import SandbagsIcon from "./SandbagsIcon";

export const SUPPLY_ICONS: Record<Supply, GameIconName> = {
  [Supply.MORALE]: "morale",
  [Supply.ENERGY]: "energy",
  [Supply.AMMO]: "ammo",
  [Supply.FUEL]: "fuel",
  [Supply.SHELLS]: "shells",
};

const EQUIPMENT_ICONS: Record<Exclude<Equipment, Equipment.SANDBAGS>, GameIconName> = {
  [Equipment.EXPLOSIVES]: "explosives",
  [Equipment.MEDIC_KIT]: "medicKit",
  [Equipment.CAMOUFLAGE_NET]: "camouflageNet",
};

/** A piece of equipment's icon (sandbags have their own drawing) */
export function EquipmentIcon({ kind, size }: { kind: Equipment; size: number }) {
  return kind === Equipment.SANDBAGS ? <SandbagsIcon size={size} /> : <GameIcon name={EQUIPMENT_ICONS[kind]} size={size} />;
}

/**
 * A cost as icons: each supply's icon with how much, and each piece of equipment's icon; "gratis"
 * for nothing. Read out whole ("2 energía + sacos terreros") by its label
 */
export function CostIcons({ cost, size = 18 }: { cost: SupplyCost; size?: number }) {
  const labels = useLabels();
  const amounts = SUPPLIES.flatMap((supply) => (cost.amounts?.[supply] ? [[supply, cost.amounts[supply]] as const] : []));
  const equipment = cost.equipment ?? [];
  const text = labels.describeCost(cost);
  return (
    <Box
      component="span"
      role="img"
      aria-label={text}
      data-testid="cost-icons"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.secondary", whiteSpace: "nowrap" }}
    >
      {amounts.length === 0 && equipment.length === 0 ? (
        <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
          {text}
        </Typography>
      ) : (
        <>
          {amounts.map(([supply, amount]) => (
            <Box key={supply} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.125 }}>
              <GameIcon name={SUPPLY_ICONS[supply]} size={size} />
              <Typography component="span" variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
                {amount}
              </Typography>
            </Box>
          ))}
          {equipment.map((kind, i) => (
            <EquipmentIcon key={`${kind}-${i}`} kind={kind} size={size} />
          ))}
        </>
      )}
    </Box>
  );
}
