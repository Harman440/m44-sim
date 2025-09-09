import { Position } from "../types/scenario";
import Unit from "./unit";

class Order {
    unit: Unit;
    start: Position;
    end: Position;
    canFire: boolean;
    constructor(unit: Unit, start: Position, end: Position, canFire: boolean) {
        this.unit = unit;
        this.start = start;
        this.end = end;
        this.canFire = canFire;//TODO should unit store this or Order?
    }
}

export default Order;