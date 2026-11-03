// game-core/turnSummary.ts
import BoardManager from "./BoardManager";
import Order from "./order";
import { samePosition } from "./position";
import type { Shot } from "./gameSession";
import Unit, { UnitType } from "./unit";
import { HexType } from "../types/hex";
import { actionById } from "../data/unitActions";
import { Position } from "../types/scenario";

/** What one order means for the battle, for carrying it out on the physical table */
export interface OrderSummary {
  /** Position in the turn's orders; the map draws the order's arrow in the matching colour */
  index: number;
  unitType: UnitType;
  /** The unit has the scenario's badge */
  elite: boolean;
  /** Where the unit ended the move */
  position: Position;
  hold: boolean;
  hexesMoved: number;
  destinationTerrain: HexType;
  canFire: boolean;
  /** It fires only at an adjacent enemy (no longer happens: taking ground ends the unit's fire) */
  closeAssaultOnly: boolean;
  /** Where it fires from: where the order left it, or the hex it took ground on */
  firingFrom: Position;
  /** It took ground after a close assault, and fires no more this turn */
  tookGround: boolean;
  /** The unit has since been removed from the board (destroyed in battle) */
  removed: boolean;
  /** Shots this unit has fired this turn */
  shots: readonly Shot[];
  /** Shots it may still fire (0 when it can't fire, is removed, has used them all or was skipped) */
  shotsLeft: number;
  /** It didn't move and lost its unfired shot when the player moved on to the moved units */
  skipped: boolean;
  /** It fires in the first group, with the units that didn't move: it didn't move, or its action says so (No Respite) */
  unmovedGroup: boolean;
  /** It moved, so it must wait until every unit that didn't move has fired (or been skipped) */
  waiting: boolean;
}

/**
 * Battle order: a unit whose action fires before anyone (Behind Enemy Lines), then the units
 * that didn't move (and No Respite's), then the units that moved. At the table the two sides
 * alternate one unit at a time within each group, starting with the attacking side.
 */
export function summarizeOrders(
  orders: readonly Order[],
  board: BoardManager,
  shots: readonly Shot[] = [],
  unmovedFireSkipped = false,
  /** Pass and play: units marked to retreat, which can't battle any more this turn */
  retreating: ReadonlySet<Unit> = new Set(),
  /** Units with no ammo or shells left for a shot, which can't fire any more */
  outOfAmmo: ReadonlySet<Unit> = new Set()
): OrderSummary[] {
  const summaries = summarizeEach(orders, board, shots, unmovedFireSkipped, retreating, outOfAmmo);
  const unmovedLeft = summaries.some((s) => s.unmovedGroup && s.shotsLeft > 0);
  return summaries.map((s) => ({ ...s, waiting: !s.unmovedGroup && s.shotsLeft > 0 && unmovedLeft }));
}

function summarizeEach(
  orders: readonly Order[],
  board: BoardManager,
  shots: readonly Shot[],
  unmovedFireSkipped: boolean,
  retreating: ReadonlySet<Unit>,
  outOfAmmo: ReadonlySet<Unit>
): Omit<OrderSummary, "waiting">[] {
  const unitsOnBoard = new Set(board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));

  return orders.map((order, index) => {
    const destination = board.getHex(order.end)!;
    const hold = samePosition(order.start, order.end);
    const fire = actionById(order.action)?.fire;
    const unmovedGroup = hold || fire?.round === "unmoved";
    const removed = !unitsOnBoard.has(order.unit);
    const unitShots = shots.filter((shot) => shot.orderIndex === index);
    // Taking ground after a close assault (armour's overrun, pass and play's infantry pushing
    // back) moves the unit in, and it fires no more this turn (house rule)
    const groundShot = unitShots.find((shot) => shot.tookGround);
    const allowed = order.shots;
    const firingFrom = (groundShot && groundShot.targetPosition) || order.end;
    // It fought a collision (house rule), took ground, or is marked to retreat (pushed back):
    // no more shots this turn. Nor from the ocean, where nothing fires (house rule)
    const blocked =
      unitShots.some((shot) => shot.collision) ||
      !!groundShot ||
      retreating.has(order.unit) ||
      outOfAmmo.has(order.unit) ||
      !!board.getHex(firingFrom)?.getTerrain().noFire;
    const skipped = unmovedGroup && unmovedFireSkipped && order.canFire && !removed && unitShots.length < allowed;
    return {
      index,
      unitType: order.unit.getUnitType(),
      elite: order.unit.elite,
      position: order.end,
      hold,
      unmovedGroup,
      hexesMoved: hold ? 0 : Math.max(1, (order.path?.length ?? 2) - 1),
      destinationTerrain: destination.getType(),
      canFire: order.canFire,
      // Nothing fires in close assault only now: taking ground ends the unit's fire
      closeAssaultOnly: false,
      firingFrom,
      tookGround: !!groundShot,
      removed,
      shots: unitShots,
      skipped,
      shotsLeft: order.canFire && !removed && !skipped && !blocked ? Math.max(0, allowed - unitShots.length) : 0,
    };
  });
}
