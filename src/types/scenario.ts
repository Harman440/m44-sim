import { HexType } from "./hex";
import { UnitType } from "../game-core/unit";
import { Faction } from "./faction";
import type { SixSidedFace } from "../game-core/dice";

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
  description: string;
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
  /** One side draws 2 command cards instead of 1 after each of its first `turns` turns (Pegasus Bridge: the Germans were surprised) */
  extraDraws?: { faction: Faction; turns: number };
  /**
   * Sides that historically had heavy guns to bombard with: only they get Cortina de Fuego.
   * Both sides when omitted
   */
  bigGuns?: Faction[];
  /**
   * Copies of each air card (Poder aéreo, Bombardeo aéreo) per side: 0 for a side whose enemy
   * has air superiority, more for a side with several air sorties. 1 each when omitted
   */
  airPower?: { allies: number; axis: number };
}
