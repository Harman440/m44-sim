// Enum for hex types
export enum HexType {
  PLAINS = "plains",
  FOREST = "forest",
  HILL = "hill",
  TOWN = "town",
  HEDGEROW = "hedgerow",
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