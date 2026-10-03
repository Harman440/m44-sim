// game-core/turnSummary.ts
import BoardManager from "./BoardManager";
import Order from "./order";
import { samePosition } from "./position";
import type { Shot } from "./gameSession";
import type { CombatCard } from "./combatCard";
import { UnitType } from "./unit";
import { HexType, Side } from "../types/hex";
import { Position } from "../types/scenario";

/** What one order means for the battle, for carrying it out on the physical table */
export interface OrderSummary {
  /** Position in the turn's orders; the map draws the order's arrow in the matching colour */
  index: number;
  unitType: UnitType;
  /** Where the unit ended the move */
  position: Position;
  /** Section the unit ended the move in */
  section: Side;
  hold: boolean;
  hexesMoved: number;
  destinationTerrain: HexType;
  canFire: boolean;
  /** It fires only at an adjacent enemy: marked for a Close Assault card, or its shot after taking ground */
  closeAssaultOnly: boolean;
  /** Where it fires from: where the order left it, or the hex it took ground on */
  firingFrom: Position;
  /** It took ground after a close assault and gets one more shot, in close assault */
  tookGround: boolean;
  /** An extra order bought with coins: it fires without the card's bonuses */
  extra: boolean;
  /** The unit has since been removed from the board (destroyed in battle) */
  removed: boolean;
  /** Shots this unit has fired this turn */
  shots: readonly Shot[];
  /** Shots it may still fire (0 when it can't fire, is removed, has used them all or was skipped) */
  shotsLeft: number;
  /** It didn't move and lost its unfired shot when the player moved on to the moved units */
  skipped: boolean;
  /** It fires before any other unit, whatever the firing order (Tras las líneas enemigas, ¡Fusiles arriba!) */
  firesFirst: boolean;
  /** It moved, so it must wait until every unit that didn't move has fired (or been skipped) */
  waiting: boolean;
}

/** The combat cards played this turn that change the firing order */
export interface PlayedCombatCards {
  orderCombatCard?: CombatCard | null;
  battleCombatCard?: CombatCard | null;
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
  unmovedFireSkipped = false,
  { orderCombatCard = null, battleCombatCard = null }: PlayedCombatCards = {}
): OrderSummary[] {
  const summaries = summarizeEach(orders, board, shots, unmovedFireSkipped);
  const unmovedLeft = summaries.some((s) => s.hold && s.shotsLeft > 0);
  // The unit that used the order combat card's movement, when the card makes it fire first
  const effect = orderCombatCard?.effect;
  const movedFiresFirst = effect?.kind === "move" && !!effect.firesFirst;
  // ¡Fusiles arriba!: any unit may fire first; the first to fire (collisions aside) is the one
  const anyFiresFirst = battleCombatCard?.effect?.kind === "firesFirst";
  const firstShot = anyFiresFirst ? shots.find((shot) => !shot.collision) : undefined;
  const nobodyWaits = anyFiresFirst && !firstShot;
  return summaries.map((s, i) => {
    const first = (movedFiresFirst && orders[i]!.boosted) || firstShot?.orderIndex === i;
    return { ...s, firesFirst: first, waiting: !first && !nobodyWaits && !s.hold && s.shotsLeft > 0 && unmovedLeft };
  });
}

function summarizeEach(
  orders: readonly Order[],
  board: BoardManager,
  shots: readonly Shot[],
  unmovedFireSkipped: boolean
): Omit<OrderSummary, "waiting" | "firesFirst">[] {
  const unitsOnBoard = new Set(board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));

  return orders.map((order, index) => {
    const destination = board.getHex(order.end)!;
    const hold = samePosition(order.start, order.end);
    const removed = !unitsOnBoard.has(order.unit);
    const unitShots = shots.filter((shot) => shot.orderIndex === index);
    // Taking ground after a close assault gives one more shot, from the hex taken (once per turn)
    const groundShot = unitShots.find((shot) => shot.tookGround);
    const allowed = order.shots + (groundShot ? 1 : 0);
    const overrunPending = !!groundShot && unitShots.at(-1) === groundShot;
    const skipped = hold && unmovedFireSkipped && order.canFire && !removed && unitShots.length < allowed;
    return {
      index,
      unitType: order.unit.getUnitType(),
      position: order.end,
      section: destination.getSide(),
      hold,
      hexesMoved: hold ? 0 : Math.max(1, (order.path?.length ?? 2) - 1),
      destinationTerrain: destination.getType(),
      canFire: order.canFire,
      closeAssaultOnly: order.closeAssaultOnly || overrunPending,
      firingFrom: (groundShot && groundShot.targetPosition) || order.end,
      tookGround: !!groundShot,
      extra: order.extra,
      removed,
      shots: unitShots,
      skipped,
      shotsLeft: order.canFire && !removed && !skipped ? Math.max(0, allowed - unitShots.length) : 0,
    };
  });
}
