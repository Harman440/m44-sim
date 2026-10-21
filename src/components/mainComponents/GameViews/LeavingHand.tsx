import { motion } from "motion/react";
import CommandCard from "../../../game-core/commandCard";
import { CombatCard } from "../../../game-core/combatCard";
import { sortCombatHand, sortCommandHand } from "../../../game-core/handOrder";
import { Faction } from "../../../types/faction";
import { defineMessages, useMessages } from "../../../i18n/useI18n";
import CardHand from "../../CardHand";
import CommandCardComponent from "../../CommandCardComponent";
import CombatCardComponent from "../../CombatCardComponent";
import "./CardsView.css";

const TEXT = defineMessages({
  es: { hand: "Tu mano" },
  en: { hand: "Your hand" },
});

interface LeavingHandProps {
  faction: Faction;
  /** The cards left in the hand, the played ones out */
  hand: readonly CommandCard[];
  combatHand: readonly CombatCard[];
  /** It has slid off the screen */
  onGone: () => void;
}

/**
 * The orders screen just after the cards were played: the rest of the hand,
 * where the Command Zone held it, slides down off the screen so the player
 * gives the orders on the map. Only a picture: it takes no taps.
 */
function LeavingHand({ faction, hand, combatHand, onGone }: LeavingHandProps) {
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
        cards={[
          ...sortCommandHand(hand).map((card) => ({
            key: card.id,
            node: <CommandCardComponent faction={faction} cardData={card} />,
          })),
          ...sortCombatHand(combatHand, () => true).map((card, i) => ({
            key: `combat-${card.id}`,
            groupStart: i === 0,
            node: <CombatCardComponent faction={faction} card={card} />,
          })),
        ]}
      />
    </motion.div>
  );
}

export default LeavingHand;
