import { Position } from "./scenario";

// Priority queue node for Dijkstra's algorithm
export interface PathNode {
  position: Position;
  cost: number;
  canContinue: boolean; // false for 'stop' hexes
}