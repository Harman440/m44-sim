// Enum for hex types
export enum HexType {
  PLAINS = "plains",
  FOREST = "forest",
  HILL = "hill",
  TOWN = "town",
}

// Enum for movement rules
export enum MovementRule {
  NORMAL = "normal",
  STOP = "stop",
  BLOCK = "block",
  DIFFICULT = "Difficult",
}

export interface TerrainProperties {
  movementRule: MovementRule;
  movementCost: number;
  canMoveAndFire: boolean;
  color: string;
  name: string;
}

// Axial coordinate representation for easier hex calculations
export interface AxialCoord {
  q: number;
  r: number;
}