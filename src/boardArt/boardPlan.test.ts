import { describe, expect, it } from "vitest";
import { BOARD_KEYS, artGrid, canPaintRivers, drawnSvg, neighbor, outskirtKeys, parseKey, pickFor, planBoard } from "./boardPlan.mjs";
import type { DrawnHex, HexArt, JoinedHex, SpillHex, Terrain } from "./boardPlan.mjs";
import boards from "../../scripts/boards.json";
import { scenarios } from "../data/scenarios";
import { positionKey } from "../game-core/position";

const LIBRARY = { forest: ["official.webp"], hedgerow: ["official.webp"], hill: ["official.webp"], river: ["3-0.webp", "5-1.webp"], town: ["official.webp"] };
// Three river hexes round one corner: each turns sharply, which no river tile does
const SHARP_BEND: Terrain = { river: [{ row: 4, col: 5 }, { row: 4, col: 4 }, { row: 5, col: 4 }] };
const p = (row: number, col: number) => ({ row, col });
// With forks, a pond at a river's end, lake pieces and beaches
const MORE = {
  ...LIBRARY,
  river: ["0-2-4.webp", "0-3-5.webp", "3-0.webp", "3.webp", "5-1.webp"],
  lake: ["0-1-5-r3.webp", "1-2.webp", "2-3-4.webp", "4-5.webp"],
  beach: ["4-5-a.webp", "sand.webp", "surf-1-2.webp"],
  swamp: ["digital.webp"],
  ocean: ["4-5.webp", "sea.webp"],
};
/** The hexes with art of their own: not the countryside a forest's lone trees stand on */
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
    expect(planBoard({ hill: [p(4, 7)] }, LIBRARY, { plain: true })).toEqual([{ key: "4-7", type: "hill", art: "painted", tile: "hill/official.webp", turns: 3 }]);
  });

  it("joins hills next to each other into ridges, a lone hill one too, unless each hill goes on its own", () => {
    const hills: Terrain = { hill: [p(4, 4), p(4, 5), p(0, 0)] };

    expect(planBoard(hills, LIBRARY).map((hex) => hex.art)).toEqual(["ridge", "ridge", "ridge"]);
    expect(at(planBoard(hills, LIBRARY), "0-0")[0]).toMatchObject({ open: Array(6).fill(false) });
    expect(at(planBoard(hills, LIBRARY), "4-4")[0]).toMatchObject({ open: [true, false, false, false, false, false] });
    expect(planBoard(hills, LIBRARY, { separateHills: true }).map((hex) => hex.art)).toEqual(["painted", "painted", "painted"]);
  });

  it("blends forests into their own kind, fades towns into the countryside, and draws hedgerows", () => {
    const plan = planBoard({ forest: [p(4, 4), p(4, 5), p(0, 0)], hedgerow: [p(6, 6), p(6, 7)], town: [p(2, 2)] }, LIBRARY);

    expect(own(plan).map((hex) => [hex.key, hex.art])).toEqual([
      ["4-4", "joined"],
      ["4-5", "joined"],
      ["0-0", "joined"],
      ["6-6", "drawn"],
      ["6-7", "drawn"],
      ["2-2", "joined"],
    ]);
    expect(at(plan, "4-5")[0]).toMatchObject({ tile: "forest/official.webp", open: [false, false, false, true, false, false] });
    // Adjacent hedgerows share an open edge, while the tile art stays inside one hex.
    expect(at(plan, "6-6")[0]).toMatchObject({ open: [true, false, false, false, false, false] });
    // A town keeps its painted tile: nothing joined, no house spilling out
    expect(at(plan, "2-2")[0]).toMatchObject({ art: "joined", open: [], spill: -1 });
    // A forest's trees grow over a town, a river or a hedgerow beside it, which end in countryside
    expect(at(planBoard({ forest: [p(4, 4)], town: [p(4, 5)], river: [p(4, 3)], hedgerow: [p(3, 3)] }, LIBRARY), "4-4")[0]).toMatchObject({
      bare: [true, true, true, true, true, true],
    });
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
    expect(own(planBoard(tiles, LIBRARY)).map((hex) => hex.art)).toEqual(["ridge", "ridge", "joined", "joined", "joined", "drawn", "drawn"]);
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

  it("stops at a river that forks with no tile for it for the script, and keeps two of its branches for the app", () => {
    const fork: Terrain = { river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] };

    expect(() => planBoard(fork, LIBRARY, { drawn: ["river"] })).toThrow("No painted river tile forks to edges 0, 3, 5 (at 4-4)");
    expect(at(planBoard(fork, LIBRARY, { drawn: ["river"], strict: false }), "4-4")[0]).toMatchObject({ edges: [0, 3] });
    expect(() => planBoard({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4), p(5, 4)] }, MORE)).toThrow("joins more than three");
  });

  it("forks a river with a fork tile, and ends one that stops on the board in a pond", () => {
    const fork = planBoard({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, MORE);

    expect(at(fork, "4-4")[0]).toMatchObject({ art: "joined", tile: "river/0-3-5.webp", turns: 0 });
    // Each branch stops a hex short of the next land: a pond, turned to face the fork
    expect(at(fork, "4-3")[0]).toMatchObject({ tile: "river/3.webp", turns: 3 });
    expect(at(fork, "4-5")[0]).toMatchObject({ tile: "river/3.webp", turns: 0 });
    // At the board's edge it runs on off the board
    expect(at(planBoard({ river: [p(4, 0), p(4, 1)] }, MORE), "4-0")[0]).toMatchObject({ tile: "river/3-0.webp" });
    // A bridge never ends in a pond
    expect(at(planBoard({ river: [p(4, 3)], bridge: [p(4, 4)] }, MORE), "4-4")[1]).toMatchObject({ art: "bridgePiece", edges: [3, 0] });
  });

  it("runs a river into a lake beside it: the drawn lake opens to it, and a lake painted from pieces takes one with its mouth", () => {
    // Four hexes, a river flowing into the west one from the west
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

  it("fades a beach and a swamp into the land beside them, a tufted beach tile turned to face it, and keeps the sand by water and the board's edge", () => {
    // A row of beach with countryside above it (edges 4 and 5) and a lake below one hex
    const beach: Terrain = { beach: [p(4, 4), p(4, 5), p(4, 6)], lake: [p(5, 5)] };
    const middle = at(planBoard(beach, MORE), "4-5")[0] as JoinedHex;

    expect(middle).toMatchObject({ art: "joined", tile: "beach/4-5-a.webp", turns: 0, open: [true, false, false, true, false, false] });
    // Land at edges 1, 2, 4 and 5 but the lake at 1 (5-5): faded at 2, 4 and 5
    expect(middle.fade).toEqual([false, false, true, false, true, true]);
    // Only water and the board's edge round it: plain sand
    expect(at(planBoard({ beach: [p(0, 0)], lake: [p(0, 1), p(1, 0)] }, MORE), "0-0")[0]).toMatchObject({ tile: "beach/sand.webp", fade: [false, false, false, false, false, false] });
    // A swamp beside another
    expect(at(planBoard({ swamp: [p(4, 4), p(4, 5)] }, MORE), "4-4")[0]).toMatchObject({
      art: "joined",
      open: [true, false, false, false, false, false],
      fade: [false, true, true, true, true, true],
    });
  });

  it("turns an ocean's shore toward the land beside it, and a beach's surf toward the ocean", () => {
    // Countryside down to row 4, a beach at 4-5, the ocean from row 5 down
    const sea = [5, 6, 7, 8].flatMap((row) => [...Array(13 - (row % 2)).keys()].map((col) => p(row, col)));
    const plan = planBoard({ beach: [p(4, 5)], ocean: sea }, MORE);

    // The beach's surf on its edges onto the ocean (1 and 2), faded into the land at the others
    expect(at(plan, "4-5")[0]).toMatchObject({ tile: "beach/surf-1-2.webp", turns: 0, fade: [true, false, false, true, true, true] });
    // Land at edges 4 and 5: the shore tile as it is
    expect(at(plan, "5-5")[0]).toMatchObject({ art: "painted", tile: "ocean/4-5.webp", turns: 0 });
    // Out at sea: open water, its waves level
    const open = at(plan, "7-5")[0];
    expect(open).toMatchObject({ art: "painted", tile: "ocean/sea.webp" });
    expect([0, 3]).toContain(open && "turns" in open ? open.turns : -1);
    // On the editor's plain art, open water too
    expect(at(planBoard({ ocean: sea }, MORE, { plain: true }), "5-5")[0]).toMatchObject({ tile: "ocean/sea.webp" });
  });

  it("stands a lone tree or two on the countryside by some of a forest's edges, after every hex's own art", () => {
    const forests = BOARD_KEYS.filter((_, i) => i % 9 === 0).map((key) => ({ row: Number(key.split("-")[0]), col: Number(key.split("-")[1]) }));
    const plan = planBoard({ forest: forests }, LIBRARY);
    const spills = plan.filter((hex): hex is SpillHex => hex.art === "spill");
    const edges = spills.reduce((n, hex) => n + hex.toward.filter(Boolean).length, 0);

    // About one edge in three of the forests' edges onto the countryside on the board
    expect(edges).toBeGreaterThan(forests.length);
    expect(edges).toBeLessThan(forests.length * 3);
    expect(spills.every((hex) => BOARD_KEYS.includes(hex.key) && hex.tile === "forest/official.webp")).toBe(true);
    expect(plan.slice(-spills.length)).toEqual(spills);
    // None onto a town, nor on the editor's plain art
    const town = planBoard({ forest: [p(4, 4)], town: [...Array(6).keys()].map((d) => { const [row = 0, col = 0] = neighbor("4-4", d).split("-").map(Number); return { row, col }; }) }, LIBRARY);
    expect(town.some((hex) => hex.art === "spill")).toBe(false);
    expect(planBoard({ forest: forests }, LIBRARY, { plain: true }).some((hex) => hex.art === "spill")).toBe(false);
  });

  it("paints a hex with the tile picked for it, when its terrain's folder has it", () => {
    const tiles: Terrain = { town: [p(4, 4), p(4, 5)] };
    const library = { ...LIBRARY, town: ["official.webp", "village-1.webp", "village-2.webp"] };
    const picked = planBoard(tiles, library, { picked: { "4-4": "village-2" } });

    expect(at(picked, "4-4")[0]).toMatchObject({ tile: "town/village-2.webp" });
    expect(at(picked, "4-5")[0]).toEqual(at(planBoard(tiles, library), "4-5")[0]);
    expect(planBoard(tiles, library, { picked: { "4-4": "gone" } })).toEqual(planBoard(tiles, library));
  });

  it("stops at a bend no river tile turns to fit", () => {
    expect(() => planBoard(SHARP_BEND, LIBRARY)).toThrow("No painted river tile joins edges 2 and 3 (at 4-5)");
    expect(planBoard(SHARP_BEND, LIBRARY, { drawn: ["river"] }).map((hex) => hex.art)).toEqual(["drawn", "drawn", "drawn"]);
  });
});

describe("the outskirts", () => {
  it("are the half hexes outside the board that its art shows", () => {
    const keys = outskirtKeys(BOARD_KEYS);
    // Above and below (the zigzags, corners included) and the ends of the short rows
    expect(keys.filter((k) => parseKey(k).row === -1)).toHaveLength(14);
    expect(keys.filter((k) => parseKey(k).row === 9)).toHaveLength(14);
    expect(keys).toContain("1--1");
    expect(keys).toContain("1-12");
    // Not the long rows' ends, which lie wholly outside the art's box
    expect(keys).not.toContain("0--1");
    expect(keys).not.toContain("0-13");
    expect(keys.some((k) => BOARD_KEYS.includes(k))).toBe(false);
  });

  it("parse with their minus signs and keep the odd rows' shift", () => {
    expect(parseKey("-1--1")).toEqual({ row: -1, col: -1 });
    expect(neighbor("-1-3", 1)).toBe("0-4");
    expect(neighbor("0-4", 4)).toBe("-1-3");
    expect(artGrid(1514).center("-1-0").x).toBeCloseTo(artGrid(1514).center("1-0").x);
  });

  it("carry the terrain on past the board's edge, and nothing of them comes back onto it", () => {
    const plan = planBoard({ forest: [p(0, 2), p(0, 3)], town: [p(1, 0)] }, LIBRARY, { outskirts: true });
    const art = (key: string) => plan.find((hex) => hex.key === key && hex.art !== "spill");

    expect(art("-1-2")?.type).toBe("forest");
    expect(art("1--1")?.type).toBe("town");
    expect((art("1--1") as JoinedHex).spill).toBe(-1);
    // The board's forest runs on into it; no lone trees stand out from it on the board
    expect((art("0-2") as JoinedHex).open[5]).toBe(true);
    expect(plan.filter((hex) => hex.art === "spill").every((hex) => (hex as SpillHex).toward.some(Boolean) && BOARD_KEYS.includes(hex.key))).toBe(true);
    expect(planBoard({ forest: [p(0, 2)] }, LIBRARY).some((hex) => !BOARD_KEYS.includes(hex.key))).toBe(false);
  });

  it("take a river on through the edge it flows out of", () => {
    const plan = planBoard({ river: [p(0, 4), p(1, 4), p(2, 4)] }, LIBRARY, { outskirts: true, drawn: ["river"] });
    const outside = plan.filter((hex) => !BOARD_KEYS.includes(hex.key));

    expect(outside.map((hex) => hex.type)).toEqual(["river"]);
    expect((plan.find((hex) => hex.key === "0-4") as DrawnHex).edges).toContain(4);
  });
});

describe("canPaintRivers", () => {
  it("is true when a river tile turns to fit every river hex", () => {
    expect(canPaintRivers({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] }, LIBRARY)).toBe(true);
    // A wide bend: the 5-1 tile turned
    expect(canPaintRivers({ river: [p(4, 3), p(4, 4), p(5, 4)] }, LIBRARY)).toBe(true);
    expect(canPaintRivers({ forest: [p(0, 0)] }, LIBRARY)).toBe(true);
  });

  it("is true at a fork the library has a tile for", () => {
    expect(canPaintRivers({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, MORE)).toBe(true);
  });

  it("is false at a sharp bend or a fork with no tile for it", () => {
    expect(canPaintRivers(SHARP_BEND, LIBRARY)).toBe(false);
    expect(canPaintRivers({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] }, LIBRARY)).toBe(false);
  });
});

describe("drawnSvg", () => {
  it("draws rivers, bridges and lakes as SVG", () => {
    const hex = (type: string): DrawnHex => ({ key: "4-4", type, art: "drawn", seed: 57, edges: [0, 3], open: [false, false, false, false, false, false], woods: [] });

    for (const type of ["river", "bridge", "lake"]) expect(drawnSvg(hex(type))).toMatch(/^<svg /);
    expect(() => drawnSvg(hex("forest"))).toThrow("Can't draw forest");
    expect(() => drawnSvg(hex("hedgerow"))).toThrow("Can't draw hedgerow");
  });
});
