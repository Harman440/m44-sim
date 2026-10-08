import { describe, expect, it } from "vitest";
import { shoot } from "../test/shots";
import GameSession from "./gameSession";
import CommandCard from "./commandCard";
import { summarizeOrders } from "./turnSummary";
import { UnitType } from "./unit";
import { HexType, Side } from "../types/hex";
import { Position } from "../types/scenario";
import { same } from "../i18n/lang";

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { infantry: true, closeAssault: false };

const TANK: Position = { row: 4, col: 6 };
const FOREST: Position = { row: 4, col: 7 };
const INFANTRY: Position = { row: 7, col: 1 };

const playTurn = (elite: Position[] = []) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: same(""),
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles: { forest: [FOREST] },
      units: { allies: { tank: [TANK], infantry: [INFANTRY] }, axis: {} },
      elite,
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "all", orders: 6 })],
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  session.issueOrder(TANK, FOREST);
  session.issueOrder(INFANTRY, INFANTRY);
  session.commitOrders();
  session.startBattle();
  return session;
};

describe("summarizeOrders", () => {
  it("describes each order in the order it was given", () => {
    const session = playTurn();

    const [tank, infantry] = summarizeOrders(session.getSnapshot().orders, session.board);

    expect(tank).toEqual({
      index: 0,
      unitType: UnitType.TANK,
      elite: false,
      position: session.getSnapshot().orders[0]!.end,
      section: Side.CENTER,
      hold: false,
      hexesMoved: 1,
      destinationTerrain: HexType.FOREST,
      canFire: false, // moved into forest
      closeAssaultOnly: false,
      firingFrom: session.getSnapshot().orders[0]!.end,
      tookGround: false,
      extra: false,
      removed: false,
      shots: [],
      shotsLeft: 0,
      skipped: false,
      firesFirst: false,
      waiting: false,
    });
    expect(infantry).toMatchObject({
      index: 1,
      unitType: UnitType.INFANTRY,
      section: Side.LEFT,
      hold: true,
      hexesMoved: 0,
      canFire: true,
      shotsLeft: 1,
    });
  });

  it("says which units have the scenario's badge", () => {
    const session = playTurn([INFANTRY]);

    const [tank, infantry] = summarizeOrders(session.getSnapshot().orders, session.board);

    expect(tank!.elite).toBe(false);
    expect(infantry!.elite).toBe(true);
  });

  it("attaches each unit's shots and counts the shots it has left", () => {
    const session = playTurn();
    shoot(session, 1, AT_INFANTRY);
    const { orders, shots } = session.getSnapshot();

    const [, infantry] = summarizeOrders(orders, session.board, shots);

    expect(infantry!.shots).toHaveLength(1);
    expect(infantry!.shotsLeft).toBe(0);
    orders[1]!.shots = 2; // an order that fires twice
    expect(summarizeOrders(orders, session.board, shots)[1]!.shotsLeft).toBe(1);
  });

  it("marks units removed after the battle", () => {
    const session = playTurn();
    session.endBattle();
    session.removeUnit(INFANTRY);

    const summaries = summarizeOrders(session.getSnapshot().orders, session.board);

    expect(summaries.map((s) => s.removed)).toEqual([false, true]);
    expect(summaries[1]!.shotsLeft).toBe(0); // a destroyed unit can't fire
  });

  it("still finds a unit that was moved after battle", () => {
    const session = playTurn();
    session.endBattle();
    session.relocateUnit(FOREST, { row: 0, col: 0 });

    expect(summarizeOrders(session.getSnapshot().orders, session.board)[0]!.removed).toBe(false);
  });

  it("keeps a unit that moved waiting while a unit that didn't move has a shot left", () => {
    const session = playTurn();
    const { orders } = session.getSnapshot();
    // Pretend the tank could fire from the forest: a moved unit that fires
    orders[0]!.shots = 1;

    expect(summarizeOrders(orders, session.board)[0]!.waiting).toBe(true);

    const skipped = summarizeOrders(orders, session.board, [], true);
    expect(skipped[0]!.waiting).toBe(false);
    expect(skipped[1]).toMatchObject({ skipped: true, shotsLeft: 0 });

    shoot(session, 1, AT_INFANTRY);
    const afterShot = summarizeOrders(orders, session.board, session.getSnapshot().shots);
    expect(afterShot[0]!.waiting).toBe(false);
    expect(afterShot[1]!.skipped).toBe(false);
  });
});
