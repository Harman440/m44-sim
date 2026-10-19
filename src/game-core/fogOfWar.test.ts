import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import { VISION, VISION_FROM_HILL, inSight } from "./fogOfWar";
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
});
