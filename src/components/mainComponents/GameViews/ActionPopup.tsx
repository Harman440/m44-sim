import { RefObject, useEffect, useMemo, useRef } from "react";
import { Box, IconButton, List, ListItemButton, Paper, Popper, PopperProps, Stack, Typography } from "@mui/material";
import type { ActionOption } from "../../../game-core/gameSession";
import type { UnitAction } from "../../../game-core/unitAction";
import { positionKey } from "../../../game-core/position";
import { Position } from "../../../types/scenario";
import { defineMessages, useMessages, useTr } from "../../../i18n/useI18n";
import GameIcon from "../../GameIcon";
import { InfoGlyph } from "../../InfoButton";
import { CostIcons } from "../../SupplyIcons";

const TEXT = defineMessages({
  es: {
    actions: "Acciones",
    cancel: "Cancelar",
    about: (action: string) => `Qué hace ${action}`,
  },
  en: {
    actions: "Actions",
    cancel: "Cancel",
    about: (action: string) => `What ${action} does`,
  },
});

interface ActionPopupProps {
  /** The unit picked; the pop-up is closed when null */
  position: Position | null;
  /** The map's box: the pop-up sits beside the unit's hex in it, and stays inside it */
  board: RefObject<HTMLElement | null>;
  /** The unit, as the list's heading: "Infantería en bosque" */
  title: string;
  actions: readonly ActionOption[];
  /** The action the unit has now (it holds), marked in the list */
  current?: UnitAction | null;
  /** The action whose card is shown in the column ("i"), marked in the list */
  shown?: UnitAction | null;
  onPick: (action: UnitAction) => void;
  /** Its "i": show the action's card in the column, without picking it */
  onShow: (action: UnitAction) => void;
  onCancel: () => void;
  /** Changes whenever the map zooms or pans, so the pop-up follows its unit */
  view?: number;
}

/**
 * The picked unit's actions as a pop-up over the map, to the right of the unit (to its left near
 * the map's right edge): one line each, its name and its cost as icons, and an "i" that shows its
 * card in the column. Only the actions it can be given now are listed. See-through, so the map
 * shows under it. Not modal: tapping the map still picks another unit or deselects this one
 */
function ActionPopup({ position, board, title, actions, current, shown, onPick, onShow, onCancel, view = 0 }: ActionPopupProps) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const key = position && positionKey(position);
  const offered = actions.filter(({ refusal }) => refusal === null);

  const popper = useRef<{ update: () => void } | null>(null);
  useEffect(() => {
    popper.current?.update();
  }, [view]);

  // The map drawn (its box can be taller), which the pop-up stays inside; no taller than it, a long list scrolling
  const map = board.current?.querySelector<SVGSVGElement>("svg.board__svg") ?? board.current ?? null;
  const mapHeight = map?.getBoundingClientRect().height ?? 0;

  // Found again each time it's placed: the hex is redrawn as the map changes
  const anchor = useMemo(() => {
    if (!key) return null;
    const hex = () => board.current?.querySelector(`[data-position="${key}"]`) ?? null;
    return { getBoundingClientRect: () => hex()?.getBoundingClientRect() ?? new DOMRect() };
  }, [key, board]);

  return (
    <Popper
      open={anchor !== null}
      anchorEl={anchor}
      placement="right-start"
      popperRef={popper as PopperProps["popperRef"]}
      modifiers={[
        { name: "flip", options: { fallbackPlacements: ["left-start", "bottom", "top"], boundary: map ?? "clippingParents" } },
        // It may slide along the map away from its unit, to stay inside the map
        { name: "preventOverflow", options: { boundary: map ?? "clippingParents", padding: 4, tether: false, altAxis: true } },
        { name: "offset", options: { offset: [0, 4] } },
      ]}
      sx={{ zIndex: 1200 }}
    >
      <Paper
        elevation={8}
        data-testid="action-popup"
        sx={{
          width: 252,
          maxHeight: mapHeight ? mapHeight - 8 : "70vh",
          overflowY: "auto",
          p: 0.5,
          // See-through, so what's under it on the map still shows
          bgcolor: "color-mix(in srgb, var(--m44-paper) 78%, transparent)",
          backdropFilter: "blur(2px)",
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", pl: 1 }}>
          <Typography variant="caption" noWrap sx={{ flex: 1, fontWeight: 700 }}>
            {title}
          </Typography>
          <IconButton aria-label={t.cancel} title={t.cancel} onClick={onCancel} sx={{ width: 48, height: 48 }}>
            <GameIcon name="cancel" size={20} />
          </IconButton>
        </Stack>
        <List dense disablePadding aria-label={t.actions}>
          {offered.map(({ action, cost }) => (
            <Box component="li" key={action.id} sx={{ display: "flex", alignItems: "center" }}>
              <ListItemButton
                component="div"
                role="button"
                selected={action.id === current?.id || action.id === shown?.id}
                onClick={() => onPick(action)}
                sx={{ minHeight: 48, py: 0, px: 1, gap: 1, borderRadius: 1, justifyContent: "space-between" }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.15 }}>
                  {tr(action.name)}
                </Typography>
                <CostIcons cost={cost} />
              </ListItemButton>
              <IconButton
                aria-label={t.about(tr(action.name))}
                title={t.about(tr(action.name))}
                aria-pressed={action.id === shown?.id}
                onClick={() => onShow(action)}
                sx={{ width: 48, height: 48, flex: "none", color: action.id === shown?.id ? "primary.main" : "text.secondary" }}
              >
                <InfoGlyph size={20} />
              </IconButton>
            </Box>
          ))}
        </List>
      </Paper>
    </Popper>
  );
}

export default ActionPopup;
