import { describe, expect, it } from "vitest";
import { BOARD_KEYS, artGrid, canPaintRivers, drawnSvg, neighbor, pickFor, planBoard } from "./boardPlan.mjs";
import type { DrawnHex, HexArt, JoinedHex, SpillHex, Terrain } from "./boardPlan.mjs";
import boards from "../../scripts/boards.json";
import { scenarios } from "../data/scenarios";
import { positionKey } from "../game-core/position";

const LIBRARY = { forest: ["official.webp"], hedgerow: ["official.webp"], hill: ["official.webp"], river: ["3-0.webp", "5-1.webp"], town: ["official.webp"] };
// With forks, a pond at a river's end, lake pieces and beaches
const MORE = {
  ...LIBRARY,
  river: ["0-2-4.webp", "0-3-5.webp", "3-0.webp", "3.webp", "5-1.webp"],
  lake: ["0-1-5-r3.webp", "1-2.webp", "2-3-4.webp", "4-5.webp"],
  beach: ["4-5-a.webp", "sand.webp"],
};
// Three river hexes round one corner: each turns sharply, which no river tile does
const SHARP_BEND: Terrain = { river: [{ row: 4, col: 5 }, { row: 4, col: 4 }, { row: 5, col: 4 }] };
const p = (row: number, col: number) => ({ row, col });
/** The hexes with art of their own: not the ones a forest's trees only reach onto */
const own = (plan: HexArt[]) => plan.filter((hex) => hex.art !== "spill");
const keysOf = (plan: HexArt[]) => [...new Set(own(plan).map((hex) => hex.key))];
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
    expect(own(planBoard({ forest: [p(4, 7)] }, LIBRARY))).toEqual([{ key: "4-7", type: "forest", art: "painted", tile: "forest/official.webp", turns: 3 }]);
  });

  it("joins hills next to each other into ridges, unless each hill goes on its own", () => {
    const hills: Terrain = { hill: [p(4, 4), p(4, 5), p(0, 0)] };

    expect(planBoard(hills, LIBRARY).map((hex) => hex.art)).toEqual(["ridge", "ridge", "painted"]);
    expect(at(planBoard(hills, LIBRARY), "4-4")[0]).toMatchObject({ open: [true, false, false, false, false, false] });
    expect(planBoard(hills, LIBRARY, { separateHills: true }).map((hex) => hex.art)).toEqual(["painted", "painted", "painted"]);
  });

  it("blends forests and hedgerows into their own kind, and lays every town's houses out again", () => {
    const plan = planBoard({ forest: [p(4, 4), p(4, 5), p(0, 0)], hedgerow: [p(6, 6), p(6, 7)], town: [p(2, 2)] }, LIBRARY);

    expect(own(plan).map((hex) => [hex.key, hex.art])).toEqual([
      ["4-4", "joined"],
      ["4-5", "joined"],
      ["0-0", "painted"],
      ["6-6", "joined"],
      ["6-7", "joined"],
      ["2-2", "joined"],
    ]);
    expect(at(plan, "4-5")[0]).toMatchObject({ tile: "forest/official.webp", open: [false, false, false, true, false, false] });
    // A forest beside a hedgerow is still on its own
    expect(at(planBoard({ forest: [p(4, 4)], hedgerow: [p(4, 5)] }, LIBRARY), "4-4")[0]).toMatchObject({ art: "painted" });
    expect(at(plan, "2-2")[0]).toMatchObject({ open: [false, false, false, false, false, false] });
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

  it("stops at a river that forks with no tile for it for the script, and keeps two of its branches for the app", () => {
    const fork: Terrain = { river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] };

    expect(() => planBoard(fork, LIBRARY, { drawn: ["river"] })).toThrow("No painted river tile forks to edges 0, 3, 5 (at 4-4)");
    expect(at(planBoard(fork, LIBRARY, { drawn: ["river"], strict: false }), "4-4")[0]).toMatchObject({ edges: [0, 3] });
    expect(() => planBoard({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4), p(5, 4)] }, MORE)).toThrow("joins more than three");
  });

  it("forks a river with a fork tile, and ends one that stops on the board in a pond", () => {
    const fork = planBoard({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, MORE);

    expect(at(fork, "4-4")[0]).toMatchObject({ art: "painted", tile: "river/0-3-5.webp", turns: 0 });
    // Each branch stops a hex short of the next land: a pond, turned to face the fork
    expect(at(fork, "4-3")[0]).toMatchObject({ tile: "river/3.webp", turns: 3 });
    expect(at(fork, "4-5")[0]).toMatchObject({ tile: "river/3.webp", turns: 0 });
    // At the board's edge it runs on off the board
    expect(at(planBoard({ river: [p(4, 0), p(4, 1)] }, MORE), "4-0")[0]).toMatchObject({ tile: "river/3-0.webp" });
    // A bridge never ends in a pond
    expect(at(planBoard({ river: [p(4, 3)], bridge: [p(4, 4)] }, MORE), "4-4")[1]).toMatchObject({ art: "bridgePiece", edges: [3, 0] });
  });

  it("runs a river into a lake beside it: the drawn lake opens to it, and a lake painted from pieces takes one with its mouth", () => {
    // The screenshot's lake: four hexes, a river flowing into the west one from the west
    const lake: Terrain = { lake: [p(3, 4), p(4, 4), p(4, 5), p(5, 4)], river: [p(4, 3)] };
    const painted = planBoard(lake, MORE);

    expect(at(painted, "4-3")[0]).toMatchObject({ tile: "river/3-0.webp" });
    const pieces = own(painted).filter((hex) => hex.type === "lake").map((hex) => ("tile" in hex ? hex.tile : hex.art));
    // The bottom hex takes either piece that opens to the two above it: 4-5, or 1-2 turned round
    expect(pieces.slice(0, 3)).toEqual(["lake/1-2.webp", "lake/0-1-5-r3.webp", "lake/2-3-4.webp"]);
    expect(["lake/4-5.webp", "lake/1-2.webp"]).toContain(pieces[3]);
    // Without lake pieces, drawn: the west hex opens to the river as well as to the lake hexes
    expect(at(planBoard(lake, LIBRARY), "4-4")[0]).toMatchObject({ art: "drawn", open: [true, true, false, true, false, true] });
    // A lake the pieces don't fit is drawn whole
    expect(own(planBoard({ lake: [p(4, 4), p(4, 5)] }, MORE)).map((hex) => hex.art)).toEqual(["drawn", "drawn"]);
  });

  it("fades a beach into the land beside it, a tufted tile turned to face it, and keeps the sand by water and the board's edge", () => {
    // A row of beach with countryside above it (edges 4 and 5) and a lake below one hex
    const beach: Terrain = { beach: [p(4, 4), p(4, 5), p(4, 6)], lake: [p(5, 5)] };
    const plan = planBoard(beach, MORE);
    const middle = at(plan, "4-5")[0] as JoinedHex;

    expect(middle).toMatchObject({ art: "joined", tile: "beach/4-5-a.webp", turns: 0, open: [true, false, false, true, false, false] });
    // Land at edges 1, 2, 4 and 5 but the lake at 1 (5-5): faded at 2, 4 and 5
    expect(middle.fade).toEqual([false, false, true, false, true, true]);
    // Only water and the board's edge round it: plain sand
    expect(at(planBoard({ beach: [p(0, 0)], lake: [p(0, 1), p(1, 0)] }, MORE), "0-0")[0]).toMatchObject({ tile: "beach/sand.webp", fade: [false, false, false, false, false, false] });
  });

  it("lets a forest's trees reach onto the countryside, rivers and hills beside it, and a hedgerow's bushes onto the countryside", () => {
    const plan = planBoard({ forest: [p(4, 4)], hill: [p(4, 5)], town: [p(4, 3)], hedgerow: [p(0, 0)] }, LIBRARY);
    const spills = plan.filter((hex): hex is SpillHex => hex.art === "spill");

    // Every neighbour but the town, the hill's edge facing the forest (3)
    expect(spills.filter((hex) => hex.type === "forest").map((hex) => hex.key).sort()).toEqual(["3-3", "3-4", "4-5", "5-3", "5-4"]);
    expect(spills.find((hex) => hex.key === "4-5")).toMatchObject({ tile: "forest/official.webp", toward: [false, false, false, true, false, false] });
    // Off the board's top and left edges, none; and they come after every hex's own art
    expect(spills.filter((hex) => hex.type === "hedgerow").map((hex) => hex.key)).toEqual(["0-1", "1-0"]);
    expect(plan.slice(-spills.length)).toEqual(spills);
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

  it("is false at a sharp bend, or a fork the library has no tile for", () => {
    expect(canPaintRivers(SHARP_BEND, LIBRARY)).toBe(false);
    expect(canPaintRivers({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, LIBRARY)).toBe(false);
    expect(canPaintRivers({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, MORE)).toBe(true);
  });
});

describe("drawnSvg", () => {
  it("draws rivers, bridges, lakes and hedgerows as SVG", () => {
    const hex = (type: string): DrawnHex => ({ key: "4-4", type, art: "drawn", seed: 57, edges: [0, 3], open: [false, false, false, false, false, false] });

    for (const type of ["river", "bridge", "lake", "hedgerow"]) expect(drawnSvg(hex(type))).toMatch(/^<svg /);
    expect(() => drawnSvg(hex("forest"))).toThrow("Can't draw forest");
  });
});
