// Enum for hex types
export enum HexType {
  PLAINS = "plains",
  FOREST = "forest",
  HILL = "hill",
  TOWN = "town",
  HEDGEROW = "hedgerow",
  /** Impassable; doesn't block line of sight */
  RIVER = "river",
  /** A river hex with a bridge: plays like plains (house rule) */
  BRIDGE = "bridge",
  /** A pond or lake: impassable, doesn't block line of sight */
  LAKE = "lake",
}

// Enum for movement rules
export enum MovementRule {
  NORMAL = "normal",
  STOP = "stop",
  BLOCK = "block",
}

export enum Side {
  LEFT = "left",
  LEFT_CENTER = "leftcenter",
  CENTER = "center",
  RIGHT_CENTER = "rightcenter",
  RIGHT = "right",
}

export interface TerrainProperties {
  movementRule: MovementRule;
  movementCost: number;
  canMoveAndFire: boolean;
}

// Axial coordinate representation for easier hex calculations
export interface AxialCoord {
  q: number;
  r: number;
}