// game-core/turn.js
import Order from './order.js';

class Turn {
    commandCard = null;
    orders = [];
    turnNumber = 1;

    addOrder(unit, start, end, canFire) {
        this.orders.push(new Order(unit, start, end, canFire));
    }
}