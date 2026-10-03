// game-core/markerRules.ts
// Where the hexes of a combat card's marker can go (Barrage, Air Power, Air
// Bombardment, Reinforcements). The map only has this side's units,
// so the rules can only look at those.
import BoardManager from "./BoardManager";
import { MarkerRule } from "./combatCard";
import { includesPosition, samePosition } from "./position";
import { Position } from "../types/scenario";

const neighborsOf = (board: BoardManager, position: Position): Position[] =>
  board.getHex(position)?.getNeighbors().filter((p) => board.getHex(p) !== null) ?? [];

/** Whether `position` can be the next hex marked, after `marks` */
export function canMark(rule: MarkerRule, board: BoardManager, marks: readonly Position[], position: Position): boolean {
  const hex = board.getHex(position);
  if (!hex || marks.length >= rule.count || includesPosition(marks, position)) return false;

  // A hex no unit can stand on (a river, a lake) is never worth marking, except as a link in Air Power's chain
  if (hex.hasUnit() || (!hex.canEnter() && !rule.chain)) return false;
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

/**
 * A unit of this side can't stand at `position` once `mark` is marked: on the
 * hex itself, or next to it for a card that keeps away from your units
 */
export function conflictsWithMark(rule: MarkerRule, board: BoardManager, mark: Position, position: Position): boolean {
  if (samePosition(mark, position)) return true;
  return !!rule.awayFromOwnUnits && includesPosition(neighborsOf(board, mark), position);
}

/** Index of the first mark a unit at `position` would break, or -1 */
export function firstConflictingMark(rule: MarkerRule, board: BoardManager, marks: readonly Position[], position: Position): number {
  return marks.findIndex((mark) => conflictsWithMark(rule, board, mark, position));
}
