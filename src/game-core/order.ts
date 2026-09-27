import { Position } from "../types/scenario";
import { Section } from "./commandCard";
import Unit from "./unit";

interface OrderProps {
  unit: Unit;
  start: Position;
  end: Position;
  /** Hexes crossed, start and end included */
  path?: Position[] | null;
  shots: number;
  section?: Section | null;
  onTheMove?: boolean;
  closeAssaultOnly?: boolean;
}

/**
 * One unit's order for this turn. Orders are only ever appended (while giving
 * orders, or when marking units for a Close Assault card in the battle) and
 * only the last one can be taken back, so an order's index in the turn's list
 * identifies it for the rest of the turn (arrow colour, shots).
 */
class Order {
  unit: Unit;
  start: Position;
  end: Position;
  path?: Position[] | null;
  /** Shots the unit may fire this turn after carrying out the order (0: it can't fire) */
  shots: number;
  /** The section whose quota it used, for cards with orders per section; null otherwise */
  section: Section | null;
  /** The card's extra unit on the move: it may move but can't fire */
  onTheMove: boolean;
  /** Marked in the battle for a Close Assault card: it holds and fires only at an adjacent enemy */
  closeAssaultOnly: boolean;
  constructor({
    unit,
    start,
    end,
    path = null,
    shots,
    section = null,
    onTheMove = false,
    closeAssaultOnly = false,
  }: OrderProps) {
    this.unit = unit;
    this.start = start;
    this.end = end;
    this.path = path;
    this.shots = shots;
    this.section = section;
    this.onTheMove = onTheMove;
    this.closeAssaultOnly = closeAssaultOnly;
  }

  /** Whether the unit may fire this turn after carrying out the order */
  get canFire(): boolean {
    return this.shots > 0;
  }
}

export default Order;
