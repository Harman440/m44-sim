import { beforeEach, describe, expect, it, vi } from "vitest";
import BoardManager from "./BoardManager";
import CommandCard, { CommandCardType } from "./commandCard";
import { HexType, Side } from "../types/hex";
import { Position, Scenario } from "../types/scenario";

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "test",
  name: "Test",
  description: "",
  tiles: {},
  units: { allies: {}, axis: {} },
  ...overrides,
});

const key = (p: Position) => `${p.row}-${p.col}`;

const unitPositions = (board: BoardManager) =>
  board.getAllHexes().filter((h) => h.hasUnit()).map((h) => key(h.getPosition()));

const orderablePositions = (board: BoardManager) =>
  board
    .getAllHexes()
    .filter((h) => h.unit?.isOrderable())
    .map((h) => key(h.getPosition()))
    .sort();

const card = (type: CommandCardType, maxTotalOrders: number) =>
  new CommandCard({ type, maxTotalOrders });

const isAdjacent = (a: Position, b: Position, board: BoardManager) =>
  board.getHex(a)!.getNeighbors().some((n) => n.row === b.row && n.col === b.col);

beforeEach(() => {
  // BoardManager logs while pathfinding; keep test output readable
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("BoardManager setup", () => {
  it("builds a 13x9 board where odd rows have one fewer hex", () => {
    const board = new BoardManager(makeScenario());

    expect(board.getAllHexes()).toHaveLength(5 * 13 + 4 * 12);
    expect(board.getHex({ row: 1, col: 12 })).toBeNull();
    expect(board.getHex({ row: 0, col: 12 })).not.toBeNull();
  });

  it("places only the units of the chosen faction", () => {
    const scenario = makeScenario({
      units: {
        allies: { infantry: [{ row: 7, col: 1 }] },
        axis: { tank: [{ row: 0, col: 4 }] },
      },
    });

    expect(unitPositions(new BoardManager(scenario, "Allies"))).toEqual(["7-1"]);
  });

  it("rotates positions 180 degrees for Axis", () => {
    const scenario = makeScenario({
      tiles: { forest: [{ row: 1, col: 3 }] },
      units: {
        allies: {},
        axis: { infantry: [{ row: 0, col: 4 }, { row: 1, col: 0 }] },
      },
    });

    const board = new BoardManager(scenario, "Axis");

    expect(unitPositions(board).sort()).toEqual(["7-11", "8-8"]);
    expect(board.getHex({ row: 7, col: 8 })!.getType()).toBe(HexType.FOREST);
  });

  it("maps every board hex onto a distinct board hex when flipping for Axis", () => {
    const everyHex = new BoardManager(makeScenario()).getAllHexes().map((h) => h.getPosition());
    const scenario = makeScenario({ tiles: { forest: everyHex } });

    const board = new BoardManager(scenario, "Axis");

    expect(board.getHexesByType(HexType.FOREST)).toHaveLength(everyHex.length);
  });

  it("rejects an unknown faction", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => new BoardManager(makeScenario(), "Soviets")).toThrow("Invalid faction");
  });

  it("counts hexes by terrain", () => {
    const scenario = makeScenario({
      tiles: { forest: [{ row: 2, col: 2 }], town: [{ row: 3, col: 3 }, { row: 4, col: 4 }] },
    });

    expect(new BoardManager(scenario).getStats()).toEqual({
      plains: 113 - 3,
      forest: 1,
      hill: 0,
      town: 2,
    });
  });
});

describe("BoardManager.setOrderableUnits", () => {
  // One unit per section: (7,1) left, (7,3) left-center, (8,4) center tank,
  // (8,6) center, (7,8) right-center, (8,11) right
  const scenario = makeScenario({
    units: {
      allies: {
        infantry: [
          { row: 7, col: 1 }, { row: 7, col: 3 }, { row: 8, col: 6 },
          { row: 7, col: 8 }, { row: 8, col: 11 },
        ],
        tank: [{ row: 8, col: 4 }],
      },
      axis: {},
    },
  });

  it("uses the sections the test scenario expects", () => {
    const board = new BoardManager(scenario);
    const sideOf = (row: number, col: number) => board.getHex({ row, col })!.getSide();

    expect(sideOf(7, 1)).toBe(Side.LEFT);
    expect(sideOf(7, 3)).toBe(Side.LEFT_CENTER);
    expect(sideOf(8, 4)).toBe(Side.CENTER);
    expect(sideOf(7, 8)).toBe(Side.RIGHT_CENTER);
    expect(sideOf(8, 11)).toBe(Side.RIGHT);
  });

  it.each([
    ["LEFT", CommandCardType.LEFT, 2, ["7-1", "7-3"], 2],
    ["CENTER", CommandCardType.CENTER, 3, ["7-3", "7-8", "8-4", "8-6"], 3],
    ["RIGHT", CommandCardType.RIGHT, 4, ["7-8", "8-11"], 2],
    ["ALLSIDES", CommandCardType.ALLSIDES, 6, ["7-1", "7-3", "7-8", "8-11", "8-4", "8-6"], 6],
    ["TANK", CommandCardType.TANK, 4, ["8-4"], 1],
    ["ARTILLERY", CommandCardType.ARTILLERY, 4, [], 0],
    ["INFANTRY", CommandCardType.INFANTRY, 2, ["7-1", "7-3", "7-8", "8-11", "8-6"], 2],
  ])(
    "%s card marks the right units and caps orders at the units available",
    (_name, type, maxOrders, expectedOrderable, expectedOrders) => {
      const board = new BoardManager(scenario);

      const orders = board.setOrderableUnits(card(type, maxOrders));

      expect(orderablePositions(board)).toEqual([...expectedOrderable].sort());
      expect(orders).toBe(expectedOrders);
    }
  );

  it("clears the previous card's orderable units (B9)", () => {
    const board = new BoardManager(scenario);
    board.setOrderableUnits(card(CommandCardType.LEFT, 2));

    board.setOrderableUnits(card(CommandCardType.RIGHT, 2));

    expect(orderablePositions(board)).toEqual(["7-8", "8-11"]);
  });

  it("setUnitsNotOrdable clears every orderable flag", () => {
    const board = new BoardManager(scenario);
    board.setOrderableUnits(card(CommandCardType.ALLSIDES, 6));

    board.setUnitsNotOrdable();

    expect(orderablePositions(board)).toEqual([]);
  });

  it("still finds units by section after reset()", () => {
    const board = new BoardManager(scenario);

    board.reset(scenario);
    const orders = board.setOrderableUnits(card(CommandCardType.LEFT, 2));

    expect(orders).toBe(2);
    expect(orderablePositions(board)).toEqual(["7-1", "7-3"]);
  });
});

describe("BoardManager pathfinding", () => {
  const start: Position = { row: 4, col: 6 };

  it("reaches every hex within range on open ground", () => {
    const board = new BoardManager(makeScenario());

    const results = board.calculatePossibleMovesWithPaths(board.getHex(start)!, 2);

    // 6 hexes at distance 1 plus 12 at distance 2
    expect(results).toHaveLength(18);
    for (const result of results) {
      expect(result.path[0]).toEqual(start);
      expect(result.path.at(-1)).toEqual(result.position);
      expect(result.path).toHaveLength(result.cost + 1);
      for (let i = 1; i < result.path.length; i++) {
        expect(isAdjacent(result.path[i - 1]!, result.path[i]!, board)).toBe(true);
      }
    }
  });

  it("cannot move into or through a hex occupied by another unit", () => {
    const scenario = makeScenario({
      units: { allies: { infantry: [start, { row: 4, col: 7 }] }, axis: {} },
    });
    const board = new BoardManager(scenario);

    const moves = board.calculatePossibleMoves(board.getHex(start)!, 2).map(key);

    expect(moves).not.toContain("4-7");
    // (4,8) is two hexes east; its only shortest route goes through (4,7)
    expect(moves).not.toContain("4-8");
  });

  it("stops movement on entering forest", () => {
    const scenario = makeScenario({ tiles: { forest: [{ row: 4, col: 7 }] } });
    const board = new BoardManager(scenario);

    const results = board.calculatePossibleMovesWithPaths(board.getHex(start)!, 2);
    const reachable = results.map((r) => key(r.position));

    expect(reachable).toContain("4-7");
    expect(reachable).not.toContain("4-8");
    for (const result of results) {
      const throughHexes = result.path.slice(1, -1);
      expect(throughHexes.map(key)).not.toContain("4-7");
    }
  });

  it("excludes forest and town from move-and-fire destinations", () => {
    const scenario = makeScenario({
      tiles: { forest: [{ row: 4, col: 7 }], town: [{ row: 3, col: 6 }] },
    });
    const board = new BoardManager(scenario);

    const firePositions = board.calculatePossibleMoves(board.getHex(start)!, 1, true).map(key);

    expect(firePositions.sort()).toEqual(["3-5", "4-5", "5-5", "5-6"]);
  });

  it("returns the path from start to destination, or null when unreachable", () => {
    const board = new BoardManager(makeScenario());
    const startHex = board.getHex(start)!;

    const path = board.getPathToDestination(startHex, { row: 4, col: 8 }, 2);

    expect(path).toEqual([start, { row: 4, col: 7 }, { row: 4, col: 8 }]);
    expect(board.getPathToDestination(startHex, { row: 4, col: 10 }, 2)).toBeNull();
  });
});

describe("BoardManager.moveUnit", () => {
  const scenario = makeScenario({
    units: { allies: { infantry: [{ row: 4, col: 6 }, { row: 4, col: 8 }] }, axis: {} },
  });

  it("moves a unit to an empty hex", () => {
    const board = new BoardManager(scenario);
    const unit = board.getHex({ row: 4, col: 6 })!.unit;

    expect(board.moveUnit({ row: 4, col: 6 }, { row: 4, col: 7 })).toBe(true);
    expect(board.getHex({ row: 4, col: 6 })!.unit).toBeNull();
    expect(board.getHex({ row: 4, col: 7 })!.unit).toBe(unit);
  });

  it("refuses to move onto another unit or from an empty hex", () => {
    const board = new BoardManager(scenario);

    expect(board.moveUnit({ row: 4, col: 6 }, { row: 4, col: 8 })).toBe(false);
    expect(board.moveUnit({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(false);
    expect(unitPositions(board).sort()).toEqual(["4-6", "4-8"]);
  });

  it("removeOrders clears ordered and ready-to-fire flags", () => {
    const board = new BoardManager(scenario);
    const unit = board.getHex({ row: 4, col: 6 })!.unit!;
    unit.giveOrder(true);

    board.removeOrders();

    expect(unit.isOrdered()).toBe(false);
    expect(unit.isReadyToFire()).toBe(false);
  });
});
