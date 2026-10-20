import { AxialCoord, HexType, MovementRule, Side } from "../types/hex";
import { Position } from "../types/scenario";
import { FORDABLE_RIVER, TERRAIN, TerrainRules } from "../data/terrain";
import { positionKey } from "./position";
import { STANDARD_BOARD, sectionLines } from "./boardSize";
import Unit from "./unit";

const MIRRORED_SIDE: Record<Side, Side> = {
  [Side.LEFT]: Side.RIGHT,
  [Side.LEFT_CENTER]: Side.RIGHT_CENTER,
  [Side.CENTER]: Side.CENTER,
  [Side.RIGHT_CENTER]: Side.LEFT_CENTER,
  [Side.RIGHT]: Side.LEFT,
};

class Hex {
  private readonly position: Position;
  private readonly posAxial: AxialCoord;
  private side: Side;
  private readonly type: HexType;
  /** The board's width, which decides where its sections meet */
  private readonly boardCols: number;

  private _unit: Unit | null = null;
  /** Barbed wire on the hex: removable, so it isn't part of the terrain */
  private _wire = false;
  /** Sandbags on the hex (this side's unit's): they go when the unit leaves */
  private _sandbags = false;
  /** The map's rivers can be forded (`Scenario.fordableRivers`) */
  private readonly fordable: boolean;

  constructor(position: Position, type: HexType = HexType.PLAINS, boardCols: number = STANDARD_BOARD.cols, fordable = false) {
    this.position = position;
    this.type = type;
    this.boardCols = boardCols;
    this.fordable = fordable;

    // Convert position to axial
    this.posAxial = this.offsetToAxial(this.position);

    //get the side of the hex
    this.side = this._setSide(this.position);
  }

  /**
   * Pass and play: the sections as the other end of the table sees them, so a card's left is the
   * same hexes for both sides (the grid's sections are symmetric, so left and right just swap)
   */
  mirrorSections(mirrored: boolean) {
    const side = this._setSide(this.position);
    this.side = mirrored ? MIRRORED_SIDE[side] : side;
  }

  private _setSide(pos: Position): Side {
    // Across the board in hexes: short rows sit half a hex right
    const x = pos.col + (pos.row % 2) / 2;
    const lines = sectionLines(this.boardCols);
    if (x < lines.left) return Side.LEFT;
    if (x === lines.left) return Side.LEFT_CENTER;
    if (x < lines.right) return Side.CENTER;
    if (x === lines.right) return Side.RIGHT_CENTER;
    return Side.RIGHT;
  }

  // Getters for readonly properties
  getPosition(): Position { return this.position; }
  getPosAxial(): AxialCoord { return this.posAxial; }
  getSide(): Side { return this.side; }
  getType(): HexType { return this.type; }
  /** What the terrain does to units moving and firing (data/terrain.ts) */
  getTerrain(): TerrainRules {
    return this.fordable && this.type === HexType.RIVER ? FORDABLE_RIVER : TERRAIN[this.type];
  }

  getKey() {
    return positionKey(this.position);
  }

  // Game logic methods
  canEnter(unit: Unit | null = null) {
    if (this.getTerrain().movement === MovementRule.BLOCK) {
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
    return this.getTerrain().movement !== MovementRule.BLOCK && this.unit === null;
  }

  // Check if a hex allows continued movement: stop terrain and barbed wire end the move
  canContinueMovement(): boolean {
    return this.getTerrain().movement !== MovementRule.STOP && !this._wire;
  }

  get unit(): Unit | null { return this._unit; }

  get wire(): boolean { return this._wire; }

  /** Lay or remove barbed wire (only GameSession and BoardManager call this) */
  setWire(wire: boolean) {
    this._wire = wire;
  }

  get sandbags(): boolean { return this._sandbags; }

  /** Put down or take away sandbags (only GameSession and BoardManager call this) */
  setSandbags(sandbags: boolean) {
    this._sandbags = sandbags;
  }

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
