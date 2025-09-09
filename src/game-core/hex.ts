import { AxialCoord, HexType, MovementRule } from "../types/hex";
import { Position } from "../types/scenario";
import Unit from "./unit";

class Hex {
  position: Position;
  posAxial: AxialCoord;
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

    //convert position to axial
    this.posAxial = this.offsetToAxial(this.position);

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

  getKey() {
    return `${this.position.row}-${this.position.col}`;
  }

  // Game logic methods
  canEnter(unit: Unit | null = null) {
    if (this.movementRule === MovementRule.BLOCK || this.movementCost === Infinity) {
      return false;
    }

    if (this.unit && this.unit !== unit) {
      // Hex is occupied by another unit
      return false;
    }

    //TODO: Add more complex logic here (unit-specific movement rules, etc.)
    return true;
  }

  // Check if a hex is passable
  isPassable(): boolean {
    return this.movementRule !== MovementRule.BLOCK && this.unit === null && this.movementCost < Infinity;
  }

  // Check if a hex allows continued movement
  canContinueMovement(): boolean {
    return this.movementRule !== MovementRule.STOP;
  }

  getMovementCost(unit: Unit | null = null): number {
    //TODO: Could be modified based on unit type
    return this.movementCost;
  }

  // Unit management
  placeUnit(unit: Unit, isSetup: boolean = false): boolean {
    if (this.canEnter(unit)) {
      this.unit = unit;
      //NOTE: unit cant be ordered again when moved
      if (!isSetup) this.unit.orderUnit();
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

  // Convert offset coordinates to axial coordinates
  private offsetToAxial(pos: Position): AxialCoord {
    const q = pos.col - Math.floor((pos.row - (pos.row & 1)) / 2);
    const r = pos.row;
    return { q, r };
  }

  // Convert axial coordinates back to offset coordinates
  private axialToOffset(axial: AxialCoord): Position {
    const row = axial.r;
    const col = axial.q + Math.floor((axial.r - (axial.r & 1)) / 2);
    return { row, col };
  }

  // Get the 6 neighboring hexes in axial coordinates
  private getAxialNeighbors(): AxialCoord[] {
    const directions = [
      { q: 1, r: 0 },   // East
      { q: 1, r: -1 },  // Northeast
      { q: 0, r: -1 },  // Northwest
      { q: -1, r: 0 },  // West
      { q: -1, r: 1 },  // Southwest
      { q: 0, r: 1 }    // Southeast
    ];

    return directions.map(dir => ({
      q: this.posAxial.q + dir.q,
      r: this.posAxial.r + dir.r
    }));
  }

  // Get neighboring positions in offset coordinates
  getNeighbors(): Position[] {
    const axialNeighbors = this.getAxialNeighbors();
    return axialNeighbors.map(neighbor => this.axialToOffset(neighbor));
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
