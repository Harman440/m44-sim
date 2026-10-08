import { Ref } from "react";
import { Stack, Typography } from "@mui/material";
import { defineMessages, useMessages } from "../i18n/useI18n";
import "./CardPiles.css";

const TEXT = defineMessages({
  es: {
    deck: (n: number) => `Cartas (${n})`,
    discard: (n: number) => `Descarte (${n})`,
  },
  en: {
    deck: (n: number) => `Cards (${n})`,
    discard: (n: number) => `Discard (${n})`,
  },
});

interface CardPilesProps {
  drawPileCount: number;
  discardPileCount: number;
  /** The deck and the discard pile, for cards flying from and to them */
  deckRef?: Ref<HTMLDivElement>;
  discardRef?: Ref<HTMLDivElement>;
}

/** The command deck and its discard pile, small, with their counts */
function CardPiles({ drawPileCount, discardPileCount, deckRef, discardRef }: CardPilesProps) {
  const t = useMessages(TEXT);
  return (
    <div className="top-area">
      <Stack className="pile" sx={{ alignItems: "center" }}>
        <Typography className="pile__label">{t.deck(drawPileCount)}</Typography>
        <div className="deck-pile" ref={deckRef}>
          <div className="deck-back">M'44</div>
        </div>
      </Stack>

      <Stack className="pile" sx={{ alignItems: "center" }}>
        <Typography className="pile__label">{t.discard(discardPileCount)}</Typography>
        <div className="discard-pile" ref={discardRef}>
          {discardPileCount > 0 && <div className="deck-back">M'44</div>}
        </div>
      </Stack>
    </div>
  );
}

export default CardPiles;
