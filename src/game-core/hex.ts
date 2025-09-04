import { HexType, MovementRule } from "../data/types/hex";
import { Position } from "../data/types/scenario";
import Unit from "./unit";

class Hex {
  position: Position;
  type: HexType;
  movementRule: MovementRule;
  movementCost: number;
  color: string;
  name: string;
  unit: Unit | null;

  constructor(
    position: Position,
    type: HexType = HexType.PLAINS,
    movementRule: MovementRule = MovementRule.NORMAL,
    movementCost: number = 1,
    color: string = "#90EE90",
    name: string = "Plains",
    unit: Unit | null = null
  ) {
    this.position = position;
    this.type = type;
    this.movementRule = movementRule;
    this.movementCost = movementCost;
    this.color = color;
    this.name = name;
    this.unit = unit; // Unit occupying this hex
    // Set properties based on terrain type
    this._setTerrainProperties();
  }

  private _setTerrainProperties() {
    switch (this.type) {
      case HexType.PLAINS:
        this.movementRule = MovementRule.NORMAL;
        this.movementCost = 1;
        this.color = "#90EE90"; // Light green
        this.name = "Plains";
        break;

      case HexType.FOREST:
        this.movementRule = MovementRule.STOP;
        this.movementCost = 1;
        this.color = "#228B22"; // Forest green
        this.name = "Forest";
        break;

      case HexType.HILL:
        this.movementRule = MovementRule.NORMAL;
        this.movementCost = 1;
        this.color = "#8B4513"; // Saddle brown
        this.name = "Hill";
        break;

      case HexType.TOWN:
        this.movementRule = MovementRule.STOP;
        this.movementCost = 1;
        this.color = "#FFD700"; // Gold
        this.name = "Town";
        break;

      default:
        this.movementCost = 1;
        this.color = "#90EE90";
        this.name = "Plains";
    }
  }

  // Game logic methods
  canEnter(unit: Unit | null = null) {
    if (this.movementRule === MovementRule.BLOCK) {
      return false;
    }

    if (this.unit && this.unit !== unit) {
      // Hex is occupied by another unit
      return false;
    }

    //TODO: Add more complex logic here (unit-specific movement rules, etc.)
    return true;
  }

  mustStop() {
    return this.movementRule === MovementRule.STOP;
  }

  getMovementCost(unit: Unit | null = null) {
    // Could be modified based on unit type
    return this.movementCost;
  }

  // Unit management
  placeUnit(unit: Unit) {
    if (this.canEnter(unit)) {
      this.unit = unit;
      return true;
    }
    return false;
  }

  hasUnit(): this is { unit: Unit } {
    return this.unit !== null;
  }

  getUnit(): Unit | null {
    return this.unit;
  }

  removeUnit() {
    this.unit = null;
  }

  // Utility methods
  getCoordinates() {
    return { row: this.position.row, col: this.position.col };
  }

  getKey() {
    return `${this.position.row}-${this.position.col}`;
  }

  isAdjacent(otherHex: Hex) { //TODO: use to calculate possible paths faster maybe?
    const dr = Math.abs(this.position.row - otherHex.position.row);
    const dc = Math.abs(this.position.col - otherHex.position.col);

    // Hexagonal grid adjacency logic
    if (this.position.row % 2 === 0) {
      // Even row
      return (dr === 1 && (dc === 0 || dc === 1)) || (dr === 0 && dc === 1);
    } else {
      // Odd row
      return (dr === 1 && (dc === -1 || dc === 0)) || (dr === 0 && dc === 1);
    }
  }

  getDistance(otherHex: Hex) {//TODO: this works better but pathfinding method must be used to move take into account inpassable hexes
    // Convert offset coordinates to cube coordinates for accurate hex distance
    const fromCube = this.offsetToCube(this.position.col, this.position.row);
    const toCube = this.offsetToCube(otherHex.position.col, otherHex.position.row);
    
    // Calculate Manhattan distance in cube coordinates, then divide by 2
    return (Math.abs(fromCube.x - toCube.x) + 
            Math.abs(fromCube.y - toCube.y) + 
            Math.abs(fromCube.z - toCube.z)) / 2;
  }

  // Helper method to convert offset coordinates to cube coordinates
  offsetToCube(col: number, row: number) {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    const y = -x - z;
    return { x, y, z };
  }

  // Description for UI
  getDescription() {
    let desc = `${this.name} (${this.position.row}, ${this.position.col})`;

    if (this.unit) {
      desc += ` - Occupied by ${this.unit.unitType || "Unit"}`;
    }

    return desc;
  }

  // For debugging
  toString() {
    return `Hex[${this.position.row},${this.position.col}]:${this.type}`;
  }
}

export default Hex;
