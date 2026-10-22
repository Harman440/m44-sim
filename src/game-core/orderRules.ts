// game-core/orderRules.ts
// Which units the player can still order and how far they move. Any unit can be ordered once a
// turn; a unit with no order rests. Worked out from the orders given so far, so undoing an order
// frees the unit again.
import BoardManager from "./BoardManager";
import Order from "./order";
import Unit from "./unit";
import { Position } from "../types/scenario";

/** How far a unit may move with an order, and how many shots the order gives it */
export interface MoveLimits {
  maxMove: number;
  /** Moving at most this far it can still fire (0: it can only fire if it holds) */
  moveAndFire: number;
  /** Shots when it holds */
  holdShots: number;
}

/** A unit's own move and fire */
export const moveLimits = (unit: Unit): MoveLimits => ({
  maxMove: unit.getMaxMove(),
  moveAndFire: unit.getMoveAndFire(),
  holdShots: 1,
});

export const isOrdered = (orders: readonly Order[], unit: Unit): boolean => orders.some((order) => order.unit === unit);

/** The positions of the units that have no order yet */
export function orderablePositions(board: BoardManager, orders: readonly Order[]): Position[] {
  return board
    .getAllHexes()
    .filter((hex) => hex.unit && !isOrdered(orders, hex.unit))
    .map((hex) => hex.getPosition());
}
