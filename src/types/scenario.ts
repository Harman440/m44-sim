import { HexType } from "./hex";

// src/types/scenario.ts
export interface Position {
  row: number;
  col: number;
}

export type UnitType = "infantry" | "artillery" | "tank"; 

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
  tiles: Tiles;
  units: Factions;
}

export interface ScenarioSettings { //TODO: init in scenario data and use when setting up
  initNumCommandCards: number;
}
