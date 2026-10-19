import { describe, expect, it } from "vitest";
import { artGrid, boardKeys } from "./boardPlan.mjs";
import { softenHexLines } from "./softLines.mjs";

// A small board of light ground with dark hex lines printed on it, RGB
const KEYS = boardKeys(4, 3);
const grid = artGrid(150, 4, 3);
const board = () => {
  const data = new Uint8Array(grid.width * grid.height * 3).fill(200);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      for (const key of KEYS) {
        const { x: cx, y: cy } = grid.center(key);
        const [hx, hy] = [x + 0.5 - cx, y + 0.5 - cy];
        const reach = Math.max(...[0, 1, 2, 3, 4, 5].map((d) => hx * Math.cos((d * Math.PI) / 3) + hy * Math.sin((d * Math.PI) / 3)));
        const toEdge = (Math.sqrt(3) / 2) * grid.radius - reach;
        if (toEdge >= 0 && toEdge < 1) data.fill(40, (y * grid.width + x) * 3, (y * grid.width + x) * 3 + 3);
      }
    }
  }
  return { data, width: grid.width, height: grid.height, channels: 3 };
};
const at = ({ data, width }: ReturnType<typeof board>, x: number, y: number) => data[(Math.round(y) * width + Math.round(x)) * 3]!;

describe("softenHexLines", () => {
  it("keeps a part of each line, the ground beside it as it was", () => {
    const image = board();
    const { x, y } = grid.center("1-1");
    const east = x + (Math.sqrt(3) / 2) * grid.radius - 0.5;
    expect(at(image, east, y)).toBe(40);

    softenHexLines(image, KEYS, grid.center, grid.radius, 4, 0.3);

    // 30% of the line's darkness is left
    expect(at(image, east, y)).toBe(Math.round(40 * 0.3 + 200 * 0.7));
    expect(at(image, x, y)).toBe(200);
    expect(at(image, east - 10, y)).toBe(200);
  });

  it("softens every line, slanted ones and the corners too", () => {
    const image = board();
    softenHexLines(image, KEYS, grid.center, grid.radius, 4, 0.3);
    // No pixel of a line inside the board is left at its full darkness
    let dark = 0;
    for (const key of KEYS) {
      const { x, y } = grid.center(key);
      for (let dy = -grid.radius + 2; dy < grid.radius - 2; dy++) {
        for (let dx = -grid.hexWidth / 2 + 2; dx < grid.hexWidth / 2 - 2; dx++) if (at(image, x + dx, y + dy) === 40) dark++;
      }
    }
    expect(dark).toBe(0);
  });
});
