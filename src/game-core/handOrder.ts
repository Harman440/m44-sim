import CommandCard, { SECTIONS } from "./commandCard";
import { CombatCard } from "./combatCard";

/**
 * Where a command card sits in the hand, from left to right: section cards by
 * the sections they order (left, center, right), with the tactic cards (and
 * the cards whose section is picked on play) in the middle, after the center
 * section cards and before the right-center ones.
 */
function commandPlace(card: CommandCard): number {
  // A section card (as CardArt's isSectionCard): any unit type, fixed sections
  if (card.tactic || card.unitTypes || card.sections === "chosen" || card.sections.length === 0) return 2.5;
  const indexes = card.sections.map((section) => SECTIONS.indexOf(section));
  // 0 left, 2 center (or all three), 4 right
  return (indexes.reduce((sum, i) => sum + i, 0) / indexes.length) * 2;
}

/** The command cards as the hand holds them: left cards on the left, tactics in the middle, right cards on the right */
export function sortCommandHand(cards: readonly CommandCard[]): CommandCard[] {
  return cards
    .map((card, i) => ({ card, i, place: commandPlace(card) }))
    .sort((a, b) => a.place - b.place || a.i - b.i)
    .map(({ card }) => card);
}

/**
 * The combat cards as the hand holds them: the ones that can be played with
 * the orders now first, then the order cards that can't (not enough
 * supplies), then the battle cards; cheaper first in each group.
 */
export function sortCombatHand(cards: readonly CombatCard[], playable: (card: CombatCard) => boolean): CombatCard[] {
  const group = (card: CombatCard) => (card.phase === "battle" ? 2 : playable(card) ? 0 : 1);
  return cards
    .map((card, i) => ({ card, i, group: group(card) }))
    .sort((a, b) => a.group - b.group || a.card.cost - b.card.cost || a.i - b.i)
    .map(({ card }) => card);
}
