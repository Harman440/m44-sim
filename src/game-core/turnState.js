// game-core/turn.js
import Order from './order.js';

class TurnState {
    commandCard = null;
    orders = [];
    turnNumber = 1;
    turnCoinCost = 0;

    addOrder(unit, start, end, canFire) {
        this.orders.push(new Order(unit, start, end, canFire));
    }
}