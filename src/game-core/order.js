class Order {
    constructor(unit, start, end, canFire) {
        this.unit = unit;
        this.start = start;
        this.end = end;
        this.canFire = canFire;//TODO should unit store this or Order?
    }
}

export default Order;