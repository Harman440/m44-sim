// game-core/orderRules.ts
// Which units the player can still order. Any unit can be ordered once a turn, given one of its
// actions (game-core/actionRules.ts); a unit with no order rests. Worked out from the orders given
// so far, so undoing an order frees the unit again.
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

export const isOrdered = (orders: readonly Order[], unit: Unit): boolean => orders.some((order) => order.unit === unit);

/** The positions of the units that have no order yet and can be given one (`canOrder`: some action it can pay for) */
export function orderablePositions(
  board: BoardManager,
  orders: readonly Order[],
  canOrder: (unit: Unit) => boolean = () => true
): Position[] {
  return board
    .getAllHexes()
    .filter((hex) => hex.unit && !isOrdered(orders, hex.unit) && canOrder(hex.unit))
    .map((hex) => hex.getPosition());
}
