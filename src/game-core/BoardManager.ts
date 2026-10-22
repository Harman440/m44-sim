import Hex from "./hex";
import Unit, { UnitType } from "./unit";
import { Factions, Position, Scenario } from "../types/scenario";
import { Faction, isFaction } from "../types/faction";
import { HexType, isHexType } from "../types/hex";
import { PathNode, PathResult } from "../types/boardManager";
import { includesPosition, positionKey, samePosition } from "./position";
import { BoardSize, boardSizeOf } from "./boardSize";

/** Terrain rules an action loosens for one unit's move */
export interface MoveRules {
  /** Terrain doesn't stop the move (Armour Forward, Behind Enemy Lines) */
  ignoreTerrain?: boolean;
  /** The unit can still fire after moving into these terrains (House to House, Forest, Rattenkrieg) */
  fireInto?: readonly HexType[];
}

/**
 * A position as seen from the other side of the table: the Axis' board is the Allies' turned
 * round. Doing it twice gives the position back (the board has an odd number of rows)
 */
export const turnedRound = (position: Position, { cols, rows }: BoardSize): Position => {
  const flippedCol = cols - 1 - position.col;
  // Odd rows have one hex fewer
  return { row: rows - 1 - position.row, col: position.row % 2 !== 0 ? flippedCol - 1 : flippedCol };
};

class BoardManager {
  width: number;
  height: number;
  hexes: Map<string, Hex>;

  /**
   * The board as `faction` sees it, with its units. `bothSides` puts the other side's units on it
   * too, with every sandbag: the map editor shows the whole scenario (from the Allies' side)
   */
  constructor(scenario: Scenario, faction: Faction = "Allies", { bothSides = false }: { bothSides?: boolean } = {}) {
    const { cols, rows } = boardSizeOf(scenario);
    this.width = cols;
    this.height = rows;
    this.hexes = new Map(); // Store hexes by "row-col" key

    this.initializeBoard(scenario, faction, bothSides);
  }

  // Initialize the board with default terrain
  private initializeBoard(scenario: Scenario, faction: Faction, bothSides: boolean) {
    // Factions can come from a saved game, so check even though the type says so
    if (!isFaction(faction)) throw new Error(`Invalid faction: ${faction}`);

    // Axis sees the board turned round
    const flipPosition = (position: Position): Position =>
      faction === "Axis" ? turnedRound(position, this.size) : position;

    // Initialize hexes with default terrain
    for (let row = 0; row < this.height; row++) {
      // Delete hexe if row is odd
      const actualMaxWidth = this.width + (row % 2 === 1 ? -1 : 0);
      for (let col = 0; col < actualMaxWidth; col++) {
        const position: Position = { row, col };
        const hex = new Hex(position, HexType.PLAINS);
        this.hexes.set(hex.getKey(), hex);
      }
    }

    // Place scenario tiles (flipped for Axis). A board file is JSON, so check its terrain names
    for (const [tileType, positions] of Object.entries(scenario.tiles)) {
      if (!isHexType(tileType)) throw new Error(`Unknown terrain: ${tileType}`);
      positions.forEach((originalPosition) => {
        const position = flipPosition(originalPosition);
        if (this.isValidPosition(position)) {
          const tile = new Hex(position, tileType, !!scenario.fordableRivers);
          this.hexes.set(tile.getKey(), tile);
        }
      });
    }

    // Barbed wire (flipped for Axis)
    (scenario.wire ?? []).forEach((position) => this.getHex(flipPosition(position))?.setWire(true));

    // Place initial units (flipped for Axis)
    const factionKey = faction.toLowerCase() as keyof Factions;
    const sides: (keyof Factions)[] = bothSides ? ["allies", "axis"] : [factionKey];
    const unitGroups = sides.flatMap((side) => Object.entries(scenario.units[side]));

    for (const [unitType, positions] of unitGroups) {
      const typedUnitType = unitType as UnitType;
      positions.forEach((originalPosition) => {
        const position = flipPosition(originalPosition);
        if (this.isValidPosition(position)) {
          const unit = new Unit(typedUnitType, includesPosition(scenario.elite ?? [], originalPosition));

          const hex: Hex | null = this.getHex(position);
          if (!hex) {
            throw new Error(
              `No hex found at row=${position.row}, col=${position.col}`
            );
          }
          hex.placeUnit(unit);
        }
      });
    }

    // Sandbags, only on this side's units: the enemy's can't be known once the game starts
    (scenario.sandbags ?? []).forEach((position) => {
      const hex = this.getHex(flipPosition(position));
      if (hex?.hasUnit()) hex.setSandbags(true);
    });
  }

  /** The board's size, for turning positions round (`turnedRound`) */
  get size(): BoardSize {
    return { cols: this.width, rows: this.height };
  }

  // Get hex at specific position
  getHex(position: Position): Hex | null {
    return this.hexes.get(positionKey(position)) || null;
  }

  // Check if position is valid
  private isValidPosition(position: Position): boolean {
    const actualMaxWidth = this.width + (position.row % 2 === 1 ? -1 : 0);
    return (
      position.row >= 0 &&
      position.row < this.height &&
      position.col >= 0 &&
      position.col < actualMaxWidth
    );
  }

  // Get all hexes
  getAllHexes() {
    return Array.from(this.hexes.values());
  }

  /**
   * Every hex a unit at `startHex` can reach within `maxRange`, with the
   * cheapest path to each (Dijkstra; every hex costs 1). Stop terrain and barbed wire end
   * movement; with `forFirePositions`, only destinations the unit can still fire from.
   * A hedgerow can only be entered by a unit that starts next to it, and a
   * unit that starts on one (or on a swamp) moves 1 hex; a move that starts on
   * a beach or enters one is 2 hexes at most, whatever cards add (data/terrain.ts).
   * `rules` loosens terrain for combat cards (Armor Forward, House to House…).
   */
  calculatePossibleMovesWithPaths = (
    startHex: Hex,
    maxRange: number,
    forFirePositions: boolean = false,
    rules: MoveRules = {}
  ): PathResult[] => {
    const canFireFrom = (hex: Hex) => hex.getTerrain().fireAfterMove || (rules.fireInto?.includes(hex.getType()) ?? false);
    const startPos = startHex.getPosition();
    const hedgerowRules = !rules.ignoreTerrain;
    if (hedgerowRules && startHex.getTerrain().leaveOneHex) maxRange = Math.min(maxRange, 1);

    // The longest a move can be once it has been on a hex (a beach), cards or not
    const capOf = (hex: Hex, cap: number | undefined) => {
      const through = hex.getTerrain().moveThrough;
      return through === undefined ? cap : Math.min(cap ?? Infinity, through);
    };
    // A sorted array is plenty for a 117-hex board
    const queue: PathNode[] = [
      {
        position: startPos,
        cost: 0,
        canContinue: true,
        path: [startPos], // Initialize with start position
        cap: capOf(startHex, undefined),
      },
    ];

    // Track visited positions and their costs, apart for each cap: a capped path to a hex mustn't
    // hide a longer-reaching one
    const visited = new Map<string, number>();
    const stateOf = (hex: Hex, cap: number | undefined) => `${positionKey(hex.getPosition())}|${cap ?? ""}`;
    const reachableResults: PathResult[] = [];
    const reached = new Set<string>();

    while (queue.length > 0) {
      // Sort queue by cost (simple priority queue implementation)
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const currentHex = this.getHex(current.position)!;

      // Skip if we've already visited this position with a lower cost
      const state = stateOf(currentHex, current.cap);
      if (visited.has(state) && visited.get(state)! <= current.cost) {
        continue;
      }

      visited.set(state, current.cost);
      const range = Math.min(maxRange, current.cap ?? Infinity);

      // Add to reachable positions if within range (excluding start position), the cheapest path to each
      const key = positionKey(current.position);
      if (
        current.cost > 0 &&
        current.cost <= range &&
        !reached.has(key) &&
        (forFirePositions ? canFireFrom(currentHex) : true)
      ) {
        reached.add(key);
        reachableResults.push({
          position: current.position,
          cost: current.cost,
          path: [...current.path], // Copy the path
        });
      }

      // Don't explore further if this hex stops movement or we're at max range
      if (!current.canContinue || current.cost >= range) {
        continue;
      }

      // Explore neighbors
      const neighbors: Position[] = currentHex.getNeighbors();

      for (const neighborPos of neighbors) {
        const neighborHex = this.getHex(neighborPos);

        // Skip if hex doesn't exist on board or is impassable
        if (!neighborHex || !neighborHex.isPassable()) {
          continue;
        }
        if (hedgerowRules && neighborHex.getTerrain().firstStepOnly && current.cost > 0) {
          continue;
        }

        const newCost = current.cost + 1;
        const cap = capOf(neighborHex, current.cap);

        // Skip if this path is more expensive than max range, or than the terrain it's been on allows
        if (newCost > Math.min(maxRange, cap ?? Infinity)) {
          continue;
        }

        // Skip if we've already found a cheaper path to this neighbor
        const next = stateOf(neighborHex, cap);
        if (visited.has(next) && visited.get(next)! <= newCost) {
          continue;
        }

        // Add neighbor to queue with extended path
        queue.push({
          position: neighborPos,
          cost: newCost,
          // A card that ignores terrain doesn't lift barbed wire: the unit still stops there
          canContinue: rules.ignoreTerrain ? !neighborHex.wire : neighborHex.canContinueMovement(),
          path: [...current.path, neighborPos], // Extend the path
          cap,
        });
      }
    }

    return reachableResults;
  };

  /**
   * Whether a unit at `startHex` may move along `path` (its first hex the start, each next one
   * beside the last, none twice) within `maxRange`, by the same rules as
   * `calculatePossibleMovesWithPaths`; with `forFirePositions`, and still fire at its end
   */
  followsPath = (
    startHex: Hex,
    path: readonly Position[],
    maxRange: number,
    forFirePositions: boolean = false,
    rules: MoveRules = {}
  ): boolean => {
    const startPos = startHex.getPosition();
    if (path.length < 2 || !samePosition(path[0]!, startPos)) return false;
    if (new Set(path.map(positionKey)).size !== path.length) return false;
    const hedgerowRules = !rules.ignoreTerrain;
    if (hedgerowRules && startHex.getTerrain().leaveOneHex) maxRange = Math.min(maxRange, 1);
    const capOf = (hex: Hex, cap: number | undefined) => {
      const through = hex.getTerrain().moveThrough;
      return through === undefined ? cap : Math.min(cap ?? Infinity, through);
    };

    let current = startHex;
    let cap = capOf(startHex, undefined);
    let canContinue = true;
    for (let cost = 1; cost < path.length; cost++) {
      const position = path[cost]!;
      const hex = this.getHex(position);
      if (!canContinue || !hex || !hex.isPassable()) return false;
      if (!current.getNeighbors().some((neighbor) => samePosition(neighbor, position))) return false;
      if (hedgerowRules && hex.getTerrain().firstStepOnly && cost > 1) return false;
      cap = capOf(hex, cap);
      if (cost > Math.min(maxRange, cap ?? Infinity)) return false;
      canContinue = rules.ignoreTerrain ? !hex.wire : hex.canContinueMovement();
      current = hex;
    }
    return !forFirePositions || current.getTerrain().fireAfterMove || (rules.fireInto?.includes(current.getType()) ?? false);
  };

  // Method to get all paths as a Map for quick lookup
  getAllPaths = (
    startHex: Hex,
    maxRange: number,
    forFirePositions: boolean = false,
    rules: MoveRules = {}
  ): Map<string, Position[]> => {
    const results = this.calculatePossibleMovesWithPaths(startHex, maxRange, forFirePositions, rules);
    const pathMap = new Map<string, Position[]>();

    results.forEach((result) => pathMap.set(positionKey(result.position), result.path));

    return pathMap;
  };

  // Move unit from one hex to another
  moveUnit(fromPosition: Position, toPosition: Position): boolean {
    const fromHex = this.getHex(fromPosition);
    const toHex = this.getHex(toPosition);
    const unit = fromHex?.unit;

    if (!fromHex || !toHex || !unit) return false;

    if (!toHex.canEnter(unit)) return false;

    fromHex.removeUnit();
    toHex.placeUnit(unit);
    return true;
  }

  /** Take the unit off a hex (e.g. destroyed in battle); returns it, or null if the hex was empty */
  removeUnitAt(position: Position): Unit | null {
    const hex = this.getHex(position);
    const unit = hex?.unit ?? null;
    if (unit) hex!.removeUnit();
    return unit;
  }

  /** Hexes with barbed wire, in board order */
  wirePositions(): Position[] {
    return this.getAllHexes()
      .filter((hex) => hex.wire)
      .map((hex) => hex.getPosition());
  }

  /** Hexes with sandbags, in board order */
  sandbagPositions(): Position[] {
    return this.getAllHexes()
      .filter((hex) => hex.sandbags)
      .map((hex) => hex.getPosition());
  }

  /** Put a unit back on an empty hex */
  placeUnitAt(position: Position, unit: Unit): boolean {
    return this.getHex(position)?.placeUnit(unit) ?? false;
  }
}

export default BoardManager;
