import Hex from "./hex";
import Unit, { UnitType } from "./unit";
import { Factions, Position, Scenario } from "../types/scenario";
import { Faction, isFaction } from "../types/faction";
import { HexType, Side } from "../types/hex";
import { PathNode, PathResult } from "../types/boardManager";
import CommandCard, { CommandCardType } from "./commandCard";
import { positionKey } from "./position";

class BoardManager {
  width: number;
  height: number;
  hexes: Map<string, Hex>;
  sideHexes: Map<Side, Hex[]>;

  constructor(scenario: Scenario, faction: Faction = "Allies", width = 13, height = 9) {
    this.width = width;
    this.height = height;
    this.hexes = new Map(); // Store hexes by "row-col" key
    this.sideHexes = new Map();

    this.initializeBoard(scenario, faction);
    this.initializeSideHexes();
  }

  // Initialize the board with default terrain
  private initializeBoard(scenario: Scenario, faction: Faction) {
    // Factions can come from a saved game, so check even though the type says so
    if (!isFaction(faction)) throw new Error(`Invalid faction: ${faction}`);

    // Helper function to flip positions for Axis faction
    const flipPosition = (position: Position): Position => {
      if (faction === "Axis") {
        const flippedRow = this.height - 1 - position.row;
        const flippedCol = this.width - 1 - position.col;

        // Adjust column depending on row parity after flipping
        const needsShift = position.row % 2 !== 0;

        return {
          row: flippedRow,
          col: needsShift ? flippedCol - 1 : flippedCol,
        };
      }
      return position;
    };

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

    // Place scenario tiles (flipped for Axis)
    for (const [tileType, positions] of Object.entries(scenario.tiles)) {
      positions.forEach((originalPosition) => {
        const position = flipPosition(originalPosition);
        if (this.isValidPosition(position)) {
          const hexType = tileType as HexType;
          const tile = new Hex(position, hexType);
          this.hexes.set(tile.getKey(), tile);
        }
      });
    }

    // Place initial units (flipped for Axis)
    const factionKey = faction.toLowerCase() as keyof Factions;
    const unitGroups = scenario.units[factionKey];

    for (const [unitType, positions] of Object.entries(unitGroups)) {
      const typedUnitType = unitType as UnitType;
      positions.forEach((originalPosition) => {
        const position = flipPosition(originalPosition);
        if (this.isValidPosition(position)) {
          const unit = new Unit(typedUnitType);

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
  }

  // --- initialize side groups at startup
  private initializeSideHexes(): void {
    Object.values(Side).forEach((side) => {
      const hexesForSide = this.getHexesBySide(side);
      this.sideHexes.set(side, hexesForSide);
    });
  }

  // --- get all hexes of a given side
  private getHexesBySide(side: Side): Hex[] {
    return Array.from(this.hexes.values()).filter(
      (hex) => hex.getSide() === side
    );
  }

  getHexesForSide(sides: Side | Side[]): Hex[] {
    const sideArray = Array.isArray(sides) ? sides : [sides];

    return sideArray.flatMap((side) => this.sideHexes.get(side) ?? []);
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
   * cheapest path to each (Dijkstra). Stop terrain ends movement; with
   * `forFirePositions`, only destinations the unit can still fire from.
   */
  calculatePossibleMovesWithPaths = (
    startHex: Hex,
    maxRange: number,
    forFirePositions: boolean = false
  ): PathResult[] => {
    const startPos = startHex.getPosition();

    // A sorted array is plenty for a 117-hex board
    const queue: PathNode[] = [
      {
        position: startPos,
        cost: 0,
        canContinue: true,
        path: [startPos], // Initialize with start position
      },
    ];

    // Track visited positions and their costs
    const visited = new Map<Hex, number>();
    const reachableResults: PathResult[] = [];

    while (queue.length > 0) {
      // Sort queue by cost (simple priority queue implementation)
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const currentHex = this.getHex(current.position)!;

      // Skip if we've already visited this position with a lower cost
      if (visited.has(currentHex) && visited.get(currentHex)! <= current.cost) {
        continue;
      }

      visited.set(currentHex, current.cost);

      // Add to reachable positions if within range (excluding start position)
      if (
        current.cost > 0 &&
        current.cost <= maxRange &&
        (forFirePositions ? currentHex.getCanMoveAndFire() : true)
      ) {
        reachableResults.push({
          position: current.position,
          cost: current.cost,
          path: [...current.path], // Copy the path
        });
      }

      // Don't explore further if this hex stops movement or we're at max range
      if (!current.canContinue || current.cost >= maxRange) {
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

        const movementCost = neighborHex.getMovementCost();
        const newCost = current.cost + movementCost;

        // Skip if this path is more expensive than max range
        if (newCost > maxRange) {
          continue;
        }

        // Skip if we've already found a cheaper path to this neighbor
        if (visited.has(neighborHex) && visited.get(neighborHex)! <= newCost) {
          continue;
        }

        // Add neighbor to queue with extended path
        queue.push({
          position: neighborPos,
          cost: newCost,
          canContinue: neighborHex.canContinueMovement(),
          path: [...current.path, neighborPos], // Extend the path
        });
      }
    }

    return reachableResults;
  };

  // Method to get all paths as a Map for quick lookup
  getAllPaths = (
    startHex: Hex,
    maxRange: number,
    forFirePositions: boolean = false
  ): Map<string, Position[]> => {
    const results = this.calculatePossibleMovesWithPaths(
      startHex,
      maxRange,
      forFirePositions
    );
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

  /** Put a unit back on an empty hex */
  placeUnitAt(position: Position, unit: Unit): boolean {
    return this.getHex(position)?.placeUnit(unit) ?? false;
  }

  removeOrders() {
    this.getAllHexes().forEach((hex) => {
      if (hex.unit) {
        hex.unit.clearOrder();
      }
    });
  }

  setOrderableUnits(commandCard: CommandCard): number {
    // Start from a clean slate so a previous card's units don't stay orderable
    this.setUnitsNotOrderable();

    let sides: Side[] = [];
    let filterFn: ((unit: Unit) => boolean) | null = null;

    switch (commandCard.type) {
      case CommandCardType.LEFT:
        sides = [Side.LEFT, Side.LEFT_CENTER];
        break;
      case CommandCardType.CENTER:
        sides = [Side.CENTER, Side.LEFT_CENTER, Side.RIGHT_CENTER];
        break;
      case CommandCardType.RIGHT:
        sides = [Side.RIGHT, Side.RIGHT_CENTER];
        break;
      case CommandCardType.ALLSIDES:
        sides = [Side.LEFT, Side.LEFT_CENTER, Side.CENTER, Side.RIGHT_CENTER, Side.RIGHT];
        break;
      case CommandCardType.INFANTRY:
        filterFn = (u) => u.getUnitType() === UnitType.INFANTRY;
        break;
      case CommandCardType.TANK:
        filterFn = (u) => u.getUnitType() === UnitType.TANK;
        break;
      case CommandCardType.ARTILLERY:
        filterFn = (u) => u.getUnitType() === UnitType.ARTILLERY;
        break;
      case CommandCardType.ALL:
        filterFn = () => true;
        break;
      default:
        return 0;
    }

    // Collect hexes based on type
    const hexes =
      sides.length > 0 ? this.getHexesForSide(sides) : this.getAllHexes();

    let count = 0;

    // Iterate and mark orderable
    hexes.forEach((hex) => {
      const unit = hex.unit;
      if (!unit) return;

      if (!filterFn || filterFn(unit)) {
        unit.setOrderable(true);
        count++;
      }
    });

    // The card's order count, capped at the units it can actually order
    return Math.min(commandCard.maxTotalOrders, count);
  }

  setUnitsNotOrderable() {
    this.getAllHexes().forEach((hex) => {
      if (hex.unit) {
        hex.unit.setOrderable(false);
      }
    });
  }
}

export default BoardManager;
