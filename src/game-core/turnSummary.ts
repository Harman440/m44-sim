// game-core/turnSummary.ts
import BoardManager from "./BoardManager";
import Order from "./order";
import { samePosition } from "./position";
import { Shot } from "./gameSession";
import { UnitType } from "./unit";
import { HexType, Side } from "../types/hex";

/** What one order means for the battle, for carrying it out on the physical table */
export interface OrderSummary {
  /** Position in the turn's orders; the map draws the order's arrow in the matching colour */
  index: number;
  unitType: UnitType;
  /** Section the unit ended the move in */
  section: Side;
  hold: boolean;
  hexesMoved: number;
  destinationTerrain: HexType;
  canFire: boolean;
  /** The unit has since been removed from the board (destroyed in battle) */
  removed: boolean;
  /** Shots this unit has fired this turn */
  shots: readonly Shot[];
  /** Shots it may still fire (0 when it can't fire, is removed or has used them all) */
  shotsLeft: number;
}

export function summarizeOrders(
  orders: readonly Order[],
  board: BoardManager,
  shots: readonly Shot[] = [],
  firesPerUnit = 1
): OrderSummary[] {
  const unitsOnBoard = new Set(board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));

  return orders.map((order, index) => {
    const destination = board.getHex(order.end)!;
    const hold = samePosition(order.start, order.end);
    const removed = !unitsOnBoard.has(order.unit);
    const unitShots = shots.filter((shot) => shot.orderIndex === index);
    return {
      index,
      unitType: order.unit.getUnitType(),
      section: destination.getSide(),
      hold,
      hexesMoved: hold ? 0 : Math.max(1, (order.path?.length ?? 2) - 1),
      destinationTerrain: destination.getType(),
      canFire: order.canFire,
      removed,
      shots: unitShots,
      shotsLeft: order.canFire && !removed ? Math.max(0, firesPerUnit - unitShots.length) : 0,
    };
  });
}
