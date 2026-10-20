import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import Unit, { UnitType } from "./unit";
import { HexType } from "../types/hex";
import { Position, Scenario } from "../types/scenario";
import { Faction } from "../types/faction";
import { positionKey as key, samePosition } from "./position";
import { same } from "../i18n/lang";

const makeScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "test",
  name: { es: "Test", en: "Test" },
  description: same(""),
  initialHandSize: { allies: 3, axis: 3 },
  attacker: "Allies",
  tiles: {},
  units: { allies: {}, axis: {} },
  ...overrides,
});

const unitPositions = (board: BoardManager) =>
  board.getAllHexes().filter((h) => h.hasUnit()).map((h) => key(h.getPosition()));

/** Destinations only, sorted by key */
const destinations = (board: BoardManager, range: number, forFire = false) =>
  board
    .calculatePossibleMovesWithPaths(board.getHex({ row: 4, col: 6 })!, range, forFire)
    .map((r) => key(r.position));

const isAdjacent = (a: Position, b: Position, board: BoardManager) =>
  board.getHex(a)!.getNeighbors().some((n) => samePosition(n, b));

describe("BoardManager setup", () => {
  it("builds a 13x9 board where odd rows have one fewer hex", () => {
    const board = new BoardManager(makeScenario());

    expect(board.getAllHexes()).toHaveLength(5 * 13 + 4 * 12);
    expect(board.getHex({ row: 1, col: 12 })).toBeNull();
    expect(board.getHex({ row: 0, col: 12 })).not.toBeNull();
  });

  it("rejects a terrain it doesn't know, rather than playing it as plains", () => {
    const tiles = { forrest: [{ row: 0, col: 0 }] } as Scenario["tiles"];
    expect(() => new BoardManager(makeScenario({ tiles }))).toThrow("Unknown terrain: forrest");
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

  it("places both sides' units and every sandbag for the map editor, from the Allies' side", () => {
    const scenario = makeScenario({
      units: {
        allies: { infantry: [{ row: 7, col: 1 }] },
        axis: { tank: [{ row: 0, col: 4 }] },
      },
      sandbags: [{ row: 0, col: 4 }],
      elite: [{ row: 0, col: 4 }],
    });
    const board = new BoardManager(scenario, "Allies", { bothSides: true });

    expect(unitPositions(board).sort()).toEqual(["0-4", "7-1"]);
    expect(board.getHex({ row: 0, col: 4 })).toMatchObject({ sandbags: true, unit: { elite: true } });
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

    const forests = board.getAllHexes().filter((h) => h.getType() === HexType.FOREST);
    expect(forests).toHaveLength(everyHex.length);
  });

  it("rejects an unknown faction (e.g. from a tampered save)", () => {
    expect(() => new BoardManager(makeScenario(), "Soviets" as Faction)).toThrow("Invalid faction");
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

    const moves = destinations(board, 2);

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

    const firePositions = destinations(board, 1, true);

    expect(firePositions.sort()).toEqual(["3-5", "4-5", "5-5", "5-6"]);
  });

  it("enters a hedgerow only from the hex the move starts on, and stops there", () => {
    // 4-7 is next to the start (4-6); 4-9 is two hexes away
    const scenario = makeScenario({ tiles: { hedgerow: [{ row: 4, col: 7 }, { row: 4, col: 9 }] } });
    const board = new BoardManager(scenario);

    const reachable = destinations(board, 3);

    expect(reachable).toContain("4-7");
    expect(reachable).not.toContain("4-9");
    expect(reachable).toContain("4-8"); // round the hedgerow
    expect(destinations(board, 1, true)).not.toContain("4-7"); // can't fire after entering
  });

  it("moves a unit that starts on a hedgerow only 1 hex", () => {
    const scenario = makeScenario({ tiles: { hedgerow: [start] } });
    const board = new BoardManager(scenario);

    expect(destinations(board, 3).sort()).toEqual(["3-5", "3-6", "4-5", "4-7", "5-5", "5-6"]);
  });

  it("moves a unit at most 2 hexes once its move starts on a beach or enters one, whatever it could move", () => {
    // From a beach, 4 hexes of move are 2
    const fromBeach = new BoardManager(makeScenario({ tiles: { beach: [start] } }));
    expect(Math.max(...fromBeach.calculatePossibleMovesWithPaths(fromBeach.getHex(start)!, 4).map((r) => r.cost))).toBe(2);
    const ignoring = fromBeach.calculatePossibleMovesWithPaths(fromBeach.getHex(start)!, 4, false, { ignoreTerrain: true });
    expect(Math.max(...ignoring.map((r) => r.cost))).toBe(2);

    // A beach next to the start (4-7): through it, no further than 2 hexes; round it, the whole move
    const board = new BoardManager(makeScenario({ tiles: { beach: [{ row: 4, col: 7 }] } }));
    const results = board.calculatePossibleMovesWithPaths(board.getHex(start)!, 4);
    for (const result of results) {
      if (result.path.slice(1).some((p) => key(p) === "4-7")) expect(result.cost).toBeLessThanOrEqual(2);
    }
    expect(Math.max(...results.map((r) => r.cost))).toBe(4); // the whole move, round the beach
    expect(results.find((r) => key(r.position) === "4-8")?.cost).toBe(2);
  });

  it("stops a unit that enters a swamp, which can still fire, and moves one leaving it 1 hex", () => {
    const into = new BoardManager(makeScenario({ tiles: { swamp: [{ row: 4, col: 7 }] } }));
    for (const result of into.calculatePossibleMovesWithPaths(into.getHex(start)!, 3)) {
      expect(result.path.slice(1, -1).map(key)).not.toContain("4-7");
    }
    expect(destinations(into, 1, true)).toContain("4-7");

    const out = new BoardManager(makeScenario({ tiles: { swamp: [start] } }));
    expect(destinations(out, 3).sort()).toEqual(["3-5", "3-6", "4-5", "4-7", "5-5", "5-6"]);
  });

  it("moves a unit 1 hex out of the ocean or into it, and lets it fire from nowhere in it", () => {
    const out = new BoardManager(makeScenario({ tiles: { ocean: [start] } }));
    expect(destinations(out, 3).sort()).toEqual(["3-5", "3-6", "4-5", "4-7", "5-5", "5-6"]);

    const into = new BoardManager(makeScenario({ tiles: { ocean: [{ row: 4, col: 7 }] } }));
    const results = into.calculatePossibleMovesWithPaths(into.getHex(start)!, 3);
    expect(results.filter((r) => r.path.slice(1).some((p) => key(p) === "4-7")).map((r) => r.cost)).toEqual([1]);
    expect(destinations(into, 1, true)).not.toContain("4-7");
  });

  it("ignores the hedgerow limits when a card ignores terrain", () => {
    const scenario = makeScenario({ tiles: { hedgerow: [start, { row: 4, col: 9 }] } });
    const board = new BoardManager(scenario);

    const moves = board
      .calculatePossibleMovesWithPaths(board.getHex(start)!, 3, false, { ignoreTerrain: true })
      .map((r) => key(r.position));

    expect(moves).toContain("4-9");
  });

  it("cannot enter a river or a lake, but crosses a river by its bridge", () => {
    // A river along column 7 (4-7 and the hexes above and below), with a bridge on 4-7
    const river = [{ row: 3, col: 6 }, { row: 5, col: 6 }, { row: 2, col: 7 }, { row: 6, col: 7 }];
    const scenario = makeScenario({ tiles: { river, bridge: [{ row: 4, col: 7 }], lake: [{ row: 4, col: 5 }] } });
    const board = new BoardManager(scenario);

    const moves = destinations(board, 2);

    for (const water of [...river, { row: 4, col: 5 }]) expect(moves).not.toContain(key(water));
    expect(moves).toContain("4-7"); // the bridge, like plains: the move goes on
    expect(moves).toContain("4-8");
    expect(destinations(board, 1, true)).toContain("4-7");
  });

  it("puts no unit on water", () => {
    const board = new BoardManager(makeScenario({ tiles: { river: [start] } }));
    expect(board.placeUnitAt(start, new Unit(UnitType.INFANTRY))).toBe(false);
  });

  it("looks up the path from start to each destination by key", () => {
    const board = new BoardManager(makeScenario());
    const paths = board.getAllPaths(board.getHex(start)!, 2);

    expect(paths.get("4-8")).toEqual([start, { row: 4, col: 7 }, { row: 4, col: 8 }]);
    expect(paths.has("4-10")).toBe(false); // out of range
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
});
