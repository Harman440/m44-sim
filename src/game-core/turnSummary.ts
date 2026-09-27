// game-core/turnSummary.ts
import BoardManager from "./BoardManager";
import Order from "./order";
import { samePosition } from "./position";
import type { Shot } from "./gameSession";
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
  /** Marked for a Close Assault card: it fires only at an adjacent enemy */
  closeAssaultOnly: boolean;
  /** The unit has since been removed from the board (destroyed in battle) */
  removed: boolean;
  /** Shots this unit has fired this turn */
  shots: readonly Shot[];
  /** Shots it may still fire (0 when it can't fire, is removed, has used them all or was skipped) */
  shotsLeft: number;
  /** It didn't move and lost its unfired shot when the player moved on to the moved units */
  skipped: boolean;
  /** It moved, so it must wait until every unit that didn't move has fired (or been skipped) */
  waiting: boolean;
}

/**
 * Battle order: the units that didn't move fire first, then the units that
 * moved. At the table the two sides alternate one unit at a time within each
 * group, starting with the attacking side.
 */
export function summarizeOrders(
  orders: readonly Order[],
  board: BoardManager,
  shots: readonly Shot[] = [],
  unmovedFireSkipped = false
): OrderSummary[] {
  const summaries = summarizeEach(orders, board, shots, unmovedFireSkipped);
  const unmovedLeft = summaries.some((s) => s.hold && s.shotsLeft > 0);
  return summaries.map((s) => ({ ...s, waiting: !s.hold && s.shotsLeft > 0 && unmovedLeft }));
}

function summarizeEach(
  orders: readonly Order[],
  board: BoardManager,
  shots: readonly Shot[],
  unmovedFireSkipped: boolean
): Omit<OrderSummary, "waiting">[] {
  const unitsOnBoard = new Set(board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));

  return orders.map((order, index) => {
    const destination = board.getHex(order.end)!;
    const hold = samePosition(order.start, order.end);
    const removed = !unitsOnBoard.has(order.unit);
    const unitShots = shots.filter((shot) => shot.orderIndex === index);
    const skipped = hold && unmovedFireSkipped && order.canFire && !removed && unitShots.length < order.shots;
    return {
      index,
      unitType: order.unit.getUnitType(),
      section: destination.getSide(),
      hold,
      hexesMoved: hold ? 0 : Math.max(1, (order.path?.length ?? 2) - 1),
      destinationTerrain: destination.getType(),
      canFire: order.canFire,
      closeAssaultOnly: order.closeAssaultOnly,
      removed,
      shots: unitShots,
      skipped,
      shotsLeft: order.canFire && !removed && !skipped ? Math.max(0, order.shots - unitShots.length) : 0,
    };
  });
}
