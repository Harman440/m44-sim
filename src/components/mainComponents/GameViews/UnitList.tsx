import { ReactNode, useEffect, useRef } from "react";
import { Box, List, ListItem, ListItemButton, Stack, Typography } from "@mui/material";
import type GameSession from "../../../game-core/gameSession";
import type { GameSnapshot } from "../../../game-core/gameSession";
import { samePosition } from "../../../game-core/position";
import { fullSupplies, type UnitSupplies } from "../../../game-core/unitSupplies";
import type Unit from "../../../game-core/unit";
import { FIGURES } from "../../../data/figures";
import { actionById } from "../../../data/unitActions";
import { EQUIPMENT, SUPPLIES } from "../../../data/unitSupplies";
import { Faction } from "../../../types/faction";
import { Position } from "../../../types/scenario";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import GameIcon from "../../GameIcon";
import HexThumbnail from "../../HexThumbnail";
import { EquipmentIcon, SUPPLY_ICONS } from "../../SupplyIcons";
import StatBar from "../../StatBar";
import { unitSprite } from "../../UnitComponent";

const TEXT = defineMessages({
  es: {
    units: "Tus unidades",
    rests: "Descansa",
    luck: (value: string) => `Suerte ${value}`,
    amount: (name: string, n: number) => `${name}: ${n}`,
    outOf: (name: string, n: number, max: number) => `${name}: ${n} de ${max}`,
    figures: "Figuras",
  },
  en: {
    units: "Your units",
    rests: "Rests",
    luck: (value: string) => `Luck ${value}`,
    amount: (name: string, n: number) => `${name}: ${n}`,
    outOf: (name: string, n: number, max: number) => `${name}: ${n} of ${max}`,
    figures: "Figures",
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

interface SupplyMetersProps {
  unit: Unit;
  supplies: UnitSupplies;
  luck: number | null;
  /** Pass and play: the figures it has left; null on own tablets, which don't count them */
  figures: number | null;
  faction: Faction;
}

/**
 * A unit's figures and supplies as bars against what it has when full, then its equipment and
 * luck as icons with their number
 */
function SupplyMeters({ unit, supplies, luck, figures, faction }: SupplyMetersProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const full = fullSupplies(unit.getUnitType(), unit.elite);
  const maxFigures = FIGURES[unit.getUnitType()].figures;
  return (
    <Stack spacing={0.5} data-testid="unit-meters">
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", columnGap: 1.5, rowGap: 0.5 }}>
        {figures !== null && (
          <StatBar
            icon={<Box component="img" src={unitSprite(faction, unit.getUnitType())} alt="" sx={{ width: 16, height: 16 }} />}
            value={figures}
            max={maxFigures}
            color="success"
            label={t.outOf(t.figures, figures, maxFigures)}
          />
        )}
        {SUPPLIES.filter((supply) => supplies.amounts[supply] !== undefined).map((supply) => {
          const amount = supplies.amounts[supply]!;
          const max = full.amounts[supply] ?? amount;
          return (
            <StatBar
              key={supply}
              icon={<GameIcon name={SUPPLY_ICONS[supply]} size={16} />}
              value={amount}
              max={max}
              label={t.outOf(labels.supplies[supply], amount, max)}
            />
          );
        })}
      </Box>
      <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", columnGap: 1, rowGap: 0.25 }}>
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
    </Stack>
  );
}

interface UnitListProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** The unit picked, on the map or here; null while nothing can be picked */
  selected: Position | null;
  /** A row tapped: the unit on that hex. Left out, the rows are only read (the card screen) */
  onSelect?: (position: Position) => void;
}

/**
 * This side's units while giving orders, beside the map (below it in portrait): each one's hex,
 * its figures and supplies as bars, its equipment and luck, and the action it has or "Descansa". Tapping a row picks the unit, as
 * tapping it on the map does. Never the enemy's: their supplies and luck aren't shown
 */
function UnitList({ faction, session, game, selected, onSelect }: UnitListProps) {
  const readOnly = !onSelect;
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
        const rowSx = { minHeight: 48, borderRadius: 1, px: 1, gap: 1, alignItems: "flex-start" };
        const content = (
          <>
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
              <SupplyMeters
                unit={unit}
                supplies={supplies}
                luck={session.luckAt(position)}
                figures={session.figuresAt(position)}
                faction={faction}
              />
            </Stack>
          </>
        );
        const key = `${position.row}-${position.col}`;
        // Only read (the card screen): a plain row, so nothing invites a tap that does nothing
        return readOnly ? (
          <ListItem key={key} data-testid="unit-row" sx={rowSx}>
            {content}
          </ListItem>
        ) : (
          <ListItemButton
            key={key}
            ref={isSelected ? selectedRow : undefined}
            selected={isSelected}
            onClick={() => onSelect(position)}
            data-testid="unit-row"
            sx={rowSx}
          >
            {content}
          </ListItemButton>
        );
      })}
    </List>
  );
}

export default UnitList;
