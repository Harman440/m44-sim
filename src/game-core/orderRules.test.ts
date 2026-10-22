import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { isOrdered, orderablePositions } from "./orderRules";
import { positionKey as key } from "./position";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

const makeScenario = (units: Scenario["units"]["allies"]): Scenario => ({
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  attacker: "Allies",
  tiles: {},
  units: { allies: units, axis: {} },
});

// Units across the board: (7,1), (7,3), (8,4) a tank, (8,6), (7,8) and (8,11)
const scenario = makeScenario({
  infantry: [
    { row: 7, col: 1 }, { row: 7, col: 3 }, { row: 8, col: 6 },
    { row: 7, col: 8 }, { row: 8, col: 11 },
  ],
  tank: [{ row: 8, col: 4 }],
});
const LEFT = { row: 7, col: 1 };
const LEFT_CENTER = { row: 7, col: 3 };

const orderable = (board: BoardManager, orders: Order[] = []) => orderablePositions(board, orders).map(key).sort();

/** A hold order for the unit at `position` */
const holdAt = (board: BoardManager, position: Position) =>
  new Order({ unit: board.getHex(position)!.unit!, action: "infantry:firefight", start: position, end: position, shots: 1 });

describe("which units can be ordered", () => {
  it("is every unit on the board", () => {
    expect(orderable(new BoardManager(scenario))).toEqual(["7-1", "7-3", "7-8", "8-11", "8-4", "8-6"]);
  });

  it("leaves out units already ordered", () => {
    const board = new BoardManager(scenario);
    const orders = [holdAt(board, LEFT)];

    expect(orderable(board, orders)).toEqual(["7-3", "7-8", "8-11", "8-4", "8-6"]);
    expect(isOrdered(orders, board.getHex(LEFT)!.unit!)).toBe(true);
    expect(isOrdered(orders, board.getHex(LEFT_CENTER)!.unit!)).toBe(false);
  });

  it("leaves out units that can't be given any action", () => {
    const board = new BoardManager(scenario);
    const noTanks = (unit: Unit) => unit.getUnitType() !== UnitType.TANK;

    expect(orderablePositions(board, [], noTanks).map(key).sort()).toEqual(["7-1", "7-3", "7-8", "8-11", "8-6"]);
  });
});
