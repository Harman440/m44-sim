import { ReactNode, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import CommandCard from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { Faction } from "../types/faction";
import CommandCardComponent from "./CommandCardComponent";
import CombatCardComponent from "./CombatCardComponent";
import CardDialog, { ShownCard } from "./CardDialog";
import GameIcon from "./GameIcon";
import { defineMessages, useMessages, useTr } from "../i18n/useI18n";
import { MAX_COMBAT_CARDS_PER_TURN } from "../data/combatCards";

const TEXT = defineMessages({
  es: {
    copies: (count: number, chance: string) => `${count} ${count === 1 ? "copia" : "copias"}, ${chance} de robarla`,
    reserveCopies: (count: number) => `${count} ${count === 1 ? "copia" : "copias"}, fuera del mazo`,
    reserveCards: "Fuera del mazo",
    reserveHint: (card: string) => `Nunca se roban: solo llegan con ${card}`,
    decks: "Mazos",
    intro: "Toca una carta para leerla. Debajo, cuántas copias tiene el mazo y la probabilidad de robarla.",
    sectionCards: "Cartas de sección",
    sectionCardsHint: "Dan órdenes en un flanco, en el centro o en varias secciones",
    tacticCards: "Cartas tácticas",
    tacticCardsHint: "Dan órdenes con reglas especiales",
    combatCards: "Cartas de combate",
    combatCardsHint: (max: number) => `Se pagan con suministros y se juegan con las órdenes, hasta ${max} por turno`,
    close: "Cerrar",
    deckCard: "Carta del mazo",
  },
  en: {
    copies: (count: number, chance: string) => `${count} ${count === 1 ? "copy" : "copies"}, ${chance} chance to draw it`,
    reserveCopies: (count: number) => `${count} ${count === 1 ? "copy" : "copies"}, kept out of the deck`,
    reserveCards: "Kept out of the deck",
    reserveHint: (card: string) => `Never drawn: only ${card} gives them`,
    decks: "Decks",
    intro: "Tap a card to read it. Below it, how many copies the deck has and the chance of drawing it.",
    sectionCards: "Section cards",
    sectionCardsHint: "Order units on a flank, in the center or in several sections",
    tacticCards: "Tactic cards",
    tacticCardsHint: "Order units with special rules",
    combatCards: "Combat cards",
    combatCardsHint: (max: number) => `Paid for with supplies and played with the orders, up to ${max} a turn`,
    close: "Close",
    deckCard: "Card in the deck",
  },
});

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

/** One entry per card, with how many copies the deck has, in deck order */
function groupCopies<T extends { id: string; templateId?: string }>(cards: readonly T[]): Copies<T>[] {
  const groups = new Map<string, Copies<T>>();
  cards.forEach((card) => {
    const template = card.templateId ?? card.id;
    const group = groups.get(template);
    if (group) group.count += 1;
    else groups.set(template, { card, count: 1 });
  });
  return [...groups.values()];
}

const percent = (count: number, total: number) => `${Math.round((count / total) * 100)} %`;

interface CardGroupProps<T> {
  title: string;
  hint: string;
  groups: Copies<T>[];
  /** Cards in the whole deck, for the chance of drawing each; null for cards kept out of it */
  deckSize: number | null;
  renderCard: (card: T) => ReactNode;
}

function CardGroup<T>({ title, hint, groups, deckSize, renderCard }: CardGroupProps<T>) {
  const t = useMessages(TEXT);
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
            {deckSize === null ? (
              <Chip size="small" label={`×${count}`} aria-label={t.reserveCopies(count)} />
            ) : (
              <Chip
                size="small"
                label={`×${count} · ${percent(count, deckSize)}`}
                aria-label={t.copies(count, percent(count, deckSize))}
              />
            )}
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

/** The side's command and combat decks: every card with its art and copies; tapping one shows its text */
function DeckVisualizerDialog({ open, onClose, faction, commandCards, combatCards }: DeckVisualizerDialogProps) {
  const t = useMessages(TEXT);
  const tr = useTr();
  const [looking, setLooking] = useState<ShownCard | null>(null);

  // The cards kept out of the deck (Armor Assault) are never drawn: only a card's reward gives them
  const deck = commandCards.filter((card) => !card.reserve);
  const reserve = commandCards.filter((card) => card.reserve);
  const giver = deck.find((card) => card.rewardCard);
  const commandGroups = groupCopies(deck);
  const commandCard = (card: CommandCard) => (
    <CommandCardComponent faction={faction} cardData={card} onClick={() => setLooking({ command: card })} />
  );
  const combatCard = (card: CombatCard) => (
    <CombatCardComponent faction={faction} card={card} onClick={() => setLooking({ combat: card })} />
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle>{t.decks}</DialogTitle>
        <DialogContent dividers>
          <Stack sx={{ gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {t.intro}
            </Typography>
            <CardGroup
              title={t.sectionCards}
              hint={t.sectionCardsHint}
              groups={commandGroups.filter(({ card }) => !card.tactic)}
              deckSize={deck.length}
              renderCard={commandCard}
            />
            <CardGroup
              title={t.tacticCards}
              hint={t.tacticCardsHint}
              groups={commandGroups.filter(({ card }) => card.tactic)}
              deckSize={deck.length}
              renderCard={commandCard}
            />
            <CardGroup
              title={t.reserveCards}
              hint={t.reserveHint(giver ? tr(giver.name) : "")}
              groups={groupCopies(reserve)}
              deckSize={null}
              renderCard={commandCard}
            />
            <CardGroup
              title={t.combatCards}
              hint={t.combatCardsHint(MAX_COMBAT_CARDS_PER_TURN)}
              groups={groupCopies(combatCards)}
              deckSize={combatCards.length}
              renderCard={combatCard}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose} startIcon={<GameIcon name="cancel" />}>
            {t.close}
          </Button>
        </DialogActions>
      </Dialog>
      <CardDialog card={looking} faction={faction} onClose={() => setLooking(null)} label={t.deckCard} />
    </>
  );
}

export default DeckVisualizerDialog;
