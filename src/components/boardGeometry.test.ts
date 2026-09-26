import { describe, expect, it } from "vitest";
import { createBoardGeometry } from "./boardGeometry";
import Hex from "../game-core/hex";

const geometry = createBoardGeometry(13, 9, 50);
const hexWidth = 50 * Math.sqrt(3);

describe("board geometry", () => {
  it("keeps the SVG size the board has always had", () => {
    expect(geometry.width).toBeCloseTo(13 * hexWidth + hexWidth / 2 + 100);
    expect(geometry.height).toBeCloseTo(9 * 75 + 25 + 100);
  });

  it("shifts odd rows right by half a hex", () => {
    const even = geometry.hexCenter({ row: 0, col: 0 });
    const odd = geometry.hexCenter({ row: 1, col: 0 });

    expect(even).toEqual({ x: 115, y: 100 });
    expect(odd.x - even.x).toBeCloseTo(hexWidth / 2);
    expect(odd.y - even.y).toBeCloseTo(75);
  });

  it("puts every neighbour of a hex exactly one hex width away", () => {
    for (const position of [{ row: 4, col: 6 }, { row: 3, col: 6 }]) {
      const centre = geometry.hexCenter(position);
      for (const neighbour of new Hex(position).getNeighbors()) {
        const n = geometry.hexCenter(neighbour);
        expect(Math.hypot(n.x - centre.x, n.y - centre.y)).toBeCloseTo(hexWidth);
      }
    }
  });
});
