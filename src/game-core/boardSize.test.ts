import { describe, expect, it } from "vitest";
import { STANDARD_BOARD, boardPositions, isBoardSize, isOnBoard } from "./boardSize";
import BoardManager, { turnedRound } from "./BoardManager";
import { scenarios } from "../data/scenarios";

describe("board sizes", () => {
  it("take odd rows within the limits", () => {
    expect(isBoardSize(STANDARD_BOARD)).toBe(true);
    expect(isBoardSize({ cols: 26, rows: 9 })).toBe(true);
    expect(isBoardSize({ cols: 33, rows: 25 })).toBe(true);
    expect(isBoardSize({ cols: 15, rows: 10 })).toBe(false);
    expect(isBoardSize({ cols: 12, rows: 9 })).toBe(false);
    expect(isBoardSize({ cols: 34, rows: 9 })).toBe(false);
    expect(isBoardSize({ cols: 13, rows: 27 })).toBe(false);
  });

  it("know their hexes, short rows one fewer", () => {
    expect(boardPositions(STANDARD_BOARD)).toHaveLength(5 * 13 + 4 * 12);
    expect(isOnBoard({ row: 1, col: 13 }, { cols: 15, rows: 11 })).toBe(true);
    expect(isOnBoard({ row: 1, col: 14 }, { cols: 15, rows: 11 })).toBe(false);
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
  });
});
