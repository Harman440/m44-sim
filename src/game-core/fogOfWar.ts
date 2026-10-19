// game-core/fogOfWar.ts
// Fog of war, for a match against the computer (a menu switch): once the turn's units have
// moved, each side sees only the enemy units within VISION hexes of one of its own (VISION_FROM_HILL
// from a hill) and in line of sight of it. What it saw when the battle ended is what it knows
// while it gives the next orders. At the start of the game both armies are known.
import BoardManager from "./BoardManager";
import { Position } from "../types/scenario";
import { HexType } from "../types/hex";
import { hasLineOfSight, hexDistance } from "./fireTargets";
import { positionKey } from "./position";

/** How far a unit sees */
export const VISION = 4;
/** How far a unit on a hill sees */
export const VISION_FROM_HILL = 5;

/** How far the unit on this hex sees */
export const visionFrom = (board: BoardManager, position: Position): number =>
  board.getHex(position)?.getType() === HexType.HILL ? VISION_FROM_HILL : VISION;

/**
 * The enemy units a side sees, all in that side's view of the board (`board`, with its own units
 * on it): each one in range of one of its units and in its line of sight, which the other enemy
 * units block too
 */
export function inSight(board: BoardManager, own: readonly Position[], enemies: readonly Position[]): Position[] {
  const enemyKeys = new Set(enemies.map(positionKey));
  return enemies.filter((enemy) =>
    own.some((from) => hexDistance(from, enemy) <= visionFrom(board, from) && hasLineOfSight(board, from, enemy, enemyKeys)),
  );
}
