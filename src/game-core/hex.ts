import { AxialCoord, HexType, MovementRule, Side, TerrainProperties } from "../types/hex";
import { Position } from "../types/scenario";
import { positionKey } from "./position";
import Unit from "./unit";

class Hex {
  private readonly position: Position;
  private readonly posAxial: AxialCoord;
  private readonly side: Side;
  private readonly type: HexType;
  private readonly movementRule: MovementRule;
  private readonly movementCost: number;
  private readonly canMoveAndFire: boolean;

  private _unit: Unit | null = null;

  constructor(position: Position, type: HexType = HexType.PLAINS, overrides?: Partial<TerrainProperties>) {
    this.position = position;
    this.type = type;

    // Convert position to axial
    this.posAxial = this.offsetToAxial(this.position);

    //get the side of the hex
    this.side = this._setSide(this.position);

    // Get terrain properties and apply any overrides
    const terrainProps = this._getTerrainProperties(type);
    const finalProps = { ...terrainProps, ...overrides };

    // Set readonly properties
    this.movementRule = finalProps.movementRule;
    this.movementCost = finalProps.movementCost;
    this.canMoveAndFire = finalProps.canMoveAndFire;
  }

  private _setSide(pos: Position): Side {
    switch (true) {
      case pos.col <= 3 && pos.row % 2 === 0 || pos.col <= 2 && pos.row % 2 === 1:
        return Side.LEFT;
      case pos.col === 3 && pos.row % 2 === 1:
        return Side.LEFT_CENTER;
      case pos.col <= 8 && pos.row % 2 === 0 || pos.col <= 7 && pos.row % 2 === 1:
        return Side.CENTER;
      case pos.col === 8 && pos.row % 2 === 1:
        return Side.RIGHT_CENTER;
      default:
        return Side.RIGHT;
    }
  }

  private _getTerrainProperties(type: HexType): TerrainProperties {
    switch (type) {
      case HexType.PLAINS:
        return {
          movementRule: MovementRule.NORMAL,
          canMoveAndFire: true,
          movementCost: 1
        };

      case HexType.FOREST:
        return {
          movementRule: MovementRule.STOP,
          canMoveAndFire: false,
          movementCost: 1
        };

      case HexType.HILL:
        return {
          movementRule: MovementRule.NORMAL,
          canMoveAndFire: true,
          movementCost: 1
        };

      case HexType.TOWN:
        return {
          movementRule: MovementRule.STOP,
          canMoveAndFire: false,
          movementCost: 1
        };

      default:
        return {
          movementRule: MovementRule.NORMAL,
          canMoveAndFire: true,
          movementCost: 1
        };
    }
  }

  // Getters for readonly properties
  getPosition(): Position { return this.position; }
  getPosAxial(): AxialCoord { return this.posAxial; }
  getSide(): Side { return this.side; }
  getType(): HexType { return this.type; }
  getMovementRule(): MovementRule { return this.movementRule; }
  getMovementCost(): number { return this.movementCost; }
  getCanMoveAndFire(): boolean { return this.canMoveAndFire; }

  getKey() {
    return positionKey(this.position);
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

  get unit(): Unit | null { return this._unit; }

  // Unit management
  placeUnit(unit: Unit): boolean {
    if (this.canEnter(unit)) {
      this._unit = unit;
      return true;
    }
    return false;
  }

  hasUnit(): this is { unit: Unit } {
    return this._unit !== null;
  }

  removeUnit() {
    this._unit = null;
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
}

export default Hex;
