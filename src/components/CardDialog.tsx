import { ReactNode, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import type { ActionCard } from "../game-core/actionCard";
import { defineMessages, useLabels, useMessages, useTr } from "../i18n/useI18n";
import ActionCardComponent from "./ActionCardComponent";
import CardDetails from "./CardDetails";
import GameIcon from "./GameIcon";

const TEXT = defineMessages({
  es: {
    costs: (coins: string) => `Cuesta ${coins}`,
    close: "Cerrar",
  },
  en: {
    costs: (coins: string) => `Costs ${coins}`,
    close: "Close",
  },
});

/** A card to look at: an action card, at the side's cost */
export type ShownCard = { action: ActionCard; cost?: number; turnsLeft?: number };

interface CardDialogProps {
  /** The card shown; null closes the dialog */
  card: ShownCard | null;
  onClose: () => void;
  /** Accessible name of the dialog */
  label: string;
  /** Buttons beside "Cerrar", e.g. to play the card */
  children?: ReactNode;
}

/** A card large, with its full text, which the small card fades out */
function CardDialog({ card, onClose, label, children }: CardDialogProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  // Keep the last card while the dialog fades out
  const [shown, setShown] = useState(card);
  if (card && card !== shown) setShown(card);

  return (
    <Dialog open={card !== null} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { "aria-label": label } }}>
      <DialogContent>
        {shown && "action" in shown && (
          <CardDetails
            card={<ActionCardComponent card={shown.action} cost={shown.cost} turnsLeft={shown.turnsLeft} />}
            cardWidth={220}
            name={tr(shown.action.name)}
            tags={[t.costs(labels.coins(shown.cost ?? shown.action.cost))]}
            text={tr(shown.action.description)}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {children}
        <Button variant="outlined" onClick={onClose} startIcon={<GameIcon name="cancel" />}>
          {t.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CardDialog;
