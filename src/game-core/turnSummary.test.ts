import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import CommandCard, { CommandCardType } from "./commandCard";
import { summarizeOrders } from "./turnSummary";
import { UnitType } from "./unit";
import { HexType, Side } from "../types/hex";
import { Position } from "../types/scenario";

const TANK: Position = { row: 4, col: 6 };
const FOREST: Position = { row: 4, col: 7 };
const INFANTRY: Position = { row: 7, col: 1 };

const playTurn = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      tiles: { forest: [FOREST] },
      units: { allies: { tank: [TANK], infantry: [INFANTRY] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "all", type: CommandCardType.ALLSIDES, maxTotalOrders: 6 })],
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
      section: Side.CENTER,
      hold: false,
      hexesMoved: 1,
      destinationTerrain: HexType.FOREST,
      canFire: false, // moved into forest
      removed: false,
    });
    expect(infantry).toMatchObject({
      index: 1,
      unitType: UnitType.INFANTRY,
      section: Side.LEFT,
      hold: true,
      hexesMoved: 0,
      canFire: true,
    });
  });

  it("marks units removed during the battle", () => {
    const session = playTurn();
    session.removeUnit(INFANTRY);

    const summaries = summarizeOrders(session.getSnapshot().orders, session.board);

    expect(summaries.map((s) => s.removed)).toEqual([false, true]);
  });

  it("still finds a unit that was moved after battle", () => {
    const session = playTurn();
    session.relocateUnit(FOREST, { row: 0, col: 0 });

    expect(summarizeOrders(session.getSnapshot().orders, session.board)[0]!.removed).toBe(false);
  });
});
