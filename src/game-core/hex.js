// Enum-like objects for tile types and properties
export const HexType = {
  PLAINS: "plains",
  FOREST: "forest",
  HILL: "hill",
  TOWN: "town",
};

export const MovementRule = {
  NORMAL: "normal", // Regular movement
  STOP: "stop", // Unit must stop when entering
  BLOCK: "block", // Unit cannot enter
  SLOW: "slow", // Movement costs extra
};

class Hex {
  constructor(row, col, type = HexType.PLAINS) {
    this.row = row;
    this.col = col;
    this.type = type;
    this.unit = null; // Unit occupying this hex
    // Set properties based on terrain type
    this._setTerrainProperties();
  }

  // Set terrain-specific properties
  _setTerrainProperties() {
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
        this.name = "hill";
        break;

      case HexType.TOWN:
        this.movementRule = MovementRule.STOP;
        this.movementCost = 1;
        this.color = "#FFD700"; // Gold
        this.name = "town";
        break;

      default:
        this.movementCost = 1;
        this.color = "#90EE90";
        this.name = "Plains";
    }
  }

  // Game logic methods
  canEnter(unit) {
    if (this.movementRule === MovementRule.BLOCK) {
      return false;
    }

    if (this.unit && this.unit !== unit) {
      // Hex is occupied by another unit
      return false;
    }

    // Add more complex logic here (unit-specific movement rules, etc.)
    return true;
  }

  mustStop() {
    return this.movementRule === MovementRule.STOP;
  }

  getMovementCost(unit) {
    // Could be modified based on unit type
    return this.movementCost;
  }

  // Unit management
  placeUnit(unit) {
    if (this.canEnter(unit)) {
      this.unit = unit;
      return true;
    }
    return false;
  }

  removeUnit() {
    this.unit = null;
  }

  hasUnit() {
    return this.unit !== null;
  }

  getUnit() {
    return this.unit;
  }

  // Utility methods
  getCoordinates() {
    return { row: this.row, col: this.col };
  }

  getKey() {
    return `${this.row}-${this.col}`;
  }

  isAdjacent(otherHex) {
    const dr = Math.abs(this.row - otherHex.row);
    const dc = Math.abs(this.col - otherHex.col);

    // Hexagonal grid adjacency logic
    if (this.row % 2 === 0) {
      // Even row
      return (dr === 1 && (dc === 0 || dc === 1)) || (dr === 0 && dc === 1);
    } else {
      // Odd row
      return (dr === 1 && (dc === -1 || dc === 0)) || (dr === 0 && dc === 1);
    }
  }

  getDistance(otherHex) {
    // Simplified hexagonal distance calculation
    const dx = this.col - otherHex.col;
    const dy = this.row - otherHex.row;

    if (Math.sign(dx) === Math.sign(dy)) {
      return Math.abs(dx + dy);
    } else {
      return Math.max(Math.abs(dx), Math.abs(dy));
    }
  }

  // Description for UI
  getDescription() {
    let desc = `${this.name} (${this.row}, ${this.col})`;

    if (this.unit) {
      desc += ` - Occupied by ${this.unit.name || "Unit"}`;
    }

    return desc;
  }

  // For debugging
  toString() {
    return `Hex[${this.row},${this.col}]:${this.type}`;
  }
}

export default Hex;
