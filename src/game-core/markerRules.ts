// game-core/markerRules.ts
// Where the hexes of a combat card's marker can go (Barrage, Air Power, Air
// Bombardment, Reinforcements). The map only has this side's units,
// so the rules can only look at those.
import BoardManager from "./BoardManager";
import { MarkerRule } from "./combatCard";
import { includesPosition } from "./position";
import { Position } from "../types/scenario";

const neighborsOf = (board: BoardManager, position: Position): Position[] =>
  board.getHex(position)?.getNeighbors().filter((p) => board.getHex(p) !== null) ?? [];

/** Whether `position` can be the next hex marked, after `marks` */
export function canMark(rule: MarkerRule, board: BoardManager, marks: readonly Position[], position: Position): boolean {
  const hex = board.getHex(position);
  if (!hex || marks.length >= rule.count || includesPosition(marks, position)) return false;

  if (rule.kind === "cross" ? hex.hasUnit() || !hex.isPassable() : hex.hasUnit()) return false;
  const neighbors = neighborsOf(board, position);
  if (rule.awayFromOwnUnits && neighbors.some((p) => board.getHex(p)?.hasUnit())) return false;
  const previous = marks.at(-1);
  if (rule.chain && previous && !includesPosition(neighbors, previous)) return false;
  return true;
}

/** Every hex that can be marked next */
export function markablePositions(rule: MarkerRule, board: BoardManager, marks: readonly Position[]): Position[] {
  return board
    .getAllHexes()
    .map((hex) => hex.getPosition())
    .filter((position) => canMark(rule, board, marks, position));
}
