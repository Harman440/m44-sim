import { ReactNode, useEffect, useRef } from "react";
import { Box, List, ListItemButton, Stack, Typography } from "@mui/material";
import type GameSession from "../../../game-core/gameSession";
import type { GameSnapshot } from "../../../game-core/gameSession";
import { samePosition } from "../../../game-core/position";
import type { UnitSupplies } from "../../../game-core/unitSupplies";
import { actionById } from "../../../data/unitActions";
import { EQUIPMENT, SUPPLIES } from "../../../data/unitSupplies";
import { Faction } from "../../../types/faction";
import { Position } from "../../../types/scenario";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import GameIcon from "../../GameIcon";
import HexThumbnail from "../../HexThumbnail";
import { EquipmentIcon, SUPPLY_ICONS } from "../../SupplyIcons";
import { unitSprite } from "../../UnitComponent";

const TEXT = defineMessages({
  es: {
    units: "Tus unidades",
    rests: "Descansa",
    luck: (value: string) => `Suerte ${value}`,
    amount: (name: string, n: number) => `${name}: ${n}`,
  },
  en: {
    units: "Your units",
    rests: "Rests",
    luck: (value: string) => `Luck ${value}`,
    amount: (name: string, n: number) => `${name}: ${n}`,
  },
});

/** Luck as the list shows it: rounded, with its sign */
const luckText = (luck: number): string => {
  const rounded = Math.round(luck);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${-rounded}` : "0";
};

/** One supply or piece of equipment: its icon and how many, red when there's none left */
function Meter({ icon, amount, label }: { icon: ReactNode; amount: number; label: string }) {
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: amount === 0 ? "error.main" : "text.secondary" }}
    >
      {icon}
      <Typography component="span" variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
        {amount}
      </Typography>
    </Box>
  );
}

function SupplyMeters({ supplies, luck }: { supplies: UnitSupplies; luck: number | null }) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", columnGap: 1, rowGap: 0.25 }} data-testid="unit-meters">
      {SUPPLIES.filter((supply) => supplies.amounts[supply] !== undefined).map((supply) => (
        <Meter
          key={supply}
          icon={<GameIcon name={SUPPLY_ICONS[supply]} size={16} />}
          amount={supplies.amounts[supply]!}
          label={t.amount(labels.supplies[supply], supplies.amounts[supply]!)}
        />
      ))}
      {EQUIPMENT.filter((kind) => supplies.equipment[kind] !== undefined).map((kind) => (
        <Meter
          key={kind}
          icon={<EquipmentIcon kind={kind} size={16} />}
          amount={supplies.equipment[kind]!}
          label={t.amount(labels.equipment[kind], supplies.equipment[kind]!)}
        />
      ))}
      {luck !== null && (
        <Box component="span" role="img" aria-label={t.luck(luckText(luck))} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: "text.secondary" }}>
          <GameIcon name="luck" size={16} />
          <Typography component="span" variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
            {luckText(luck)}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

interface UnitListProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** The unit picked, on the map or here */
  selected: Position | null;
  /** A row tapped: the unit on that hex */
  onSelect: (position: Position) => void;
}

/**
 * This side's units while giving orders, beside the map (below it in portrait): each one's hex,
 * its supplies and luck, and the action it has or "Descansa". Tapping a row picks the unit, as
 * tapping it on the map does. Never the enemy's: their supplies and luck aren't shown
 */
function UnitList({ faction, session, game, selected, onSelect }: UnitListProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  // A unit picked on the map: its row comes into sight when the column scrolls on its own
  // (landscape). In portrait the list is under the map, and the page stays put
  const selectedRow = useRef<HTMLDivElement>(null);
  const selectedKey = selected && `${selected.row}-${selected.col}`;
  useEffect(() => {
    const row = selectedRow.current;
    const column = row?.closest<HTMLElement>(".phase-layout__controls");
    if (!row || !column || column.scrollHeight <= column.clientHeight) return;
    const [rowBox, columnBox] = [row.getBoundingClientRect(), column.getBoundingClientRect()];
    if (rowBox.bottom > columnBox.bottom) column.scrollTop += rowBox.bottom - columnBox.bottom;
    else if (rowBox.top < columnBox.top) column.scrollTop -= columnBox.top - rowBox.top;
  }, [selectedKey]);
  // Left to right across the board, then front to back, as the player reads the map
  const units = [...game.supplies].sort((a, b) => a.position.col - b.position.col || a.position.row - b.position.row);

  return (
    <List dense aria-label={t.units} data-testid="unit-list" sx={{ width: "100%", py: 0 }}>
      {units.map(({ position, supplies }) => {
        const hex = session.board.getHex(position);
        const unit = hex?.unit;
        if (!unit) return null;
        const order = game.orders.find((each) => samePosition(each.end, position));
        const action = order && actionById(order.action);
        const isSelected = !!selected && samePosition(selected, position);
        return (
          <ListItemButton
            key={`${position.row}-${position.col}`}
            ref={isSelected ? selectedRow : undefined}
            selected={isSelected}
            onClick={() => onSelect(position)}
            data-testid="unit-row"
            sx={{ minHeight: 48, borderRadius: 1, px: 1, gap: 1, alignItems: "flex-start" }}
          >
            <Box
              component="img"
              src={unitSprite(faction, unit.getUnitType())}
              alt={labels.unit(unit)}
              sx={{ width: 28, height: 28, flex: "none", mt: 0.25 }}
            />
            <HexThumbnail
              board={session.board}
              position={position}
              image={session.scenario.image}
              faction={faction}
              size={28}
              label={labels.describePlace(hex)}
            />
            <Stack sx={{ minWidth: 0, flex: 1, gap: 0.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: action ? "primary.main" : "text.secondary" }} noWrap>
                {action ? tr(action.name) : t.rests}
              </Typography>
              <SupplyMeters supplies={supplies} luck={session.luckAt(position)} />
            </Stack>
          </ListItemButton>
        );
      })}
    </List>
  );
}

export default UnitList;
