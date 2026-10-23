import type { ReactNode } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import type { UnitAction } from "../../../game-core/unitAction";
import type { SupplyCost } from "../../../game-core/unitSupplies";
import { defineMessages, useLabels, useLang, useMessages, useTr } from "../../../i18n/useI18n";
import { PAINTINGS } from "../../cardPaintings";
import generalsArt from "../../../assets/cards/british-generals.webp";

const TEXT = defineMessages({
  es: {
    costs: (cost: string) => `Cuesta: ${cost}`,
  },
  en: {
    costs: (cost: string) => `Costs: ${cost}`,
  },
});

interface ActionPanelProps {
  action: UnitAction;
  /** What it costs this unit (`ActionOption.cost`) */
  cost: SupplyCost;
  /** What the unit is and where: "Infantería en bosque" */
  unit: string;
  /** How far it moves and where it can still fire, from its move options */
  movement?: string;
  /** The warnings, the map's legend and the buttons, under the card */
  children?: ReactNode;
}

/**
 * The action picked for a unit, as a card in the column (over the unit list): its painting, its
 * name, what it does and what it costs. Under it, what to do next while the map shows its moves
 */
function ActionPanel({ action, cost, unit, movement, children }: ActionPanelProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const lang = useLang();
  return (
    <Paper variant="outlined" data-testid="action-panel" sx={{ width: "100%", overflow: "hidden" }}>
      <Box
        component="img"
        src={PAINTINGS[action.painting] ?? generalsArt}
        alt=""
        sx={{ display: "block", width: "100%", aspectRatio: "3 / 2", objectFit: "contain", bgcolor: "var(--m44-paper-alt)" }}
      />
      <Stack sx={{ p: 1.5, gap: 0.75 }}>
        <Typography variant="caption" color="text.secondary">
          {unit}
        </Typography>
        <Typography variant="h6" component="h3" lang={lang} sx={{ lineHeight: 1.2, hyphens: "auto" }}>
          {tr(action.name)}
        </Typography>
        <Typography variant="body2">{tr(action.description)}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }} data-testid="action-cost">
          {t.costs(labels.describeCost(cost))}
        </Typography>
        {movement && (
          <Typography variant="body2" color="text.secondary">
            {movement}
          </Typography>
        )}
        {children}
      </Stack>
    </Paper>
  );
}

export default ActionPanel;
