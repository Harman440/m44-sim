import { useState } from "react";
import { Box, Stack } from "@mui/material";
import { motion } from "motion/react";
import type { ActionCard } from "../game-core/actionCard";
import type { GameSnapshot } from "../game-core/gameSession";
import { defineMessages, useMessages } from "../i18n/useI18n";
import ActionCardComponent from "./ActionCardComponent";
import CardDialog, { ShownCard } from "./CardDialog";

const TEXT = defineMessages({
  es: { played: "Carta jugada" },
  en: { played: "Card played" },
});

/** The Command Zone's tray and the orders screen share layoutIds with this prefix, so a played card flies between them */
export const PLAY_LAYOUT_PREFIX = "play-";
/** How a played card flies between the tray and the orders screen: slow enough to follow */
export const PLAY_FLIGHT = { type: "spring", stiffness: 140, damping: 22 } as const;

/** The card a side played this turn and what it cost the side, as `PlayedCards` takes them */
export const playedCardOf = (game: GameSnapshot): { card: ActionCard | null; cost?: number } => ({
  card: game.playedCard,
  cost: game.cards.find((held) => held.card.id === game.playedCard?.id)?.cost,
});

interface PlayedCardsProps {
  /** The command card played this turn, if any */
  card: ActionCard | null;
  /** What it cost the side */
  cost?: number;
  /**
   * The card's motion `layoutId` is this plus its id: a card with the same layoutId on the
   * screen before (the Command Zone's tray) flies here
   */
  layoutPrefix?: string;
  className?: string;
}

/**
 * The card played this turn, for the opponent to read at the table; tapping it shows its full
 * text. Sized by --card-width (PhaseLayout.css).
 */
function PlayedCards({ card, cost, layoutPrefix, className }: PlayedCardsProps) {
  const t = useMessages(TEXT);
  const [looking, setLooking] = useState<ShownCard | null>(null);
  if (!card) return null;

  return (
    <>
      <Box className={`played-cards${className ? ` ${className}` : ""}`} data-testid="played-cards">
        <Stack sx={{ alignItems: "center", gap: 0.5 }}>
          <motion.div layoutId={layoutPrefix && `${layoutPrefix}${card.id}`} transition={PLAY_FLIGHT}>
            <ActionCardComponent card={card} cost={cost} onClick={() => setLooking({ action: card, cost })} />
          </motion.div>
        </Stack>
      </Box>
      <CardDialog card={looking} onClose={() => setLooking(null)} label={t.played} />
    </>
  );
}

export default PlayedCards;
