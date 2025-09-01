import Hex from "./hex";
import Unit from "./unit";

class Order {
    unit: Unit;
    start: Hex;
    end: Hex;
    canFire: boolean;
    constructor(unit, start, end, canFire) {
        this.unit = unit;
        this.start = start;
        this.end = end;
        this.canFire = canFire;//TODO should unit store this or Order?
    }
}

export default Order;