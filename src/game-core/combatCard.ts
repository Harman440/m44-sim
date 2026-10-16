// game-core/combatCard.ts
import type { UnitType } from "./unit";
import type { HexType } from "../types/hex";
import type { DieFace } from "./dice";
import type { Localized } from "../i18n/lang";

/** Why a card is in a side's deck: what the side (or the map, or the enemy) has */
export type DeckReason =
  | "shared"
  | "attacker"
  | "defender"
  | "tanks"
  | "artillery"
  | "towns"
  | "bigGuns"
  | "air";

/**
 * A combat card: played with the command card (up to `MAX_COMBAT_CARDS_PER_TURN`, never two
 * copies of one card) and paid in coins then. Its effect is resolved at the table, or applied
 * by the app (`effect`).
 */
export interface CombatCard {
  readonly id: string;
  /** The card's template, shared by its copies in a deck; omitted in tests' hand-made cards */
  readonly templateId?: string;
  readonly name: Localized;
  readonly description: Localized;
  /** Coins to play it */
  readonly cost: number;
  /** Why the deck has it, shown as an icon on the card; omitted in tests' hand-made cards */
  readonly reason?: DeckReason;
  /** Hexes to mark on the map while giving orders (Barrage, Air Power, Reinforcements…) */
  readonly marker?: MarkerRule;
  /** A reminder for the final phase: something to do on the table (sandbags, a camouflage badge, a move to mirror on the map) */
  readonly tableReminder?: Localized;
  /** Shown in the battle's "Instrucciones": what the opponent's rolls must leave out at the table (Not One Step Back…) */
  readonly battleReminder?: Localized;
  /** What the app applies for it; without one, the card is resolved at the table */
  readonly effect?: CombatEffect;
  /** Given to one of this side's units while ordering (Explosives, Personal Armor…) */
  readonly assign?: AssignRule;
  /** Does nothing unless a unit of one of these types has an order this turn (Spotter: artillery); confirming warns */
  readonly needsOrdered?: readonly UnitType[];
}

/** The card's template: two copies of one card share it (and can't be played together) */
export const templateOf = (card: CombatCard): string => card.templateId ?? card.id;

/** Which unit a card can be given to */
export interface AssignRule {
  unitTypes: readonly UnitType[];
  /** Only a unit with an order this turn */
  ordered: boolean;
  /** Pass and play: only a unit that has lost a figure or taken a hit (Medic, Mechanic); on own tablets any unit */
  weakened?: boolean;
}

/** The effects the app applies; the rest is resolved at the table */
export type CombatEffect =
  | DiceBonusEffect
  | AttackEffect
  | MoveEffect
  | { kind: "changeSection" }
  /** Reinforcements: a unit of this type arrives on the cross in the final phase */
  | { kind: "reinforcements"; unitType: UnitType }
  /** Fortify: in the battle, this side's ordered units of these types may put sandbags on their hex instead of firing */
  | { kind: "fortify"; unitTypes: readonly UnitType[] }
  /** Not One Step Back: this side's units of these types ignore every flag this turn */
  | { kind: "ignoreFlags"; unitTypes: readonly UnitType[] }
  /** Personal Armor: the unit it's given to ignores its first `hits` hits of this symbol this turn */
  | { kind: "ignoreHits"; face: DieFace; hits: number }
  /** Camouflage: the unit it's given to gets the camouflage badge after the battle */
  | { kind: "camouflage" }
  /** Medic, Mechanic: as the orders are carried out (before the battle), the unit it's given to gets back up to this many figures */
  | { kind: "heal"; figures: number }
  /** Reposition: after the battle, the unit it's given to moves up to this many hexes */
  | { kind: "reposition"; hexes: number }
  /** Concentrated Fire: this side's units that didn't move may fire at the same enemy unit together, in one roll */
  | { kind: "concentratedFire" }
  /** Suppressive Fire: this side's ordered shots may roll the suppressive die (an infantry side is a flag), shot by shot */
  | { kind: "suppressiveFire" }
  /** Rifles Up!: this side's units of these types that moved fire with the units that didn't move */
  | { kind: "firesWithUnmoved"; unitTypes: readonly UnitType[] };

/**
 * +dice on every shot this turn by a unit of these types (Spotter), or by the unit the card is
 * given to (`CombatCard.assign`: Street Equipment, Explosives)
 */
export interface DiceBonusEffect {
  kind: "diceBonus";
  dice: number;
  unitTypes: readonly UnitType[];
  /** Only in close assault (Explosives) */
  closeAssault?: boolean;
  /** Only when it fires from one of these terrains or a hex next to one (Street Equipment: a town) */
  near?: readonly HexType[];
  /** The extra dice aren't thrown: each is added to the roll showing this face (Heat of Battle: a flag) */
  face?: DieFace;
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
  /** It can still fire after the whole move (`maxMove`), where the terrain lets a moved unit fire */
  moveAndFire?: boolean;
  /** It fires before any other unit, whatever the firing order (Behind Enemy Lines) */
  firesFirst?: boolean;
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
