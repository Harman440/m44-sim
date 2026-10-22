import { RefObject, useEffect, useMemo, useRef } from "react";
import { Button, List, ListItemButton, ListItemText, Paper, Popper, PopperProps, Typography } from "@mui/material";
import type { ActionOption } from "../../../game-core/gameSession";
import type { UnitAction } from "../../../game-core/unitAction";
import { positionKey } from "../../../game-core/position";
import { Position } from "../../../types/scenario";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import GameIcon from "../../GameIcon";

const TEXT = defineMessages({
  es: {
    actions: "Acciones",
    cancel: "Cancelar",
  },
  en: {
    actions: "Actions",
    cancel: "Cancel",
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
  onPick: (action: UnitAction) => void;
  onCancel: () => void;
  /** Changes whenever the map zooms or pans, so the pop-up follows its unit */
  view?: number;
}

/**
 * The picked unit's actions as a pop-up over the map, to the right of the unit (to its left near
 * the map's right edge). One it can't be given is greyed, with the reason ("Sin energía",
 * "Moral 0"). Not modal: tapping the map still picks another unit or deselects this one
 */
function ActionPopup({ position, board, title, actions, current, onPick, onCancel, view = 0 }: ActionPopupProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const key = position && positionKey(position);

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
      <Paper elevation={8} data-testid="action-popup" sx={{ width: 248, maxHeight: mapHeight ? mapHeight - 8 : "70vh", overflowY: "auto", p: 1 }}>
        <Typography variant="subtitle2" sx={{ px: 1 }}>
          {title}
        </Typography>
        <List dense aria-label={t.actions} sx={{ py: 0.5 }}>
          {actions.map(({ action, refusal }) => (
            <ListItemButton
              key={action.id}
              disabled={refusal !== null}
              selected={action.id === current?.id}
              onClick={() => onPick(action)}
              sx={{ minHeight: 48, borderRadius: 1 }}
            >
              <ListItemText
                primary={tr(action.name)}
                secondary={refusal === null ? labels.describeCost(action.cost) : labels.actionRefusals[refusal]}
              />
            </ListItemButton>
          ))}
        </List>
        <Button variant="outlined" fullWidth onClick={onCancel} startIcon={<GameIcon name="cancel" />}>
          {t.cancel}
        </Button>
      </Paper>
    </Popper>
  );
}

export default ActionPopup;
