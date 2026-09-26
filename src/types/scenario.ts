import { HexType } from "./hex";
import { UnitType } from "../game-core/unit";
import { Faction } from "./faction";

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
}
