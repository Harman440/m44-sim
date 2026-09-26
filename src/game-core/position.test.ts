import { describe, expect, it } from "vitest";
import { includesPosition, positionKey, samePosition } from "./position";

describe("position helpers", () => {
  it("compares positions by value", () => {
    expect(samePosition({ row: 1, col: 2 }, { row: 1, col: 2 })).toBe(true);
    expect(samePosition({ row: 1, col: 2 }, { row: 2, col: 1 })).toBe(false);
  });

  it("builds row-col keys and finds positions in a list", () => {
    expect(positionKey({ row: 4, col: 10 })).toBe("4-10");
    expect(includesPosition([{ row: 0, col: 0 }, { row: 3, col: 5 }], { row: 3, col: 5 })).toBe(true);
    expect(includesPosition([], { row: 3, col: 5 })).toBe(false);
  });
});
