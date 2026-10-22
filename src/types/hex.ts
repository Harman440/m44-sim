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
  /** Sand: a move that starts on it or enters it is 2 hexes at most (house rule) */
  BEACH = "beach",
  /** A unit that enters it stops, and one leaving it moves 1 hex (house rule) */
  SWAMP = "swamp",
  /** Sea: a move that starts on it or enters it is 1 hex, a unit on it can't fire, and a retreat is a hit (house rule) */
  OCEAN = "ocean",
}

export const isHexType = (value: unknown): value is HexType =>
  Object.values(HexType).includes(value as HexType);

// Enum for movement rules
export enum MovementRule {
  NORMAL = "normal",
  STOP = "stop",
  BLOCK = "block",
}

// Axial coordinate representation for easier hex calculations
export interface AxialCoord {
  q: number;
  r: number;
}