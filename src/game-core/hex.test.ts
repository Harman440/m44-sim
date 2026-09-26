import { describe, expect, it } from "vitest";
import Hex from "./hex";
import Unit from "./unit";
import { HexType, MovementRule, Side } from "../types/hex";
import { Position } from "../types/scenario";

const WIDTH = 13;
const HEIGHT = 9;

const allBoardPositions = (): Position[] => {
  const positions: Position[] = [];
  for (let row = 0; row < HEIGHT; row++) {
    const rowWidth = WIDTH - (row % 2);
    for (let col = 0; col < rowWidth; col++) positions.push({ row, col });
  }
  return positions;
};

const sortPositions = (positions: Position[]) =>
  [...positions].sort((a, b) => a.row - b.row || a.col - b.col);

describe("Hex neighbors (odd rows shifted right)", () => {
  it("returns the 6 neighbors of a hex on an even row", () => {
    const hex = new Hex({ row: 4, col: 6 });

    expect(sortPositions(hex.getNeighbors())).toEqual(
      sortPositions([
        { row: 4, col: 5 }, { row: 4, col: 7 },
        { row: 3, col: 5 }, { row: 3, col: 6 },
        { row: 5, col: 5 }, { row: 5, col: 6 },
      ])
    );
  });

  it("returns the 6 neighbors of a hex on an odd row", () => {
    const hex = new Hex({ row: 3, col: 6 });

    expect(sortPositions(hex.getNeighbors())).toEqual(
      sortPositions([
        { row: 3, col: 5 }, { row: 3, col: 7 },
        { row: 2, col: 6 }, { row: 2, col: 7 },
        { row: 4, col: 6 }, { row: 4, col: 7 },
      ])
    );
  });

  it("is symmetric: every neighbor lists the original hex back", () => {
    for (const position of allBoardPositions()) {
      const hex = new Hex(position);
      for (const neighborPos of hex.getNeighbors()) {
        const backLinks = new Hex(neighborPos).getNeighbors();
        expect(backLinks).toContainEqual(position);
      }
    }
  });
});

describe("Hex sections", () => {
  const side = (row: number, col: number) => new Hex({ row, col }).getSide();

  it("splits even rows 4 / 5 / 4 into left, center and right", () => {
    expect([0, 1, 2, 3].map((c) => side(0, c))).toEqual(Array(4).fill(Side.LEFT));
    expect([4, 5, 6, 7, 8].map((c) => side(0, c))).toEqual(Array(5).fill(Side.CENTER));
    expect([9, 10, 11, 12].map((c) => side(0, c))).toEqual(Array(4).fill(Side.RIGHT));
  });

  it("puts the border hexes of odd rows in the shared left-center / right-center sections", () => {
    expect([0, 1, 2].map((c) => side(1, c))).toEqual(Array(3).fill(Side.LEFT));
    expect(side(1, 3)).toBe(Side.LEFT_CENTER);
    expect([4, 5, 6, 7].map((c) => side(1, c))).toEqual(Array(4).fill(Side.CENTER));
    expect(side(1, 8)).toBe(Side.RIGHT_CENTER);
    expect([9, 10, 11].map((c) => side(1, c))).toEqual(Array(3).fill(Side.RIGHT));
  });
});

describe("Hex terrain", () => {
  it.each([
    [HexType.PLAINS, MovementRule.NORMAL, true],
    [HexType.HILL, MovementRule.NORMAL, true],
    [HexType.FOREST, MovementRule.STOP, false],
    [HexType.TOWN, MovementRule.STOP, false],
  ])("%s: movement rule %s, can move and fire: %s", (type, rule, canMoveAndFire) => {
    const hex = new Hex({ row: 0, col: 0 }, type);

    expect(hex.getMovementRule()).toBe(rule);
    expect(hex.getCanMoveAndFire()).toBe(canMoveAndFire);
    expect(hex.canContinueMovement()).toBe(rule !== MovementRule.STOP);
    expect(hex.getMovementCost()).toBe(1);
  });

  it("applies overrides on top of the terrain defaults", () => {
    const hex = new Hex({ row: 0, col: 0 }, HexType.PLAINS, {
      movementRule: MovementRule.BLOCK,
    });

    expect(hex.isPassable()).toBe(false);
    expect(hex.canEnter()).toBe(false);
  });
});

describe("Hex units", () => {
  it("rejects a second unit but lets the same unit be placed again", () => {
    const hex = new Hex({ row: 0, col: 0 });
    const first = new Unit();
    const second = new Unit();

    expect(hex.placeUnit(first)).toBe(true);
    expect(hex.placeUnit(second)).toBe(false);
    expect(hex.placeUnit(first)).toBe(true);
    expect(hex.unit).toBe(first);
  });

  it("is not passable while occupied", () => {
    const hex = new Hex({ row: 0, col: 0 });
    hex.placeUnit(new Unit());

    expect(hex.isPassable()).toBe(false);

    hex.removeUnit();
    expect(hex.isPassable()).toBe(true);
  });
});
