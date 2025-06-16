import Hex, { HexType } from './hex.js';
import scenarios from '../data/scenarios.js';
import Unit from './unit.js';

class BoardManager {
  constructor(scenarioId = "forest-blitz", faction = "Allies", width = 13, height = 9) {//TODO: remove hexes from the side on even column
    this.width = width;
    this.height = height;
    this.hexes = new Map(); // Store hexes by "row-col" key

    this.units = [];
    
    this.initializeBoard(scenarioId, faction);
  }

  // Initialize the board with default terrain
  initializeBoard(scenarioId, faction) {//TODO if Axis faction flip scenario
    const scenario = scenarios.find(s => s.id === scenarioId);
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
          const tile = new Hex(row, col, HexType[tileType.toUpperCase()]);
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
    const factionKey = faction.toLowerCase(); // "allies" or "axis"
    const unitGroups = scenario.units[factionKey];

    for (const [unitType, positions] of Object.entries(unitGroups)) {
      positions.forEach(({ row, col }) => {
        if (this.isValidPosition(row, col)) {
          const unit = new Unit(row, col, unitType);
          this.units.push(unit);

          const tile = this.getHex(row, col);
          tile.placeUnit(unit);
        }
      });
    }
  }

  // Get hex at specific position
  getHex(row, col) {
    return this.hexes.get(`${row}-${col}`);
  }

  // Check if position is valid
  isValidPosition(row, col) {
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }

  // Get all hexes
  getAllHexes() {
    return Array.from(this.hexes.values());
  }

  // Get hexes of specific type
  getHexesByType(type) {
    return this.getAllHexes().filter(hex => hex.type === type);
  }

  // Get adjacent hexes
  getAdjacentHexes(row, col) {//TODO: check if it works. Create Possible movement grid
    const adjacent = [];
    const isEvenRow = row % 2 === 0;
    
    // Hexagonal grid adjacency offsets
    const offsets = isEvenRow 
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
  canMoveTo(fromRow, fromCol, toRow, toCol, unit = null) {//TODO: check if it works. Create Possible movement grid
    const targetHex = this.getHex(toRow, toCol);
    
    if (!targetHex) {
      return false;
    }

    return targetHex.canEnter(unit);
  }

  // Get movement cost between adjacent hexes
  getMovementCost(fromRow, fromCol, toRow, toCol, unit = null) {
    const targetHex = this.getHex(toRow, toCol);
    
    if (!targetHex || !this.canMoveTo(fromRow, fromCol, toRow, toCol, unit)) {
      return Infinity;
    }

    return targetHex.getMovementCost(unit);
  }

  // Check if unit must stop on this hex
  mustStopAt(row, col) {
    const hex = this.getHex(row, col);
    return hex ? hex.mustStop() : false;
  }

  // Place unit on hex
  placeUnit(row, col, unit) {
    const hex = this.getHex(row, col);
    if (hex) {
      return hex.placeUnit(unit);
    }
    return false;
  }

  // Remove unit from hex
  removeUnit(row, col) {
    const hex = this.getHex(row, col);
    if (hex) {
      hex.removeUnit();
      return true;
    }
    return false;
  }

  // Move unit from one hex to another
  moveUnit(fromRow, fromCol, toRow, toCol) {
    const fromHex = this.getHex(fromRow, fromCol);
    const toHex = this.getHex(toRow, toCol);
    
    if (!fromHex || !toHex || !fromHex.hasUnit()) {
      return false;
    }

    const unit = fromHex.unit;
    
    if (toHex.canEnter(unit)) {
      fromHex.removeUnit();
      toHex.placeUnit(unit);
      return true;
    }
    
    return false;
  }

  // Get path between two hexes (simple pathfinding)
  findPath(fromRow, fromCol, toRow, toCol, unit = null) {
    // This is a simplified pathfinding - you might want to implement A* later
    const visited = new Set();
    const queue = [{ row: fromRow, col: fromCol, path: [] }];
    
    while (queue.length > 0) {
      const { row, col, path } = queue.shift();
      const key = `${row}-${col}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (row === toRow && col === toCol) {
        return [...path, { row, col }];
      }
      
      const adjacent = this.getAdjacentHexes(row, col);
      adjacent.forEach(hex => {
        if (!visited.has(hex.getKey()) && hex.canEnter(unit)) {
          queue.push({
            row: hex.row,
            col: hex.col,
            path: [...path, { row, col }]
          });
        }
      });
    }
    
    return null; // No path found
  }

  // Get board statistics
  getStats() {
    const stats = {};
    
    Object.values(HexType).forEach(type => {
      stats[type] = this.getHexesByType(type).length;
    });
    
    return stats;
  }

  // Reset board to initial state
  reset() {
    this.hexes.clear();
    this.initializeBoard();
  }
}

export default BoardManager;