// game-core/combatCard.ts
import type { UnitType } from "./unit";

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
  /** Hexes to mark on the map while giving orders (Barrage, Air Power, Sniper…) */
  readonly marker?: MarkerRule;
  /** Something to put on the physical board when it's played (sandbags, a camouflage badge) */
  readonly tableReminder?: string;
}

/** Which hexes a card makes the player mark on the orders map. The rules are in markerRules.ts. */
export interface MarkerRule {
  /** "target": hexes it attacks (not on your own units); "cross": where a new unit appears (an empty hex) */
  kind: "target" | "cross";
  /** How many hexes; all of them must be marked before the orders are confirmed */
  count: number;
  /** Each hex touches the one marked before it (Air Power) */
  chain?: boolean;
  /** Not on or next to your own units (Air Bombardment) */
  awayFromOwnUnits?: boolean;
  /** Next to one of your units of this type (Sniper: infantry) */
  nextTo?: UnitType;
}
