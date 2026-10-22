import { Position } from "../types/scenario";
import Unit from "./unit";

interface OrderProps {
  unit: Unit;
  start: Position;
  end: Position;
  /** Hexes crossed, start and end included */
  path?: Position[] | null;
  shots: number;
  lostSandbags?: Position[];
  clearedWire?: boolean;
}

/**
 * One unit's order for this turn. Orders are only ever appended while giving
 * orders and only the last one can be taken back, so an order's index in the
 * turn's list identifies it for the rest of the turn (arrow colour, shots).
 */
class Order {
  unit: Unit;
  start: Position;
  end: Position;
  path?: Position[] | null;
  /** Shots the unit may fire this turn after carrying out the order (0: it can't fire) */
  shots: number;
  /** Hexes whose sandbags went when the unit moved (it left them), put back if the order is undone */
  lostSandbags: Position[];
  /** A tank removed the barbed wire on the hex it moved to, put back if the order is undone */
  clearedWire: boolean;
  constructor({ unit, start, end, path = null, shots, lostSandbags = [], clearedWire = false }: OrderProps) {
    this.unit = unit;
    this.start = start;
    this.end = end;
    this.path = path;
    this.shots = shots;
    this.lostSandbags = lostSandbags;
    this.clearedWire = clearedWire;
  }

  /** Whether the unit may fire this turn after carrying out the order */
  get canFire(): boolean {
    return this.shots > 0;
  }
}

export default Order;
