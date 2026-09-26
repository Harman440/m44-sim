import { Position } from "../types/scenario";
import Unit from "./unit";

/**
 * One unit's order for this turn. Orders are only ever appended while giving
 * orders and are frozen once committed, so an order's index in the turn's list
 * identifies it for the rest of the turn (arrow colour, shots).
 */
class Order {
    unit: Unit;
    start: Position;
    end: Position;
    /** Whether the unit may fire this turn after carrying out the order */
    canFire: boolean;
    path?: Position[] | null;
    constructor(unit: Unit, start: Position, end: Position, canFire: boolean, path: Position[] | null = null) {
        this.unit = unit;
        this.start = start;
        this.end = end;
        this.canFire = canFire;
        this.path = path;
    }
}

export default Order;
