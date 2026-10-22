import { motion } from "motion/react";
import { GameSnapshot } from "../../../game-core/gameSession";
import { defineMessages, useMessages } from "../../../i18n/useI18n";
import CardHand from "../../CardHand";
import ActionCardComponent from "../../ActionCardComponent";
import "./CardsView.css";

const TEXT = defineMessages({
  es: { hand: "Tu mano" },
  en: { hand: "Your hand" },
});

interface LeavingHandProps {
  /** The cards left in the hand, the played one out */
  cards: GameSnapshot["cards"];
  /** It has slid off the screen */
  onGone: () => void;
}

/**
 * The orders screen just after the card was played: the rest of the hand,
 * where the Command Zone held it, slides down off the screen so the player
 * gives the orders on the map. Only a picture: it takes no taps.
 */
function LeavingHand({ cards, onGone }: LeavingHandProps) {
  const t = useMessages(TEXT);
  return (
    <motion.div
      className="leaving-hand cards-hands"
      aria-hidden
      data-testid="leaving-hand"
      initial={{ y: 0 }}
      animate={{ y: "110%" }}
      transition={{ duration: 0.6, ease: "easeIn", delay: 0.2 }}
      onAnimationComplete={onGone}
    >
      <CardHand
        label={t.hand}
        fit
        overlap={0.12}
        cards={cards.map(({ card, cost, turnsLeft }) => ({
          key: card.id,
          node: <ActionCardComponent card={card} cost={cost} turnsLeft={turnsLeft} />,
        }))}
      />
    </motion.div>
  );
}

export default LeavingHand;
