import { Position } from "./scenario";

// Priority queue node for Dijkstra's algorithm
export interface PathNode {
  position: Position;
  cost: number;
  canContinue: boolean; // false for 'stop' hexes
  path: Position[];
  /** The longest the move can be now, set by terrain it has been on (a beach: TerrainRules.moveThrough) */
  cap?: number;
}

// Result type that includes both reachable positions and their paths
export interface PathResult {
  position: Position;
  cost: number;
  path: Position[]; // Full path from start to this position
}