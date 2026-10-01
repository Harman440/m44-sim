import { ReactNode, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { Faction } from "../types/faction";
import CommandCardComponent from "./CommandCardComponent";
import CombatCardComponent from "./CombatCardComponent";
import CardDialog, { ShownCard } from "./CardDialog";
import GameIcon from "./GameIcon";

interface DeckVisualizerDialogProps {
  open: boolean;
  onClose: () => void;
  faction: Faction;
  /** This side's command deck */
  commandCards: readonly CommandCard[];
  /** This side's combat deck */
  combatCards: readonly CombatCard[];
}

interface Copies<T> {
  card: T;
  count: number;
}

/** One entry per card name, with how many copies the deck has, in deck order */
function groupByName<T extends { name: string }>(cards: readonly T[]): Copies<T>[] {
  const groups = new Map<string, Copies<T>>();
  cards.forEach((card) => {
    const group = groups.get(card.name);
    if (group) group.count += 1;
    else groups.set(card.name, { card, count: 1 });
  });
  return [...groups.values()];
}

const percent = (count: number, total: number) => `${Math.round((count / total) * 100)} %`;

interface CardGroupProps<T> {
  title: string;
  hint: string;
  groups: Copies<T>[];
  /** Cards in the whole deck, for the chance of drawing each */
  deckSize: number;
  renderCard: (card: T) => ReactNode;
}

function CardGroup<T>({ title, hint, groups, deckSize, renderCard }: CardGroupProps<T>) {
  const total = groups.reduce((sum, { count }) => sum + count, 0);
  if (total === 0) return null;
  return (
    <Stack component="section" sx={{ gap: 1 }}>
      <Box>
        <Typography variant="h6" component="h3">
          {title} ({total})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))",
          gap: 2,
          justifyItems: "center",
          "--card-width": "116px",
        }}
      >
        {groups.map(({ card, count }, i) => (
          <Stack key={i} sx={{ alignItems: "center", gap: 0.5 }}>
            {renderCard(card)}
            <Chip
              size="small"
              label={`×${count} · ${percent(count, deckSize)}`}
              aria-label={`${count} ${count === 1 ? "copia" : "copias"}, ${percent(count, deckSize)} de robarla`}
            />
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

/** The side's command and combat decks: every card with its art and copies; tapping one shows its text */
function DeckVisualizerDialog({ open, onClose, faction, commandCards, combatCards }: DeckVisualizerDialogProps) {
  const [looking, setLooking] = useState<ShownCard | null>(null);

  const commandGroups = groupByName(commandCards);
  const commandCard = (card: CommandCard) => (
    <CommandCardComponent faction={faction} cardData={card} onClick={() => setLooking({ command: card })} />
  );
  const combatCard = (card: CombatCard) => (
    <CombatCardComponent faction={faction} card={card} onClick={() => setLooking({ combat: card })} />
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle>Mazos</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Toca una carta para leerla. Debajo, cuántas copias tiene el mazo y la probabilidad de robarla.
            </Typography>
            <CardGroup
              title="Cartas de sección"
              hint="Dan órdenes en un flanco, en el centro o en varias secciones"
              groups={commandGroups.filter(({ card }) => !card.tactic)}
              deckSize={commandCards.length}
              renderCard={commandCard}
            />
            <CardGroup
              title="Cartas tácticas"
              hint="Dan órdenes con reglas especiales"
              groups={commandGroups.filter(({ card }) => card.tactic)}
              deckSize={commandCards.length}
              renderCard={commandCard}
            />
            <CardGroup
              title="Cartas de combate"
              hint="Se pagan con suministros, con las órdenes o en la batalla"
              groups={groupByName(combatCards)}
              deckSize={combatCards.length}
              renderCard={combatCard}
            />
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

export default DeckVisualizerDialog;
