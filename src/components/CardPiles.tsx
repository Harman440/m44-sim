import { ButtonBase } from "@mui/material";
import { defineMessages, useMessages } from "../i18n/useI18n";
import "./CardPiles.css";

const TEXT = defineMessages({
  es: {
    piles: (deck: number, discard: number) => `Mazo: ${deck} cartas. Descarte: ${discard}. Ver mazo`,
    deck: "Mazo",
    discard: "Descarte",
  },
  en: {
    piles: (deck: number, discard: number) => `Deck: ${deck} cards. Discard: ${discard}. See the deck`,
    deck: "Deck",
    discard: "Discard",
  },
});

interface CardPilesProps {
  drawPileCount: number;
  discardPileCount: number;
  /** Tapping the piles shows the deck */
  onOpen: () => void;
}

/**
 * The command deck and its discard pile, small, in the game header with their
 * counts on them; a tap shows the deck. Cards fly from and to them
 * (`deckPile()`/`discardPile()`).
 */
function CardPiles({ drawPileCount, discardPileCount, onOpen }: CardPilesProps) {
  const t = useMessages(TEXT);
  return (
    <ButtonBase className="card-piles" onClick={onOpen} aria-label={t.piles(drawPileCount, discardPileCount)}>
      <span className="deck-pile" data-testid="deck-pile" title={t.deck}>
        <span className="pile__count">{drawPileCount}</span>
      </span>
      <span className={`discard-pile${discardPileCount > 0 ? " discard-pile--full" : ""}`} data-testid="discard-pile" title={t.discard}>
        <span className="pile__count">{discardPileCount}</span>
      </span>
    </ButtonBase>
  );
}

/** The header's deck and discard pile, for cards flying from and to them */
export const deckPile = () => document.querySelector<HTMLElement>('[data-testid="deck-pile"]');
export const discardPile = () => document.querySelector<HTMLElement>('[data-testid="discard-pile"]');

export default CardPiles;
