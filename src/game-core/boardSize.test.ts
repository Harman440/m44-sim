import { describe, expect, it } from "vitest";
import { STANDARD_BOARD, boardPositions, isBoardSize, isOnBoard, sectionLines } from "./boardSize";
import BoardManager, { turnedRound } from "./BoardManager";
import Hex from "./hex";
import { Side } from "../types/hex";
import { scenarios } from "../data/scenarios";

/** Each long row's sections, as letters: L, C, R and the borders l (left-center) and r (right-center) */
const sectionsOf = (cols: number, row: number) => {
  const letter = { [Side.LEFT]: "L", [Side.LEFT_CENTER]: "l", [Side.CENTER]: "C", [Side.RIGHT_CENTER]: "r", [Side.RIGHT]: "R" };
  return [...Array(cols - (row % 2)).keys()].map((col) => letter[new Hex({ row, col }, undefined, cols).getSide()]).join("");
};

describe("board sizes", () => {
  it("take odd rows within the limits", () => {
    expect(isBoardSize(STANDARD_BOARD)).toBe(true);
    expect(isBoardSize({ cols: 21, rows: 17 })).toBe(true);
    expect(isBoardSize({ cols: 15, rows: 10 })).toBe(false);
    expect(isBoardSize({ cols: 12, rows: 9 })).toBe(false);
    expect(isBoardSize({ cols: 22, rows: 9 })).toBe(false);
  });

  it("know their hexes, short rows one fewer", () => {
    expect(boardPositions(STANDARD_BOARD)).toHaveLength(5 * 13 + 4 * 12);
    expect(isOnBoard({ row: 1, col: 13 }, { cols: 15, rows: 11 })).toBe(true);
    expect(isOnBoard({ row: 1, col: 14 }, { cols: 15, rows: 11 })).toBe(false);
  });

  it("split the standard board 4, 5 and 4, the border hexes in the short rows", () => {
    expect(sectionLines(13)).toEqual({ left: 3.5, right: 8.5 });
    expect(sectionsOf(13, 0)).toBe("LLLLCCCCCRRRR");
    expect(sectionsOf(13, 1)).toBe("LLLlCCCCrRRR");
  });

  it("split a bigger board in thirds, the same from either end", () => {
    expect(sectionsOf(15, 0)).toBe("LLLLLCCCCCRRRRR");
    expect(sectionsOf(15, 1)).toBe("LLLLlCCCCrRRRR");
    expect(sectionsOf(17, 0)).toBe("LLLLLLCCCCCRRRRRR");
    for (const cols of [14, 16, 18, 19, 20, 21]) {
      const even = sectionsOf(cols, 0);
      const odd = sectionsOf(cols, 1);
      expect([...even].reverse().join("").replace(/[LR]/g, (c) => (c === "L" ? "R" : "L"))).toBe(even);
      expect([...odd].reverse().join("").replace(/[lLrR]/g, (c) => ({ L: "R", R: "L", l: "r", r: "l" })[c]!)).toBe(odd);
    }
  });

  it("turn round on their own size, twice giving the hex back", () => {
    const size = { cols: 17, rows: 13 };
    expect(turnedRound({ row: 0, col: 0 }, size)).toEqual({ row: 12, col: 16 });
    expect(turnedRound({ row: 1, col: 0 }, size)).toEqual({ row: 11, col: 15 });
    for (const position of boardPositions(size)) expect(turnedRound(turnedRound(position, size), size)).toEqual(position);
  });

  it("lay out a scenario's board at its size, for either side", () => {
    const scenario = { ...scenarios[0]!, board: { cols: 15, rows: 11 }, units: { allies: { infantry: [{ row: 10, col: 14 }] }, axis: {} } };

    const allies = new BoardManager(scenario, "Allies");
    const axis = new BoardManager(scenario, "Axis");

    expect(allies.hexes.size).toBe(boardPositions({ cols: 15, rows: 11 }).length);
    expect(allies.getHex({ row: 10, col: 14 })?.unit).not.toBeNull();
    expect(axis.getHex({ row: 0, col: 0 })).not.toBeNull();
    expect(allies.getHex({ row: 0, col: 0 })?.getSide()).toBe(Side.LEFT);
  });
});
