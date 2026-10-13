import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, List, ListItemButton, Typography } from "@mui/material";
import { Scenario } from "../../types/scenario";
import { copyDraft, newDraft, newMapId } from "../../game-core/scenarioDraft";
import GameIcon from "../GameIcon";
import { defineMessages, useMessages, useTr } from "../../i18n/useI18n";

const TEXT = defineMessages({
  es: {
    title: "Nuevo mapa",
    replaces: "El mapa que estás haciendo se perderá.",
    empty: "Mapa vacío",
    copyOf: (name: string) => `Copia de ${name}`,
    cancel: "Cancelar",
  },
  en: {
    title: "New map",
    replaces: "The map you're making will be lost.",
    empty: "Empty map",
    copyOf: (name: string) => `Copy of ${name}`,
    cancel: "Cancel",
  },
});

interface NewMapDialogProps {
  open: boolean;
  /** Scenarios a new map can start as a copy of */
  scenarios: readonly Scenario[];
  /** The map being made has something on it, so starting another loses it */
  replacing: boolean;
  onPick: (draft: Scenario) => void;
  onClose: () => void;
}

/** Start a new map: empty, or a copy of a scenario to change */
function NewMapDialog({ open, scenarios, replacing, onPick, onClose }: NewMapDialogProps) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const pick = (draft: Scenario) => {
    onPick(draft);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t.title}</DialogTitle>
      <DialogContent>
        {replacing && <DialogContentText sx={{ mb: 1 }}>{t.replaces}</DialogContentText>}
        <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
          <ListItemButton divider onClick={() => pick(newDraft(newMapId()))} sx={{ gap: 1.5, minHeight: 56 }}>
            <Box sx={{ width: 64, display: "grid", placeItems: "center", flex: "none" }}>
              <GameIcon name="map" size={28} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t.empty}
            </Typography>
          </ListItemButton>
          {scenarios.map((scenario, i) => (
            <ListItemButton
              key={scenario.id}
              divider={i < scenarios.length - 1}
              onClick={() => pick(copyDraft(scenario, newMapId()))}
              sx={{ gap: 1.5, minHeight: 56 }}
            >
              {scenario.image ? (
                <Box component="img" src={scenario.image} alt="" sx={{ width: 64, height: 40, objectFit: "cover", borderRadius: 0.5, flex: "none" }} />
              ) : (
                <Box sx={{ width: 64, flex: "none" }} />
              )}
              <Typography variant="subtitle1">{t.copyOf(tr(scenario.name))}</Typography>
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewMapDialog;
