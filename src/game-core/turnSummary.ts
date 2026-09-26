// game-core/turnSummary.ts
import BoardManager from "./BoardManager";
import Order from "./order";
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
}

export function summarizeOrders(orders: readonly Order[], board: BoardManager): OrderSummary[] {
  const unitsOnBoard = new Set(board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));

  return orders.map((order, index) => {
    const destination = board.getHex(order.end)!;
    const hold = order.start.row === order.end.row && order.start.col === order.end.col;
    return {
      index,
      unitType: order.unit.getUnitType(),
      section: destination.getSide(),
      hold,
      hexesMoved: hold ? 0 : Math.max(1, (order.path?.length ?? 2) - 1),
      destinationTerrain: destination.getType(),
      canFire: order.canFire,
      removed: !unitsOnBoard.has(order.unit),
    };
  });
}
