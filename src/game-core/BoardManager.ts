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
        const position: Position = { row, col };
        const hex = new Hex(position, HexType.PLAINS);
        this.hexes.set(hex.getKey(), hex);
      }
    }

    for (const [tileType, positions] of Object.entries(scenario.tiles)) {
      positions.forEach(position => {
        if (this.isValidPosition(position)) {
          const hexType = tileType as HexType; // directly cast, since enum values are strings
          const tile = new Hex(position, hexType);
          this.hexes.set(tile.getKey(), tile);//NOTE: this will overwrite existing hex
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
      positions.forEach(position => {
        if (this.isValidPosition(position)) {
          const unit = new Unit(typedUnitType);
          this.units.push(unit);

          const tile: Hex | null = this.getHex(position);
          if (!tile) {
            throw new Error(`No hex found at row=${position.row}, col=${position.col}`);
          }
          tile.placeUnit(unit);
        }
      });
    }
  }

  // Get hex at specific position
  getHex(position: Position): Hex | null {
    return this.hexes.get(`${position.row}-${position.col}`) || null;
  }

  // Check if position is valid
  isValidPosition(position: Position): boolean {
    return position.row >= 0 && position.row < this.height && position.col >= 0 && position.col < this.width;
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
  getAdjacentHexes(position: Position) {//TODO: check if it works. Create Possible movement grid
    const adjacent: Hex[] = [];
    const isEvenRow = position.row % 2 === 0;
    
    // Hexagonal grid adjacency offsets
    const offsets: [number, number][] = isEvenRow 
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]  // Even row
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];   // Odd row

    offsets.forEach(([dr, dc]) => {
      const newPosition: Position = { row: position.row + dr, col: position.col + dc };
      
      if (this.isValidPosition(newPosition)) {
        const hex = this.getHex(newPosition);
        if (hex) {
          adjacent.push(hex);
        }
      }
    });

    return adjacent;
  }

  // Movement validation
  canMoveTo(fromPosition: Position, toPosition: Position, unit: Unit | null = null): boolean {
    const fromHex = this.getHex(fromPosition);
    const toHex = this.getHex(toPosition);
    
    if (!fromHex || !toHex || !unit) return false;

    const distance = fromHex.getDistance(toHex);
    const maxMovement = unit.maxMove;

    return distance <= maxMovement && toHex.canEnter(unit);
  }

  // Helper function to calculate possible moves using your Hex distance method
  calculatePossibleMoves = (startHex: Hex, unit: Unit): Position[] => {
    const possibleMoves: Position[] = [];
    
    // Check all hexes on the board for valid moves
    const allHexes = this.getAllHexes();//TODO reduce this to movement range
    
    for (const targetHex of allHexes) {
      // Skip the starting position
      if (targetHex === startHex) continue;

      if (this.canMoveTo(startHex.position, targetHex.position, unit)) {
        possibleMoves.push(targetHex.position);
      }
    }
    
    console.log("DEBUG: Possible moves:", possibleMoves);
    return possibleMoves;
  };

  // Move unit from one hex to another
  moveUnit(fromPosition: Position, toPosition: Position): boolean { //TODO: check if it works
    const fromHex = this.getHex(fromPosition);
    const toHex = this.getHex(toPosition);
    const unit = fromHex?.unit;

    if (!fromHex || !toHex || !unit) return false;

    if (!toHex.canEnter(unit)) return false;

    fromHex.removeUnit();
    toHex.placeUnit(unit);
    return true;
  }

  // Get path between two hexes (simple pathfinding)
  //TODO: check if this works
  findPath(
    fromPosition: Position,
    toPosition: Position,
    unit: Unit | null = null
  ): Position[] | null {
    type Node = { position: Position; path: Position[] };
    const visited = new Set<string>();
    const queue: Node[] = [{ position: fromPosition, path: [] }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue; // safeguard

      const { position, path } = current;
      const key = `${position.row}-${position.col}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (position.row === toPosition.row && position.col === toPosition.col) {
        return [...path, position];
      }

      const adjacent = this.getAdjacentHexes(position);
      for (const hex of adjacent) {
        if (!visited.has(hex.getKey()) && hex.canEnter(unit)) {
          queue.push({
            position: hex.position,
            path: [...path, position],
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