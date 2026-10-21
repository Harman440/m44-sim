import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import { VISION, VISION_FROM_HILL, inSight, seenHexes } from "./fogOfWar";
import { BASE_DICE_BY_DISTANCE } from "../data/fireQuestions";
import { UnitType } from "./unit";
import { newDraft } from "./scenarioDraft";
import { HexType } from "../types/hex";
import { Scenario } from "../types/scenario";

/** A board with the Allies' units on it and this terrain */
const board = (own: { row: number; col: number }[], tiles: Scenario["tiles"] = {}) =>
  new BoardManager({ ...newDraft("map-test"), tiles, units: { allies: { infantry: own }, axis: {} } }, "Allies");

describe("fog of war", () => {
  it("sees enemy units up to 4 hexes away in the open, not 5", () => {
    expect(VISION).toBe(4);
    const own = [{ row: 8, col: 6 }];
    expect(inSight(board(own), own, [{ row: 4, col: 6 }])).toEqual([{ row: 4, col: 6 }]);
    expect(inSight(board(own), own, [{ row: 3, col: 6 }])).toEqual([]);
  });

  it("sees 5 hexes from a hill", () => {
    expect(VISION_FROM_HILL).toBe(5);
    const own = [{ row: 8, col: 6 }];
    expect(inSight(board(own, { [HexType.HILL]: own }), own, [{ row: 3, col: 6 }])).toEqual([{ row: 3, col: 6 }]);
  });

  it("doesn't see through a forest, or past another enemy unit", () => {
    const own = [{ row: 8, col: 6 }];
    expect(inSight(board(own, { [HexType.FOREST]: [{ row: 6, col: 6 }] }), own, [{ row: 4, col: 6 }])).toEqual([]);
    expect(inSight(board(own), own, [{ row: 6, col: 6 }, { row: 4, col: 6 }])).toEqual([{ row: 6, col: 6 }]);
  });

  it("always sees a unit next to one of its own, and sees what any of its units sees", () => {
    const own = [{ row: 8, col: 0 }, { row: 2, col: 12 }];
    const forest = { [HexType.FOREST]: [{ row: 7, col: 0 }] };
    expect(inSight(board(own, forest), own, [{ row: 7, col: 0 }, { row: 1, col: 12 }])).toEqual([{ row: 7, col: 0 }, { row: 1, col: 12 }]);
  });

  it("sees every unit that can fire at one of its own, artillery aside", () => {
    for (const unitType of Object.values(UnitType).filter((type) => type !== UnitType.ARTILLERY)) {
      expect(BASE_DICE_BY_DISTANCE[unitType].length).toBeLessThanOrEqual(VISION);
    }
  });

  it("sees the hexes in its units' sight, its own among them", () => {
    const own = [{ row: 8, col: 6 }];
    const keys = (enemies: string[] = []) =>
      seenHexes(board(own, { [HexType.FOREST]: [{ row: 6, col: 6 }] }), own, new Set(enemies)).map(({ row, col }) => `${row}-${col}`);
    expect(keys()).toContain("8-6");
    expect(keys()).toContain("6-6");
    // Behind the forest, and too far
    expect(keys()).not.toContain("4-6");
    expect(keys()).not.toContain("8-1");
    expect(keys()).toContain("8-2");
    // An enemy unit blocks the view past it
    expect(keys(["8-4"])).not.toContain("8-3");
  });
});
