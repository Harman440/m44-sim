import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import { MarkerRule } from "./combatCard";
import { canMark, markablePositions } from "./markerRules";
import { UnitType } from "./unit";
import { includesPosition } from "./position";
import { Position, Scenario } from "../types/scenario";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 4, col: 6 };
const FAR: Position = { row: 1, col: 10 };

const board = new BoardManager(
  {
    id: "test",
    name: "Test",
    description: "",
    initialHandSize: { allies: 1, axis: 1 },
    attacker: "Allies",
    tiles: {},
    units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
  } satisfies Scenario,
  "Allies"
);
const neighbors = (p: Position) => board.getHex(p)!.getNeighbors().filter((n) => board.getHex(n));

describe("canMark", () => {
  const barrage: MarkerRule = { kind: "target", count: 1 };

  it("marks any hex without one of your units, up to the count", () => {
    expect(canMark(barrage, board, [], FAR)).toBe(true);
    expect(canMark(barrage, board, [], INFANTRY)).toBe(false);
    expect(canMark(barrage, board, [FAR], neighbors(FAR)[0]!)).toBe(false);
  });

  it("never marks the same hex twice", () => {
    expect(canMark({ kind: "target", count: 2 }, board, [FAR], FAR)).toBe(false);
  });

  it("keeps Air Power's hexes in a chain, each next to the one before", () => {
    const airPower: MarkerRule = { kind: "target", count: 4, chain: true };
    const next = neighbors(FAR)[0]!;
    const farAway = { row: 8, col: 11 };

    expect(canMark(airPower, board, [FAR], next)).toBe(true);
    expect(canMark(airPower, board, [FAR], farAway)).toBe(false);
    expect(markablePositions(airPower, board, [FAR]).every((p) => includesPosition(neighbors(FAR), p))).toBe(true);
  });

  it("keeps Air Bombardment away from your units", () => {
    const bombardment: MarkerRule = { kind: "target", count: 2, awayFromOwnUnits: true };

    expect(canMark(bombardment, board, [], neighbors(TANK)[0]!)).toBe(false);
    expect(canMark(bombardment, board, [], FAR)).toBe(true);
  });

  it("puts the Sniper's cross on an empty hex next to your infantry", () => {
    const sniper: MarkerRule = { kind: "cross", count: 1, nextTo: UnitType.INFANTRY };

    expect(canMark(sniper, board, [], neighbors(INFANTRY)[0]!)).toBe(true);
    expect(canMark(sniper, board, [], neighbors(TANK)[0]!)).toBe(false);
    expect(canMark(sniper, board, [], INFANTRY)).toBe(false);
    expect(markablePositions(sniper, board, []).length).toBeLessThanOrEqual(6);
  });
});
