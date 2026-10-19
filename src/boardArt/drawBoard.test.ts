import { describe, expect, it } from "vitest";
import { TILE_LIBRARY, planMapArt } from "./drawBoard";
import { scenarios } from "../data/scenarios";
import { positionKey } from "../game-core/position";

// The canvas itself is checked in the browser (jsdom has none); these check what it's asked to draw

describe("the app's board art", () => {
  it("has the library of painted tiles", () => {
    expect(TILE_LIBRARY).toEqual({
      forest: ["official.webp"],
      hedgerow: ["official.webp"],
      hill: ["official.webp"],
      river: ["3-0.webp", "5-1.webp"],
      town: ["official.webp", ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `village-${n}.webp`)],
    });
  });

  it("paints a town with the tile picked for it", () => {
    const tiles = { town: [{ row: 4, col: 4 }, { row: 4, col: 5 }] };
    const picked = planMapArt(tiles, [{ row: 4, col: 4, tile: "village-6" }]);

    expect(picked.map((hex) => "tile" in hex && hex.tile)[0]).toBe("town/village-6.webp");
    expect(picked[1]).toEqual(planMapArt(tiles)[1]);
    // A tile the library hasn't got is left to the hex
    expect(planMapArt(tiles, [{ row: 4, col: 4, tile: "gone" }])).toEqual(planMapArt(tiles));
  });

  it.each(scenarios.map((s) => [s.id, s] as const))("puts %s's terrain on the same hexes as its painted art", (_id, scenario) => {
    const plan = planMapArt(scenario.tiles);
    const terrainHexes = Object.values(scenario.tiles).flatMap((positions) => positions ?? []).map(positionKey);

    expect([...new Set(plan.map((hex) => hex.key))].sort()).toEqual([...new Set(terrainHexes)].sort());
  });

  it("joins hills next to each other into ridges, as on the painted boards", () => {
    const p = (row: number, col: number) => ({ row, col });

    expect(planMapArt({ hill: [p(4, 4), p(4, 5), p(0, 0)] }).map((hex) => hex.art)).toEqual(["ridge", "ridge", "painted"]);
  });

  it("paints rivers when the library fits every bend, and draws them otherwise", () => {
    const p = (row: number, col: number) => ({ row, col });
    const kinds = (tiles: Parameters<typeof planMapArt>[0]) => planMapArt(tiles).map((hex) => hex.art);

    expect(kinds({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] })).toEqual(["painted", "painted", "painted", "bridgePiece"]);
    // Three river hexes round one corner turn too sharply for the river tiles
    expect(kinds({ river: [p(4, 5), p(4, 4), p(5, 4)] })).toEqual(["drawn", "drawn", "drawn"]);
    // A fork while the map is being made doesn't stop the drawing
    expect(kinds({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] })).toEqual(["drawn", "drawn", "drawn", "drawn"]);
  });
});
