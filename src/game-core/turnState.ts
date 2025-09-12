// game-core/turn.js
import { TurnPhase } from "../types/gameManager.js";
import { Position } from "../types/scenario.js";
import CommandCard from "./commandCard.js";
import Order from "./order.js";
import Unit from "./unit.js";

//TODO: Turn state is used to save and update game State only
class TurnState {
  phase: TurnPhase;
  commandCard: CommandCard | null; //NOTE: null if card not selected yet
  orders: Order[];
  turnNumber: number;
  turnCoinCost: number;
  numOrdersLeft: number;
  ordersCommitted: boolean;
  constructor() {
    this.commandCard = null;
    this.orders = [];
    this.turnNumber = 1;
    this.turnCoinCost = 0;
    this.phase = TurnPhase.PICK_CARDS;
    this.numOrdersLeft = 0;
    this.ordersCommitted = false;
  }

  startNewTurn() {
    this.turnNumber++;
    this.phase = TurnPhase.PICK_CARDS;
    this.commandCard = null;
    this.orders = [];
    this.turnCoinCost = 0;
    this.numOrdersLeft = 0;
    this.ordersCommitted = false;
  }

  // setCommandCard(card: CommandCard) {
  //   this.commandCard = card;
  //   this.numOrdersLeft = card.maxTotalOrders;
  //   this.phase = TurnPhase.ORDER_UNITS;
  // }

  // addOrder(unit: Unit, start: Position, end: Position, canFire: boolean) {
  //   this.orders.push(new Order(unit, start, end, canFire));
  //   this.numOrdersLeft--;
  // }

  // commitOrders() {
  //   this.ordersCommitted = true;
  // }

  // ordersAreCommitted(): boolean {
  //   return this.ordersCommitted;
  // }

  // startBattlePhase() {
  //   this.phase = TurnPhase.BATTLE;
  // }

  clone() {
    const newState = new TurnState();
    newState.phase = this.phase;
    newState.commandCard = this.commandCard;
    newState.orders = this.orders.map((order) => new Order(order.unit, order.start, order.end, order.canFire));
    newState.turnNumber = this.turnNumber;
    newState.turnCoinCost = this.turnCoinCost;
    newState.numOrdersLeft = this.numOrdersLeft;
    return newState;
  }

  printTurnInfo() {
    console.log(`Turn ${this.turnNumber} Info:`);
    console.log(`Phase: ${this.phase}`);
    console.log(`Num Orders Left: ${this.numOrdersLeft}`);

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
