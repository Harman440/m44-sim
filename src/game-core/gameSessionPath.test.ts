import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import Hex from "./hex";
import { samePosition } from "./position";
import { HexType } from "../types/hex";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

const INF: Position = { row: 6, col: 4 };
/** Two hexes ahead of the infantry, and a hex beside the straight way there to go round by */
const AHEAD: Position = { row: 4, col: 4 };
const neighbors = (position: Position) => new Hex(position, HexType.PLAINS).getNeighbors();
const STEP = neighbors(INF).find((p) => neighbors(p).some((q) => samePosition(q, AHEAD)))!;
const ROUND = neighbors(INF).find((p) => !samePosition(p, STEP) && neighbors(p).some((q) => samePosition(q, AHEAD)))!;

const scenario: Scenario = {
  id: "path",
  name: same("Path"),
  description: same(""),
  attacker: "Allies",
  tiles: {},
  units: { allies: { infantry: [INF] }, axis: {} },
};

const ordering = () => {
  const session = new GameSession({ scenario, faction: "Allies", figures: true });
  expect(session.pickCard(null)).toBe(true);
  return session;
};

describe("GameSession paths picked hex by hex", () => {
  it("offers the hexes beside the path's end as the next steps", () => {
    const session = ordering();
    const first = session.getNextSteps(INF, "infantry:moveOut", [INF])!;
    expect(first.moves).toContainEqual(STEP);
    expect(first.moves).toHaveLength(6);
    // Move Out goes 2 hexes: after two steps there's none left
    const second = session.getNextSteps(INF, "infantry:moveOut", [INF, ROUND])!;
    expect(second.moves).toContainEqual(AHEAD);
    expect(second.moves).not.toContainEqual(INF); // never back onto a hex of the path
    expect(session.getNextSteps(INF, "infantry:moveOut", [INF, ROUND, AHEAD])!.moves).toEqual([]);
  });

  it("keeps the path the player picked", () => {
    const session = ordering();
    expect(session.giveAction(INF, "infantry:moveOut", AHEAD, [INF, ROUND, AHEAD])).toBe(true);
    expect(session.getSnapshot().orders[0]!.path).toEqual([INF, ROUND, AHEAD]);
  });

  it("refuses a path that jumps a hex, goes too far or doesn't end where the order does", () => {
    const session = ordering();
    expect(session.giveAction(INF, "infantry:moveOut", AHEAD, [INF, AHEAD])).toBe(false);
    expect(session.giveAction(INF, "infantry:moveOut", ROUND, [INF, STEP])).toBe(false);
    expect(session.giveAction(INF, "infantry:noRespite", AHEAD, [INF, ROUND, AHEAD])).toBe(false); // No Respite moves 1 hex
    expect(session.getSnapshot().orders).toEqual([]);
  });
});
