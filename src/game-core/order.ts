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

    printOrder() {
        console.log(`Order: Unit ${this.unit.id}, From (${this.start.col},${this.start.row}) to (${this.end.col},${this.end.row}), Can Fire: ${this.canFire}`);
    }
}

export default Order;