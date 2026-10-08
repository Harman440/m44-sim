import { HexType } from "./hex";
import { UnitType } from "../game-core/unit";
import { Faction } from "./faction";
import type { SixSidedFace } from "../game-core/dice";
import type { Localized } from "../i18n/lang";

// src/types/scenario.ts
export interface Position {
  row: number;
  col: number;
}

export type Tiles = Partial<Record<HexType, Position[]>>;
/*Keys must be valid unit types ("infantry" | "artillery" | "tank").
But each key is optional (Partial).*/
export type UnitGroup = Partial<Record<UnitType, Position[]>>;

export interface Factions {
  allies: UnitGroup;
  axis: UnitGroup;
}

export interface Scenario {
  id: string;
  name: string;
  description: Localized;
  /** Board artwork drawn under the hexes (imported asset URL) */
  image?: string;
  /** Command cards each side starts with */
  initialHandSize: { allies: number; axis: number };
  /** The side that normally starts; it plays one extra turn before the defender joins in */
  attacker: Faction;
  tiles: Tiles;
  units: Factions;
  /** Reinforcements card: the unit each die face brings onto this map (null: no reinforcements) */
  reinforcements?: Record<SixSidedFace, UnitType | null>;
  /**
   * Units one side drops on the table before the game starts (Sainte-Mère-Église); that
   * side's app first asks where they landed. Units off the board or on another unit are lost.
   */
  paradrop?: { faction: Faction; unitType: UnitType; units: number };
  /** Hexes with barbed wire: a unit that enters one stops; infantry on it fires with a die less or removes it */
  wire?: Position[];
  /**
   * Hexes with sandbags at the start (either side's units; each side's app shows only its own):
   * the unit there ignores 1 flag and, in the open, infantry and armour fire at it with a die
   * less. They go when the unit leaves the hex
   */
  sandbags?: Position[];
  /**
   * Hexes of the units that start as elite (either side's; a badge on the table): they move
   * their whole move and still fire (elite infantry moves 2 and fires)
   */
  elite?: Position[];
  /** One side draws 2 command cards instead of 1 after each of its first `turns` turns (Pegasus Bridge: the Germans were surprised) */
  extraDraws?: { faction: Faction; turns: number };
  /**
   * Sides that get Cortina de Fuego. Omitted (both sides) unless the scenario, or the player's
   * own ruling, says a side has no heavy guns
   */
  bigGuns?: Faction[];
  /**
   * Copies of each air card (Poder aéreo, Bombardeo aéreo) per side: one per air sortie the
   * scenario gives the side, 0 for a side whose enemy has air superiority. 1 each when omitted
   */
  airPower?: { allies: number; axis: number };
}
