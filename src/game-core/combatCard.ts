// game-core/combatCard.ts

/**
 * When a combat card is played: with the command card, for this turn's orders
 * ("order"), or during the battle, as a reaction ("battle")
 */
export type CombatPhase = "order" | "battle";

/** A combat card: paid in coins when played. Its effect is resolved at the table (the app applies some in Step 26). */
export interface CombatCard {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Coins to play it */
  readonly cost: number;
  readonly phase: CombatPhase;
}
