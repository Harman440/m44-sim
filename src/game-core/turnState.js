// game-core/turn.js
import Order from "./order.js";

class TurnState {
  constructor() {
    this.commandCard = null;
    this.orders = [];
    this.turnNumber = 1;
    this.turnCoinCost = 0;
  }

  addOrder(unit, start, end, canFire) {
    this.orders.push(new Order(unit, start, end, canFire));
  }

  printTurnInfo() {
    console.log(`Turn ${this.turnNumber} Info:`);

    if (this.commandCard) {
      console.log("Command Card:");
      console.log(`  Name: ${this.commandCard.name}`);
      console.log(`  Description: ${this.commandCard.description}`);
    } else {
      console.log("No Command Card set for this turn.");
    }

    if (this.orders.length > 0) {
      console.log("Orders:");
      this.orders.forEach((order, idx) => {
        console.log(
          `  Order ${idx + 1}: Unit ${order.unit}, From ${order.start} to ${
            order.end
          }, Can Fire: ${order.canFire}`
        );
      });
    } else {
      console.log("No orders this turn.");
    }
  }
}

export default TurnState;
