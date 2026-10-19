import { HexType } from "./hex";
import { UnitType } from "../game-core/unit";
import { Faction } from "./faction";
import type { Localized } from "../i18n/lang";
import type { BoardSize } from "../game-core/boardSize";

// src/types/scenario.ts
export interface Position {
  row: number;
  col: number;
}

export type Tiles = Partial<Record<HexType, Position[]>>;

/**
 * A hex whose painted tile was picked in the map editor: `tile` is the file's name, without
 * ".webp", in its terrain's folder of the tile library (scripts/board-art/tiles/town/village-3.webp
 * is "village-3"). The art of a hex left out, or of a tile the library hasn't got, is picked by the hex
 */
export interface PickedTile extends Position {
  tile: string;
}
/*Keys must be valid unit types ("infantry" | "artillery" | "tank").
But each key is optional (Partial).*/
export type UnitGroup = Partial<Record<UnitType, Position[]>>;

export interface Factions {
  allies: UnitGroup;
  axis: UnitGroup;
}

export interface Scenario {
  /** Lower case words joined by hyphens (`pegasus-bridge`); saves and the catalog find the scenario by it */
  id: string;
  name: Localized;
  description: Localized;
  /** Where the scenario comes from and the rulings made for it; kept in its file, not shown */
  notes?: string;
  /** Board artwork drawn under the hexes (imported asset URL) */
  image?: string;
  /**
   * A board bigger than the standard 13×9, grown in the map editor (game-core/boardSize.ts).
   * Omitted for the standard board. Positions are counted from its top left as on any board
   */
  board?: BoardSize;
  /** Command cards each side starts with */
  initialHandSize: { allies: number; axis: number };
  /** The side that normally starts; it plays one extra turn before the defender joins in */
  attacker: Faction;
  tiles: Tiles;
  /** The painted tiles picked for some hexes (towns) in the map editor; the others are picked by the hex */
  pickedTiles?: PickedTile[];
  units: Factions;
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
  /**
   * How the scenario is won (pass and play, where the app knows both armies): the first side to
   * `medals` medals at the end of a turn. Each enemy unit destroyed is a medal; each objective
   * hex is a medal for its side while one of the side's units stands on it at the end of a turn.
   * Without it, the game goes on until the players stop
   */
  victory?: Victory;
}

/** A scenario's victory conditions */
export interface Victory {
  medals: number;
  objectives?: Objective[];
}

/** Hexes worth a medal each to one side while it holds them (a town, a bridge), in the Allies' view */
export interface Objective {
  faction: Faction;
  name: Localized;
  hexes: Position[];
}
