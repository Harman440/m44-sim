import { ReactNode, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import CommandCard, { Section } from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import type { ActionCard } from "../game-core/actionCard";
import { Faction } from "../types/faction";
import { defineMessages, useLabels, useLang, useMessages, useTr } from "../i18n/useI18n";
import CommandCardComponent, { ruleTags } from "./CommandCardComponent";
import CombatCardComponent from "./CombatCardComponent";
import ActionCardComponent from "./ActionCardComponent";
import CardDetails from "./CardDetails";
import GameIcon from "./GameIcon";

const TEXT = defineMessages({
  es: {
    section: (name: string) => `Sección: ${name}`,
    costs: (coins: string) => `Cuesta ${coins}`,
    close: "Cerrar",
  },
  en: {
    section: (name: string) => `Section: ${name}`,
    costs: (coins: string) => `Costs ${coins}`,
    close: "Close",
  },
});

/** A card to look at: an action card (at the side's cost), or one of the old command or combat cards */
export type ShownCard =
  | { action: ActionCard; cost?: number; turnsLeft?: number }
  | { command: CommandCard; section?: Section | null }
  | { combat: CombatCard };

interface CardDialogProps {
  /** The card shown; null closes the dialog */
  card: ShownCard | null;
  faction: Faction;
  onClose: () => void;
  /** Accessible name of the dialog */
  label: string;
  /** Buttons beside "Cerrar", e.g. to play the card */
  children?: ReactNode;
}

/** A card large, with its full text, which the small card fades out */
function CardDialog({ card, faction, onClose, label, children }: CardDialogProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const lang = useLang();
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
        {shown && "command" in shown && (
          <CardDetails
            card={<CommandCardComponent faction={faction} cardData={shown.command} />}
            cardWidth={220}
            name={tr(shown.command.name)}
            tags={[...ruleTags(shown.command, lang), ...(shown.section ? [t.section(labels.sections[shown.section])] : [])]}
            text={tr(shown.command.description)}
          />
        )}
        {shown && "combat" in shown && (
          <CardDetails
            card={<CombatCardComponent faction={faction} card={shown.combat} />}
            cardWidth={220}
            name={tr(shown.combat.name)}
            tags={[t.costs(labels.coins(shown.combat.cost))]}
            text={tr(shown.combat.description)}
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
