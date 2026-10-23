// game-core/unitAction.ts
// The actions mode: what a unit can be ordered to do this turn (an action), and how it fires
// each shot (a fire option). The actions and options themselves are data, in
// data/unitActions.ts; game-core/actionRules.ts checks and applies them.
import type { UnitType } from "./unit";
import type { DieKind } from "./dice";
import type { SupplyCost } from "./unitSupplies";
import type { Localized } from "../i18n/lang";

/** What an action does besides moving and firing */
export type ActionEffect =
  /** Back 1 figure, if the unit has lost one */
  | "medic"
  /** A tank figure that's hit but not lost is mended */
  | "mechanic"
  /** Morale back to full */
  | "moraleUp"
  /** The camouflage badge after the battle */
  | "camouflage"
  /** Sandbags on its hex */
  | "fortify"
  /** Ignores the first 2 infantry-symbol hits this turn (as Personal Armor) */
  | "takeCover"
  /** Ammo or shells back (data/unitSupplies.ts RELOAD) */
  | "reload";

/** When an action's shots come in the battle */
export interface ActionFire {
  /** Shots this turn (Artillery Bombardment: 2, each paid on its own) */
  shots: number;
  /**
   * The round it fires in, when not the one its move gives (units that didn't move fire first):
   * "unmoved" fires with the units that didn't move though it moved (No Respite)
   */
  round?: "unmoved";
}

/** An action a unit can be given for the turn */
export interface UnitAction {
  /** Unique across unit types: `<unit type>:<name>` */
  readonly id: string;
  readonly unitType: UnitType;
  readonly name: Localized;
  readonly description: Localized;
  /** The card painting shown with it: a file in src/assets/cards, by its name without `.webp` */
  readonly painting: string;
  readonly cost: SupplyCost;
  /** Hexes it may move, 0 when it stays put */
  readonly move: number;
  /** Hexes it may move and still fire, when fewer than `move` (Move Out: 1) */
  readonly fireMove?: number;
  /** Its move ignores terrain movement limits (battle limits still apply) */
  readonly ignoresTerrain?: boolean;
  /** Hexes it moves after the battle (Behind Enemy Lines) */
  readonly moveAfterBattle?: number;
  /** How it fires, or null when it doesn't */
  readonly fire: ActionFire | null;
  readonly effect?: ActionEffect;
  /** Offered on own tablets too (they don't track morale, so Morale Up isn't) */
  readonly ownTablets: boolean;
}

/** How a unit fires one shot */
export interface FireOption {
  /** Unique across unit types: `<unit type>:<name>` */
  readonly id: string;
  readonly unitType: UnitType;
  readonly name: Localized;
  readonly description: Localized;
  readonly painting: string;
  /** What each shot spends */
  readonly cost: SupplyCost;
  /** Only in close assault (Explosives) */
  readonly closeAssaultOnly?: boolean;
  /** Extra dice in close assault; with `unmoved`, only when the unit didn't move */
  readonly closeAssaultBonus?: { dice: number; unmoved?: boolean };
  /** Rolls the suppressive die: `suppressed()` of the die the shot would roll */
  readonly die?: Extract<DieKind, "suppressive">;
}
