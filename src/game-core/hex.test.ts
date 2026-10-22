import { describe, expect, it } from "vitest";
import Hex from "./hex";
import Unit from "./unit";
import { HexType } from "../types/hex";
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

describe("Hex terrain", () => {
  it.each([
    [HexType.PLAINS, true, true],
    [HexType.HILL, true, true],
    [HexType.BRIDGE, true, true],
    [HexType.FOREST, false, false],
    [HexType.TOWN, false, false],
    [HexType.HEDGEROW, false, false],
  ])("%s: the move goes on: %s, can fire after moving in: %s", (type, goesOn, fireAfterMove) => {
    const hex = new Hex({ row: 0, col: 0 }, type);

    expect(hex.canEnter()).toBe(true);
    expect(hex.canContinueMovement()).toBe(goesOn);
    expect(hex.getTerrain().fireAfterMove).toBe(fireAfterMove);
  });

  it.each([HexType.RIVER, HexType.LAKE])("%s: no unit can enter it or stand on it", (type) => {
    const hex = new Hex({ row: 0, col: 0 }, type);

    expect(hex.canEnter()).toBe(false);
    expect(hex.isPassable()).toBe(false);
    expect(hex.placeUnit(new Unit())).toBe(false);
  });

  it("stops a move on barbed wire, whatever the terrain", () => {
    const hex = new Hex({ row: 0, col: 0 }, HexType.PLAINS);
    hex.setWire(true);

    expect(hex.canContinueMovement()).toBe(false);
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
