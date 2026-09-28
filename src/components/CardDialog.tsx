import { ReactNode, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import CommandCard, { Section } from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { Faction } from "../types/faction";
import { COMBAT_PHASE_LABELS, SECTION_LABELS, coinsText } from "../labels";
import CommandCardComponent, { ruleTags } from "./CommandCardComponent";
import CombatCardComponent from "./CombatCardComponent";
import CardDetails from "./CardDetails";
import GameIcon from "./GameIcon";

/** A card to look at: a command card (with the section it was played in) or a combat card */
export type ShownCard = { command: CommandCard; section?: Section | null } | { combat: CombatCard };

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
  // Keep the last card while the dialog fades out
  const [shown, setShown] = useState(card);
  if (card && card !== shown) setShown(card);

  return (
    <Dialog open={card !== null} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { "aria-label": label } }}>
      <DialogContent>
        {shown && "command" in shown && (
          <CardDetails
            card={<CommandCardComponent faction={faction} cardData={shown.command} />}
            cardWidth={220}
            name={shown.command.name}
            tags={[...ruleTags(shown.command), ...(shown.section ? [`Sección: ${SECTION_LABELS[shown.section]}`] : [])]}
            text={shown.command.description}
          />
        )}
        {shown && "combat" in shown && (
          <CardDetails
            card={<CombatCardComponent faction={faction} card={shown.combat} />}
            cardWidth={220}
            name={shown.combat.name}
            tags={[COMBAT_PHASE_LABELS[shown.combat.phase], `Cuesta ${coinsText(shown.combat.cost)}`]}
            text={shown.combat.description}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {children}
        <Button variant="outlined" onClick={onClose} startIcon={<GameIcon name="cancel" />}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CardDialog;
