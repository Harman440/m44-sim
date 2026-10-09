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
  extra?: boolean;
  cost?: number;
  boosted?: boolean;
  closeAssaultOnly?: boolean;
  lostSandbags?: Position[];
  clearedWire?: boolean;
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
  /** An extra order bought with coins: a normal order with none of the card's benefits */
  extra: boolean;
  /** It uses the order combat card's movement (Frozen Ground, Armor Forward…) */
  boosted: boolean;
  /** Coins paid for the order (an extra order, or a card that charges per unit like Finest Hour) */
  cost: number;
  /** Marked in the battle for a Close Assault card: it holds and fires only at an adjacent enemy */
  closeAssaultOnly: boolean;
  /** Hexes whose sandbags went when the unit moved (it left them), put back if the order is undone */
  lostSandbags: Position[];
  /** A tank removed the barbed wire on the hex it moved to, put back if the order is undone */
  clearedWire: boolean;
  constructor({
    unit,
    start,
    end,
    path = null,
    shots,
    section = null,
    onTheMove = false,
    extra = false,
    cost = 0,
    boosted = false,
    closeAssaultOnly = false,
    lostSandbags = [],
    clearedWire = false,
  }: OrderProps) {
    this.unit = unit;
    this.start = start;
    this.end = end;
    this.path = path;
    this.shots = shots;
    this.section = section;
    this.onTheMove = onTheMove;
    this.extra = extra;
    this.cost = cost;
    this.boosted = boosted;
    this.closeAssaultOnly = closeAssaultOnly;
    this.lostSandbags = lostSandbags;
    this.clearedWire = clearedWire;
  }

  /** Whether the unit may fire this turn after carrying out the order */
  get canFire(): boolean {
    return this.shots > 0;
  }
}

export default Order;
