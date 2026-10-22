import { describe, expect, it } from "vitest";
import { TILE_LIBRARY, planMapArt, tilesFor } from "./drawBoard";
import { HexType } from "../types/hex";
import { scenarios } from "../data/scenarios";
import { positionKey } from "../game-core/position";
import { boardKeys } from "./boardPlan.mjs";
import { boardSizeOf } from "../game-core/boardSize";

// The canvas itself is checked in the browser (jsdom has none); these check what it's asked to draw

describe("the app's board art", () => {
  it("has the library of painted tiles", () => {
    expect(TILE_LIBRARY).toEqual({
      beach: ["4-5-a.webp", "4-5-b.webp", "4-5-c.webp", "sand.webp", "surf-1-2.webp"],
      forest: ["official.webp"],
      hedgerow: ["official.webp"],
      hill: ["official.webp"],
      lake: ["0-1-5-r3.webp", "1-2.webp", "2-3-4.webp", "4-5.webp"],
      ocean: ["4-5.webp", "sea.webp"],
      river: ["0-2-4.webp", "0-3-5.webp", "3-0.webp", "3.webp", "5-1.webp"],
      swamp: ["digital.webp"],
      town: ["official.webp", ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `village-${n}.webp`)],
    });
  });

  it("paints a town with the tile picked for it", () => {
    const tiles = { town: [{ row: 4, col: 4 }, { row: 4, col: 5 }] };
    const picked = planMapArt(tiles, undefined, false, [{ row: 4, col: 4, tile: "village-6" }]);

    expect(picked.map((hex) => "tile" in hex && hex.tile)[0]).toBe("town/village-6.webp");
    expect(picked[1]).toEqual(planMapArt(tiles)[1]);
    expect(tilesFor(HexType.TOWN)).toContain("village-6");
  });

  it.each(scenarios.map((s) => [s.id, s] as const))("puts %s's terrain on the same hexes as its painted art", (_id, scenario) => {
    const size = boardSizeOf(scenario);
    const plan = planMapArt(scenario.tiles, size);
    const terrainHexes = Object.values(scenario.tiles).flatMap((positions) => positions ?? []).map(positionKey);

    // (and the terrain carried on into the half hexes outside the board, on rows or columns -1 and past the last)
    const board = new Set(boardKeys(size.cols, size.rows));
    const own = plan.filter((hex) => hex.art !== "spill" && board.has(hex.key));
    expect([...new Set(own.map((hex) => hex.key))].sort()).toEqual([...new Set(terrainHexes)].sort());
  });

  it("joins hills next to each other into ridges, as on the painted boards", () => {
    const p = (row: number, col: number) => ({ row, col });

    // The hill in the corner carries on into the half hexes outside the board, as ridges too
    const plan = planMapArt({ hill: [p(4, 4), p(4, 5), p(0, 0)] });
    expect(plan.map((hex) => hex.art).every((art) => art === "ridge")).toBe(true);
    expect(plan.map((hex) => hex.key).sort()).toEqual(["-1--1", "-1-0", "0-0", "1--1", "4-4", "4-5"]);
    expect(planMapArt({ hill: [p(0, 0)] }, undefined, true).map((hex) => hex.key)).toEqual(["0-0"]);
  });

  it("paints rivers when the library fits every bend, and draws them otherwise", () => {
    const p = (row: number, col: number) => ({ row, col });
    const kinds = (tiles: Parameters<typeof planMapArt>[0]) => planMapArt(tiles).filter((hex) => hex.art !== "spill").map((hex) => hex.art);

    expect(kinds({ river: [p(4, 3), p(4, 5)], bridge: [p(4, 4)] })).toEqual(["joined", "joined", "joined", "bridgePiece"]);
    // Three river hexes round one corner turn too sharply for the river tiles
    expect(kinds({ river: [p(4, 5), p(4, 4), p(5, 4)] })).toEqual(["drawn", "drawn", "drawn"]);
    // A fork is painted with a fork tile; a crossing while the map is being made doesn't stop the drawing
    expect(kinds({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4)] })).toEqual(["joined", "joined", "joined", "joined"]);
    expect(kinds({ river: [p(4, 4), p(4, 3), p(4, 5), p(3, 4), p(5, 4)] })).toEqual(["drawn", "drawn", "drawn", "drawn", "drawn"]);
  });
});
