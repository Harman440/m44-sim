import { useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import CombatCardComponent from "../CombatCardComponent";
import CardDialog, { ShownCard } from "../CardDialog";
import FactionInsignia from "../FactionInsignia";
import GameIcon, { DECK_REASON_ICONS } from "../GameIcon";
import { CombatDeckEntry, DeckReason } from "../../data/combatCards";
import { Faction } from "../../types/faction";
import { DECK_REASON_LABELS, FACTION_LABELS } from "../../labels";

interface CombatDeckDialogProps {
  open: boolean;
  onClose: () => void;
  faction: Faction;
  /** The side's combat deck in this scenario */
  entries: readonly CombatDeckEntry[];
}

/** The groups in the order shown: what everyone gets first, then what this side's situation adds */
const REASON_ORDER: DeckReason[] = ["shared", "attacker", "defender", "tanks", "artillery", "enemyTanks", "towns", "bigGuns", "air"];

/**
 * A side's combat deck in the chosen scenario, shown from the menu: the cards
 * grouped by why the side gets them; tapping one shows its text.
 * Lazy-loaded: the card art is the game screen's code.
 */
function CombatDeckDialog({ open, onClose, faction, entries }: CombatDeckDialogProps) {
  const [looking, setLooking] = useState<ShownCard | null>(null);
  const total = entries.reduce((sum, { copies }) => sum + copies, 0);

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FactionInsignia faction={faction} size={28} decorative />
          Cartas de combate · {FACTION_LABELS[faction]} ({total})
        </DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              El mazo depende del escenario: unas cartas las tiene todo el mundo y otras las da el papel del bando,
              sus unidades, las del enemigo o el mapa. Toca una carta para leerla.
            </Typography>
            {REASON_ORDER.map((reason) => {
              const group = entries.filter((entry) => entry.reason === reason);
              if (group.length === 0) return null;
              const title = DECK_REASON_LABELS[reason];
              const icon = DECK_REASON_ICONS[reason];
              return (
                <Stack key={reason} component="section" aria-label={title} sx={{ gap: 1 }}>
                  <Typography variant="h6" component="h3" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {icon && <GameIcon name={icon} size={32} />}
                    {title}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))",
                      gap: 2,
                      justifyItems: "center",
                      "--card-width": "116px",
                    }}
                  >
                    {group.map(({ card, copies }) => (
                      <Stack key={card.id} sx={{ alignItems: "center", gap: 0.5 }}>
                        <CombatCardComponent faction={faction} card={card} onClick={() => setLooking({ combat: card })} />
                        {copies > 1 && (
                          <Chip size="small" label={`×${copies}`} aria-label={`${copies} copias`} />
                        )}
                      </Stack>
                    ))}
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose} startIcon={<GameIcon name="cancel" />}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label="Carta del mazo" />
    </>
  );
}

export default CombatDeckDialog;
