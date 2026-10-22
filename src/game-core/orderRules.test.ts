import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { isOrdered, moveLimits, orderablePositions } from "./orderRules";
import { positionKey as key } from "./position";
import { Side } from "../types/hex";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

const makeScenario = (units: Scenario["units"]["allies"]): Scenario => ({
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  initialHandSize: { allies: 3, axis: 3 },
  attacker: "Allies",
  tiles: {},
  units: { allies: units, axis: {} },
});

// One unit per section: (7,1) left, (7,3) left-center, (8,4) center tank,
// (8,6) center, (7,8) right-center, (8,11) right
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
  new Order({ unit: board.getHex(position)!.unit!, start: position, end: position, shots: 1 });

describe("sections", () => {
  it("uses the sections the test scenario expects", () => {
    const board = new BoardManager(scenario);
    const sideOf = (row: number, col: number) => board.getHex({ row, col })!.getSide();

    expect(sideOf(7, 1)).toBe(Side.LEFT);
    expect(sideOf(7, 3)).toBe(Side.LEFT_CENTER);
    expect(sideOf(8, 4)).toBe(Side.CENTER);
    expect(sideOf(7, 8)).toBe(Side.RIGHT_CENTER);
    expect(sideOf(8, 11)).toBe(Side.RIGHT);
  });
});

describe("which units can be ordered", () => {
  it("is every unit on the board, in any section", () => {
    expect(orderable(new BoardManager(scenario))).toEqual(["7-1", "7-3", "7-8", "8-11", "8-4", "8-6"]);
  });

  it("leaves out units already ordered", () => {
    const board = new BoardManager(scenario);
    const orders = [holdAt(board, LEFT)];

    expect(orderable(board, orders)).toEqual(["7-3", "7-8", "8-11", "8-4", "8-6"]);
    expect(isOrdered(orders, board.getHex(LEFT)!.unit!)).toBe(true);
    expect(isOrdered(orders, board.getHex(LEFT_CENTER)!.unit!)).toBe(false);
  });
});

describe("moveLimits", () => {
  it("uses the unit's own movement, and one shot when it holds", () => {
    expect(moveLimits(new Unit(UnitType.INFANTRY))).toEqual({ maxMove: 2, moveAndFire: 1, holdShots: 1 });
    expect(moveLimits(new Unit(UnitType.TANK))).toEqual({ maxMove: 3, moveAndFire: 3, holdShots: 1 });
    expect(moveLimits(new Unit(UnitType.ARTILLERY))).toEqual({ maxMove: 1, moveAndFire: 0, holdShots: 1 });
  });
});
