import { describe, expect, it } from "vitest";
import { BOARD_KEYS, artGrid, canPaintRivers, drawnSvg, neighbor, pickFor, planBoard } from "./boardPlan.mjs";
import type { DrawnHex, HexArt, Terrain } from "./boardPlan.mjs";
import boards from "../../scripts/boards.json";
import { scenarios } from "../data/scenarios";
import { positionKey } from "../game-core/position";

const LIBRARY = { forest: ["official.webp"], hedgerow: ["official.webp"], hill: ["official.webp"], river: ["3-0.webp", "5-1.webp"], town: ["official.webp"] };
// Three river hexes round one corner: each turns sharply, which no river tile does
const SHARP_BEND: Terrain = { river: [{ row: 4, col: 5 }, { row: 4, col: 4 }, { row: 5, col: 4 }] };
const p = (row: number, col: number) => ({ row, col });
const keysOf = (plan: HexArt[]) => [...new Set(plan.map((hex) => hex.key))];
const at = (plan: HexArt[], key: string) => plan.filter((hex) => hex.key === key);

describe("the board's grid", () => {
  it("has 13 hexes in even rows and 12 in odd ones", () => {
    expect(BOARD_KEYS).toHaveLength(5 * 13 + 4 * 12);
    expect(BOARD_KEYS).toContain("1-11");
    expect(BOARD_KEYS).not.toContain("1-12");
  });

  it("lays the painted art out as `npm run board` does", () => {
    const grid = artGrid(1514);

    expect(grid.width).toBe(2435);
    expect(grid.center("0-0")).toEqual({ x: grid.hexWidth / 2, y: grid.radius });
    expect(grid.center("1-0").x).toBeCloseTo(grid.hexWidth);
  });

  it("finds the hex across each edge, odd rows shifted right", () => {
    expect([...Array(6).keys()].map((d) => neighbor("2-3", d))).toEqual(["2-4", "3-3", "3-2", "2-2", "1-2", "1-3"]);
    expect([...Array(6).keys()].map((d) => neighbor("1-3", d))).toEqual(["1-4", "2-4", "2-3", "1-2", "0-3", "0-4"]);
  });

  it("picks the same tile and turn for a hex every time", () => {
    // Changing these would repaint every board
    expect([pickFor("0-0", 1, 6), pickFor("4-7", 2, 6), pickFor("8-12", 3, 5), pickFor("3-3", 1, 1000)]).toEqual([0, 3, 0, 723]);
  });
});

describe("planBoard", () => {
  it.each(boards.map((board) => [board.terrain, board] as const))("plans art for every terrain hex of %s", (terrain, board) => {
    const scenario = scenarios.find((s) => terrain.endsWith(`/${s.id}.json`))!;
    const plan = planBoard(scenario.tiles, LIBRARY, board);
    const terrainHexes = Object.values(scenario.tiles).flatMap((positions) => positions ?? []).map(positionKey);

    expect(keysOf(plan).sort()).toEqual([...new Set(terrainHexes)].sort());
  });

  it("paints a tile from the library on each hex, turned by the hex", () => {
    expect(planBoard({ hill: [p(4, 7)] }, LIBRARY, { plain: true })).toEqual([{ key: "4-7", type: "hill", art: "painted", tile: "hill/official.webp", turns: 3 }]);
  });

  it("joins hills next to each other into ridges, a lone hill one too, unless each hill goes on its own", () => {
    const hills: Terrain = { hill: [p(4, 4), p(4, 5), p(0, 0)] };

    expect(planBoard(hills, LIBRARY).map((hex) => hex.art)).toEqual(["ridge", "ridge", "ridge"]);
    expect(at(planBoard(hills, LIBRARY), "0-0")[0]).toMatchObject({ open: Array(6).fill(false) });
    expect(at(planBoard(hills, LIBRARY), "4-4")[0]).toMatchObject({ open: [true, false, false, false, false, false] });
    expect(planBoard(hills, LIBRARY, { separateHills: true }).map((hex) => hex.art)).toEqual(["painted", "painted", "painted"]);
  });

  it("blends forests into their own kind, lays every town's houses out again, and draws hedgerows", () => {
    const plan = planBoard({ forest: [p(4, 4), p(4, 5), p(0, 0)], hedgerow: [p(6, 6), p(6, 7)], town: [p(2, 2)] }, LIBRARY);

    expect(plan.map((hex) => [hex.key, hex.art])).toEqual([
      ["4-4", "joined"],
      ["4-5", "joined"],
      ["0-0", "joined"],
      ["6-6", "drawn"],
      ["6-7", "drawn"],
      ["2-2", "joined"],
    ]);
    expect(at(plan, "4-5")[0]).toMatchObject({ tile: "forest/official.webp", open: [false, false, false, true, false, false] });
    // A hedgerow's fields run on into the hedgerow beside it, and spread over the countryside round it
    expect(at(plan, "6-6")[0]).toMatchObject({ open: [true, false, false, false, false, false], bare: [false, true, true, true, true, true] });
    expect(drawnSvg(at(plan, "6-6")[0] as DrawnHex)).toMatch(/viewBox="-129\.9 -150 259\.8 300"/);
    expect(at(plan, "2-2")[0]).toMatchObject({ open: [false, false, false, false, false, false] });
    // A forest's trees grow over a town, a river or a hedgerow beside it, which end in countryside
    expect(at(planBoard({ forest: [p(4, 4)], town: [p(4, 5)], river: [p(4, 3)], hedgerow: [p(3, 3)] }, LIBRARY), "4-4")[0]).toMatchObject({
      bare: [true, true, true, true, true, true],
    });
  });

  it("runs a town's streets out over an edge or two, and always to a bridge", () => {
    const streets = (tiles: Terrain) => (at(planBoard(tiles, LIBRARY), "4-4")[0] as { streets: number[] }).streets;

    for (const key of ["4-4", "2-6", "6-2"]) {
      const [row = 0, col = 0] = key.split("-").map(Number);
      const out = (at(planBoard({ town: [p(row, col)] }, LIBRARY), key)[0] as { streets: number[] }).streets;
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.length).toBeLessThanOrEqual(2);
    }
    expect(streets({ town: [p(4, 4)], river: [p(4, 2)], bridge: [p(4, 3)] })).toContain(3);
    // Not into another town, nor a lake
    expect(streets({ town: [p(4, 4), p(4, 5), p(4, 3), p(3, 4), p(3, 3)], lake: [p(5, 3), p(5, 4)] })).toEqual([]);
  });

  it("runs a hill on into a river beside it, and the river's art up to the water", () => {
    const plan = planBoard({ river: [p(4, 3), p(4, 4), p(4, 5)], hill: [p(3, 4)] }, LIBRARY);

    // 3-4 is across 4-4's north-east edge (5); 4-4 and 4-5 are across 3-4's south-west and south-east ones
    expect(at(plan, "3-4")[0]).toMatchObject({ art: "ridge", open: [false, true, true, false, false, false] });
    expect(at(plan, "4-4")[0]).toMatchObject({ hills: [false, false, false, false, false, true], hillTile: "hill/official.webp" });
    expect(at(plan, "4-3")[0]).not.toHaveProperty("hills");
  });

  it("grows a forest into a river beside it", () => {
    const plan = planBoard({ river: [p(4, 3), p(4, 4), p(4, 5)], forest: [p(3, 4)] }, LIBRARY);

    expect(at(plan, "4-4")[0]).toMatchObject({ art: "joined", woods: [false, false, false, false, false, true] });
    expect(at(planBoard({ river: [p(4, 3), p(4, 4), p(4, 5)], forest: [p(3, 4)] }, LIBRARY, { drawn: ["river"] }), "4-4")[0]).toMatchObject({
      art: "drawn",
      woods: [false, false, false, false, false, true],
    });
  });

  it("puts each terrain hex on its own tile for the editor's plain art", () => {
    const tiles: Terrain = { hill: [p(4, 4), p(4, 5)], forest: [p(2, 2), p(2, 3)], town: [p(6, 6)], hedgerow: [p(7, 7), p(7, 8)] };

    // Hedgerows are always drawn, but each on its own
    expect(planBoard(tiles, LIBRARY, { plain: true }).map((hex) => hex.art)).toEqual([...Array(5).fill("painted"), "drawn", "drawn"]);
    expect(at(planBoard(tiles, LIBRARY, { plain: true }), "7-7")[0]).toMatchObject({ open: [] });
    expect(planBoard(tiles, LIBRARY).map((hex) => hex.art)).toEqual(["ridge", "ridge", "joined", "joined", "joined", "drawn", "drawn"]);
  });

  it("turns a river tile to join the river's edges, and lays a bridge across it", () => {
    // West to east along row 4, the bridge in the middle
    const plan = planBoard({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] }, LIBRARY);

    expect(at(plan, "4-4")).toEqual([
      { key: "4-4", type: "bridge", art: "joined", tile: "river/3-0.webp", turns: 0, open: [true, false, false, true, false, false], bare: Array(6).fill(false), spill: -1, woods: Array(6).fill(false), seed: 57 },
      { key: "4-4", type: "bridge", art: "bridgePiece", edges: [0, 3] },
    ]);
    // Plain, its tile as it is
    expect(at(planBoard({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] }, LIBRARY, { plain: true }), "4-4")[0]).toMatchObject({ art: "painted", turns: 0 });
  });

  it("carries a river straight on at its ends", () => {
    const plan = planBoard({ river: [p(4, 3), p(4, 4)] }, LIBRARY, { drawn: ["river"] });

    expect(plan.map((hex) => (hex as DrawnHex).edges)).toEqual([[0, 3], [3, 0]]);
    expect((planBoard({ river: [p(4, 3)] }, LIBRARY, { drawn: ["river"] })[0] as DrawnHex).edges).toEqual([0, 3]);
  });

  it("draws lakes, each hex running out to the lake hexes beside it", () => {
    const plan = planBoard({ lake: [p(5, 5), p(5, 6), p(6, 5), p(6, 6)] }, LIBRARY);

    expect(plan.every((hex) => hex.art === "drawn")).toBe(true);
    expect(at(plan, "5-5")[0]).toMatchObject({ open: [true, true, true, false, false, false] });
  });

  it("has no art for plains, and refuses terrain it has no art for", () => {
    expect(planBoard({ plains: [p(0, 0)] }, LIBRARY)).toEqual([]);
    expect(() => planBoard({ swamp: [p(0, 0)] }, LIBRARY)).toThrow("No art for swamp");
    expect(() => planBoard({ forest: [p(0, 0)] }, LIBRARY, { drawn: ["forest"] })).toThrow("Can't draw forest");
  });

  it("stops at a river that forks for the script, and keeps two of its branches for the app", () => {
    const fork: Terrain = { river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] };

    expect(() => planBoard(fork, LIBRARY, { drawn: ["river"] })).toThrow("River at 4-4 joins more than two river hexes");
    expect(at(planBoard(fork, LIBRARY, { drawn: ["river"], strict: false }), "4-4")[0]).toMatchObject({ edges: [0, 3] });
  });

  it("stops at a bend no river tile turns to fit", () => {
    expect(() => planBoard(SHARP_BEND, LIBRARY)).toThrow("No painted river tile joins edges 2 and 3 (at 4-5)");
    expect(planBoard(SHARP_BEND, LIBRARY, { drawn: ["river"] }).map((hex) => hex.art)).toEqual(["drawn", "drawn", "drawn"]);
  });
});

describe("canPaintRivers", () => {
  it("is true when a river tile turns to fit every river hex", () => {
    expect(canPaintRivers({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] }, LIBRARY)).toBe(true);
    // A wide bend: the 5-1 tile turned
    expect(canPaintRivers({ river: [p(4, 3), p(4, 4), p(5, 4)] }, LIBRARY)).toBe(true);
    expect(canPaintRivers({ forest: [p(0, 0)] }, LIBRARY)).toBe(true);
  });

  it("is false at a sharp bend or a fork", () => {
    expect(canPaintRivers(SHARP_BEND, LIBRARY)).toBe(false);
    expect(canPaintRivers({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, LIBRARY)).toBe(false);
  });
});

describe("drawnSvg", () => {
  it("draws rivers, bridges, lakes and hedgerows as SVG", () => {
    const hex = (type: string): DrawnHex => ({ key: "4-4", type, art: "drawn", seed: 57, edges: [0, 3], open: [false, false, false, false, false, false], woods: [], bare: [] });

    for (const type of ["river", "bridge", "lake", "hedgerow"]) expect(drawnSvg(hex(type))).toMatch(/^<svg /);
    expect(() => drawnSvg(hex("forest"))).toThrow("Can't draw forest");
  });
});
