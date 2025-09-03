import Hex from './hex';
import { scenarios } from '../data/scenarios';
import Unit from './unit';
import { Factions, Position, Scenario, UnitType } from '../data/types/scenario.js';
import { HexType } from '../data/types/hex';

class BoardManager {
  width: number;
  height: number;
  hexes: Map<string, Hex>;
  units: Unit[];

  constructor(scenarioId = "forest-blitz", faction = "Allies", width = 13, height = 9) {//TODO: remove hexes from the side on even column
    this.width = width;
    this.height = height;
    this.hexes = new Map(); // Store hexes by "row-col" key

    this.units = [];
    
    this.initializeBoard(scenarioId, faction);
  }

  // Initialize the board with default terrain
  initializeBoard(scenarioId: string, faction: string) {//TODO if Axis faction flip scenario
    const scenario: Scenario | undefined = scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error(`Scenario '${scenarioId}' not found.`);
      throw new Error(`Scenario '${scenarioId}' not found.`);
    }

    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const hex = new Hex(row, col, HexType.PLAINS);
        this.hexes.set(hex.getKey(), hex);
      }
    }

    for (const [tileType, positions] of Object.entries(scenario.tiles)) {
      positions.forEach(({ row, col }) => {
        if (this.isValidPosition(row, col)) {
          const hexType = tileType as HexType; // directly cast, since enum values are strings
          const tile = new Hex(row, col, hexType);
          this.hexes.set(tile.getKey(), tile);//TODO: does this override hex or create new layer?
        }
      });
    }

    //place initial units
    // Validate faction
    if (!['Allies', 'Axis'].includes(faction)) {
      console.error(`Invalid faction: ${faction}`);
      throw new Error(`Invalid faction: ${faction}`);
    }

    // Choose the correct unit positions
    const factionKey = faction.toLowerCase() as keyof Factions; 
    const unitGroups = scenario.units[factionKey];

    for (const [unitType, positions] of Object.entries(unitGroups)) {
      const typedUnitType = unitType as UnitType;
      positions.forEach(({ row, col }) => {
        if (this.isValidPosition(row, col)) {
          const unit = new Unit(typedUnitType);
          this.units.push(unit);

          const tile: Hex|undefined = this.getHex(row, col);
          if (!tile) {
            throw new Error(`No hex found at row=${row}, col=${col}`);
          }
          tile.placeUnit(unit);
        }
      });
    }
  }

  // Get hex at specific position
  getHex(row: number, col: number): Hex | undefined {
    return this.hexes.get(`${row}-${col}`);
  }

  // Check if position is valid
  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }

  // Get all hexes
  getAllHexes() {
    return Array.from(this.hexes.values());
  }

  // Get hexes of specific type
  getHexesByType(type: HexType): Hex[] {
    return this.getAllHexes().filter(hex => hex.type === type);
  }

  // Get adjacent hexes
  getAdjacentHexes(row: number, col: number) {//TODO: check if it works. Create Possible movement grid
    const adjacent: Hex[] = [];
    const isEvenRow = row % 2 === 0;
    
    // Hexagonal grid adjacency offsets
    const offsets: [number, number][] = isEvenRow 
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]  // Even row
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];   // Odd row

    offsets.forEach(([dr, dc]) => {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (this.isValidPosition(newRow, newCol)) {
        const hex = this.getHex(newRow, newCol);
        if (hex) {
          adjacent.push(hex);
        }
      }
    });

    return adjacent;
  }

  // Movement validation
  canMoveTo(fromRow: number, fromCol: number, toRow: number, toCol: number, unit = null) {//TODO: check if it works. Create Possible movement grid
    const fromHex = this.getHex(fromRow, fromCol);
    const targetHex = this.getHex(toRow, toCol);
    
    if (!targetHex) {
      return false;
    }

    return targetHex.canEnter(unit);
  }

  // Get movement cost between adjacent hexes
  getMovementCost(fromRow: number, fromCol: number, toRow: number, toCol: number, unit = null) {
    const targetHex = this.getHex(toRow, toCol);
    
    if (!targetHex || !this.canMoveTo(fromRow, fromCol, toRow, toCol, unit)) {
      return Infinity;
    }

    return targetHex.getMovementCost(unit);
  }

  // Check if unit must stop on this hex
  mustStopAt(row: number, col: number) {
    const hex = this.getHex(row, col);
    return hex ? hex.mustStop() : false;
  }

  // Place unit on hex
  placeUnit(row: number, col: number, unit: Unit) {
    const hex = this.getHex(row, col);
    if (hex) {
      return hex.placeUnit(unit);
    }
    return false;
  }

  // Remove unit from hex
  removeUnit(row: number, col: number) {
    const hex = this.getHex(row, col);
    if (hex) {
      hex.removeUnit();
      return true;
    }
    return false;
  }

  // Move unit from one hex to another
  moveUnit(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const fromHex = this.getHex(fromRow, fromCol);
    const toHex = this.getHex(toRow, toCol);
    const unit = fromHex?.unit;

    if (!fromHex || !toHex || !unit) return false;

    if (!toHex.canEnter(unit)) return false;

    fromHex.removeUnit();
    toHex.placeUnit(unit);
    return true;
  }

  // Get path between two hexes (simple pathfinding)
  findPath(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    unit: Unit | null = null
  ): Position[] | null {
    type Node = { row: number; col: number; path: Position[] };
    const visited = new Set<string>();
    const queue: Node[] = [{ row: fromRow, col: fromCol, path: [] }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue; // safeguard

      const { row, col, path } = current;
      const key = `${row}-${col}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (row === toRow && col === toCol) {
        return [...path, { row, col }];
      }

      const adjacent = this.getAdjacentHexes(row, col);
      for (const hex of adjacent) {
        if (!visited.has(hex.getKey()) && hex.canEnter(unit)) {
          queue.push({
            row: hex.row,
            col: hex.col,
            path: [...path, { row, col }],
          });
        }
      }
    }

    return null; // No path found
  }

  // Get board statistics
  getStats() {
    const stats: Record<HexType, number> = {
      [HexType.PLAINS]: 0,
      [HexType.FOREST]: 0,
      [HexType.HILL]: 0,
      [HexType.TOWN]: 0,
    };

    Object.values(HexType).forEach(type => {
      stats[type] = this.getHexesByType(type).length;
    });

    return stats;
  }

  // Reset board to initial state
  reset(scenarioId = "forest-blitz", faction = "Allies") {
    this.hexes.clear();
    this.initializeBoard(scenarioId, faction);
  }
}

export default BoardManager;