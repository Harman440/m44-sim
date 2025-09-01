// src/types/scenario.ts
export interface Position {
  row: number;
  col: number;
}

export type Tiles = Record<string, Position[]>;

export type UnitGroup = Record<string, Position[]>;

export enum Faction {
  Allies = "allies",
  Axis = "axis",
}

export interface Units {
  [Faction.Allies]: UnitGroup;
  [Faction.Axis]: UnitGroup;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tiles: Tiles;
  units: Units;
}
