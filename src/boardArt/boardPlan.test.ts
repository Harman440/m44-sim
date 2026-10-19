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
    expect(planBoard({ hedgerow: [p(4, 7)] }, LIBRARY)).toEqual([{ key: "4-7", type: "hedgerow", art: "painted", tile: "hedgerow/official.webp", turns: 3 }]);
  });

  it("joins hills next to each other into ridges, unless each hill goes on its own", () => {
    const hills: Terrain = { hill: [p(4, 4), p(4, 5), p(0, 0)] };

    expect(planBoard(hills, LIBRARY).map((hex) => hex.art)).toEqual(["ridge", "ridge", "painted"]);
    expect(at(planBoard(hills, LIBRARY), "4-4")[0]).toMatchObject({ open: [true, false, false, false, false, false] });
    expect(planBoard(hills, LIBRARY, { separateHills: true }).map((hex) => hex.art)).toEqual(["painted", "painted", "painted"]);
  });

  it("blends forests and hedgerows into their own kind, and lays every town's houses out again", () => {
    const plan = planBoard({ forest: [p(4, 4), p(4, 5), p(0, 0)], hedgerow: [p(6, 6), p(6, 7)], town: [p(2, 2)] }, LIBRARY);

    expect(plan.map((hex) => [hex.key, hex.art])).toEqual([
      ["4-4", "joined"],
      ["4-5", "joined"],
      ["0-0", "joined"],
      ["6-6", "joined"],
      ["6-7", "joined"],
      ["2-2", "joined"],
    ]);
    expect(at(plan, "4-5")[0]).toMatchObject({ tile: "forest/official.webp", open: [false, false, false, true, false, false] });
    // A forest beside a hedgerow is on its own, its trees growing out over the countryside round
    // it but not over the hedgerow
    expect(at(planBoard({ forest: [p(4, 4)], hedgerow: [p(4, 5)] }, LIBRARY), "4-4")[0]).toMatchObject({
      art: "joined",
      open: [false, false, false, false, false, false],
      bare: [false, true, true, true, true, true],
    });
    expect(at(plan, "2-2")[0]).toMatchObject({ open: [false, false, false, false, false, false] });
    // A hedgerow on its own is its tile
    expect(at(planBoard({ hedgerow: [p(0, 0)] }, LIBRARY), "0-0")[0]).toMatchObject({ art: "painted" });
  });

  it("stands a house over an edge onto the countryside in some towns, never off the board", () => {
    const towns = planBoard({ town: BOARD_KEYS.map((key) => ({ row: Number(key.split("-")[0]), col: Number(key.split("-")[1]) })).filter((_, i) => i % 3 === 0) }, LIBRARY);
    const spills = towns.filter((hex) => hex.art === "joined" && hex.spill >= 0);

    expect(spills.length).toBeGreaterThan(towns.length / 4);
    expect(spills.length).toBeLessThan((3 * towns.length) / 4);
    for (const hex of spills) if (hex.art === "joined") expect(hex.bare[hex.spill]).toBe(true);
    // The board's edge isn't countryside to spill onto
    expect(at(planBoard({ town: [p(0, 0)] }, LIBRARY), "0-0")[0]).toMatchObject({ bare: [true, true, false, false, false, false] });
  });

  it("puts each terrain hex on its own tile for the editor's plain art", () => {
    const tiles: Terrain = { hill: [p(4, 4), p(4, 5)], forest: [p(2, 2), p(2, 3)], town: [p(6, 6)], hedgerow: [p(7, 7), p(7, 8)] };

    expect(planBoard(tiles, LIBRARY, { plain: true }).map((hex) => hex.art)).toEqual(Array(7).fill("painted"));
    expect(planBoard(tiles, LIBRARY).map((hex) => hex.art)).toEqual(["ridge", "ridge", "joined", "joined", "joined", "joined", "joined"]);
  });

  it("turns a river tile to join the river's edges, and lays a bridge across it", () => {
    // West to east along row 4, the bridge in the middle
    const plan = planBoard({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] }, LIBRARY);

    expect(at(plan, "4-4")).toEqual([
      { key: "4-4", type: "bridge", art: "painted", tile: "river/3-0.webp", turns: 0 },
      { key: "4-4", type: "bridge", art: "bridgePiece", edges: [0, 3] },
    ]);
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
    const hex = (type: string): DrawnHex => ({ key: "4-4", type, art: "drawn", seed: 57, edges: [0, 3], open: [false, false, false, false, false, false] });

    for (const type of ["river", "bridge", "lake", "hedgerow"]) expect(drawnSvg(hex(type))).toMatch(/^<svg /);
    expect(() => drawnSvg(hex("forest"))).toThrow("Can't draw forest");
  });
});
