import { Position } from "../types/scenario";
import Unit from "./unit";

interface OrderProps {
  unit: Unit;
  /** The action's id (data/unitActions.ts) */
  action: string;
  start: Position;
  end: Position;
  /** Hexes crossed, start and end included */
  path?: Position[] | null;
  shots: number;
  lostSandbags?: Position[];
  clearedWire?: boolean;
  partner?: Position;
}

/**
 * One unit's order for this turn. Orders are only ever appended while giving
 * orders and only the last one can be taken back, so an order's index in the
 * turn's list identifies it for the rest of the turn (arrow colour, shots).
 */
class Order {
  unit: Unit;
  /** The action the unit was given, by id (data/unitActions.ts): how it moves and fires, and what it costs */
  action: string;
  start: Position;
  end: Position;
  path?: Position[] | null;
  /** Shots the unit may fire this turn after carrying out the order (0: it can't fire) */
  shots: number;
  /** Hexes whose sandbags went when the unit moved (it left them), put back if the order is undone */
  lostSandbags: Position[];
  /** A tank removed the barbed wire on the hex it moved to, put back if the order is undone */
  clearedWire: boolean;
  /** Regroup: the hex of the unit next to it whose figures join it (that unit gets no order of its own) */
  partner?: Position;
  constructor({ unit, action, start, end, path = null, shots, lostSandbags = [], clearedWire = false, partner }: OrderProps) {
    this.unit = unit;
    this.action = action;
    this.start = start;
    this.end = end;
    this.path = path;
    this.shots = shots;
    this.lostSandbags = lostSandbags;
    this.clearedWire = clearedWire;
    if (partner) this.partner = partner;
  }

  /** Whether the unit may fire this turn after carrying out the order */
  get canFire(): boolean {
    return this.shots > 0;
  }
}

export default Order;
