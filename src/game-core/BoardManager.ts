import Hex from './hex';
import { scenarios } from '../data/scenarios';
import Unit from './unit';
import { Factions, Position, Scenario, UnitType } from '../types/scenario.js';
import { HexType } from '../types/hex';
import { PathNode } from '../types/boardManager';

class BoardManager {
  width: number;
  height: number;
  hexes: Map<string, Hex>;
  units: Unit[];

  constructor(scenarioId = "forest-blitz", faction = "Allies", width = 13, height = 9) {
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
      // Delete hexe if row is odd
      const actualMaxWidth = this.width + (row % 2 === 1 ? -1 : 0);
      for (let col = 0; col < actualMaxWidth; col++) {
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
          tile.placeUnit(unit, true);
        }
      });
    }
  }

  // Get hex at specific position
  getHex(position: Position): Hex | null {
    return this.hexes.get(`${position.row}-${position.col}`) || null;
  }

  // Check if position is valid
  private isValidPosition(position: Position): boolean {
    const actualMaxWidth = this.width + (position.row % 2 === 1 ? -1 : 0);
    return position.row >= 0 && position.row < this.height && position.col >= 0 && position.col < actualMaxWidth;
  }

  // Get all hexes
  getAllHexes() {
    return Array.from(this.hexes.values());
  }

  // Get hexes of specific type
  getHexesByType(type: HexType): Hex[] {
    return this.getAllHexes().filter(hex => hex.type === type);
  }

  // Helper function to calculate possible moves using your Hex distance method
  calculatePossibleMoves = (startHex: Hex, unit: Unit): Position[] => {
    console.log(`Calculating possible moves for unit ${unit.unitType} at hex ${startHex.position}`);
    const startPos = startHex.position;
    const maxRange = unit.maxMove;
    
    //TODO: Priority queue implemented with array (for simplicity). In production, consider using a proper priority queue for better performance
    const queue: PathNode[] = [{
      position: startPos,
      cost: 0,
      canContinue: true
    }];

    // Track visited positions and their costs
    const visited = new Map<Hex, number>();
    const reachablePositions: Position[] = [];

    while (queue.length > 0) {
      // Sort queue by cost (simple priority queue implementation)
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift()!;
      const currentHex = this.getHex(current.position)!;

      //const currentKey = this.positionToKey(current.position);
      
      // Skip if we've already visited this position with a lower cost
      if (visited.has(currentHex) && visited.get(currentHex)! <= current.cost) {
        continue;
      }

      visited.set(currentHex, current.cost);

      // Add to reachable positions if within range (excluding start position)
      if (current.cost > 0 && current.cost <= maxRange) {
        reachablePositions.push(current.position);
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

        // Add neighbor to queue
        queue.push({
          position: neighborPos,
          cost: newCost,
          canContinue: neighborHex.canContinueMovement()
        });
      }
    }
    console.log("DEBUG: Possible moves:", reachablePositions);
    return reachablePositions;
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