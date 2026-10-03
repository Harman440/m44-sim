// game-core/combatCard.ts
import type { UnitType } from "./unit";
import type { HexType } from "../types/hex";

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
  /** Hexes to mark on the map while giving orders (Barrage, Air Power, Reinforcements…) */
  readonly marker?: MarkerRule;
  /** A reminder for the final phase: something to do on the table (sandbags, a camouflage badge, a move to mirror on the map) */
  readonly tableReminder?: string;
  /** What the app applies for it; without one, the card is resolved at the table */
  readonly effect?: CombatEffect;
}

/** The effects the app applies; the rest is resolved at the table */
export type CombatEffect =
  | DiceBonusEffect
  | AttackEffect
  | MoveEffect
  | { kind: "changeSection" }
  /** Heat of Battle: units of these types can take ground after a close assault and fire again, like armour */
  | { kind: "takeGround"; unitTypes: readonly UnitType[]; units: number }
  /** Reinforcements: the orders screen shows the scenario's table of which unit each die face brings */
  | { kind: "reinforcements" }
  /** Ambush: a unit attacked in close assault fires first, picked on the map when the card is played */
  | { kind: "ambush" };

/** A battle card: +dice on one shot by a unit of these types (Spotter, Street Fight, Explosives) */
export interface DiceBonusEffect {
  kind: "diceBonus";
  dice: number;
  unitTypes: readonly UnitType[];
  /** Only in close assault (Explosives) */
  closeAssault?: boolean;
  /** Asked when a unit that fits fires, e.g. "¿La unidad está en un edificio o junto a uno?" */
  condition?: string;
}

/** An order card that attacks the marked hexes in the battle, with its own roll per hex (Barrage, Air Power…) */
export interface AttackEffect {
  kind: "attack";
  dicePerHex: number;
}

/** An order card that changes how some ordered units move (Frozen Ground, Armor Forward, Rattenkrieg…) */
export interface MoveEffect {
  kind: "move";
  /** How many ordered units can use it */
  units: number;
  /** Only units of these types; omitted: any */
  unitTypes?: readonly UnitType[];
  /** Hexes added to the move, and to how far it moves and still fires */
  moveBonus?: number;
  /** It moves this far instead, and can still fire */
  maxMove?: number;
  /** Terrain doesn't stop the move */
  ignoreTerrain?: boolean;
  /** It can still fire after moving into these terrains */
  fireInto?: readonly HexType[];
  /** It must end the move on these terrains */
  endOn?: readonly HexType[];
  /** It must start on or next to these terrains */
  startNear?: readonly HexType[];
  /** Not for a unit on the move (Rattenkrieg) */
  notOnTheMove?: boolean;
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
}
