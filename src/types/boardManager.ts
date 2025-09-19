import { Position } from "./scenario";

// Priority queue node for Dijkstra's algorithm
export interface PathNode {
  position: Position;
  cost: number;
  canContinue: boolean; // false for 'stop' hexes
  path: Position[];
}

// Result type that includes both reachable positions and their paths
export interface PathResult {
  position: Position;
  cost: number;
  path: Position[]; // Full path from start to this position
}