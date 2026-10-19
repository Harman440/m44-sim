import { describe, expect, it } from "vitest";
import { joinedTileMaker } from "./joinedTiles.mjs";
import type { Pixels } from "./joinedHills.mjs";

const SIZE = 120;
// A made-up tile, RGBA: smooth green ground, and on a town two blue-grey houses with dark outlines
const tile = (houses: boolean): Pixels => {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const house = (x: number, y: number) => (x > 30 && x < 55 && y > 35 && y < 60) || (x > 65 && x < 90 && y > 60 && y < 80);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ground = [60 + x, 140 + (y >> 1), 40, 255];
      data.set(houses && house(x, y) ? [120, 140, 170, 255] : ground, (y * SIZE + x) * 4);
    }
  }
  return { data, width: SIZE, height: SIZE, channels: 4 };
};
const [W, H] = [40, 46];
const CLOSED = [false, false, false, false, false, false];
const at = (pixels: Uint8Array, x: number, y: number) => [...pixels.slice((y * W + x) * 4, (y * W + x) * 4 + 3)];

describe("joinedTileMaker", () => {
  it("makes a hex at its size, the same every time", () => {
    const make = joinedTileMaker("forest", tile(false), W, H, 1);
    const hex = { key: "4-4", open: [true, false, false, false, false, false], turns: 2, seed: 57 };

    expect(make(hex)).toHaveLength(W * H * 4);
    expect(make(hex)).toEqual(make(hex));
  });

  it("grows the same trees over a shared edge from both sides", () => {
    const make = joinedTileMaker("forest", tile(false), W, H, 1);
    const westOf = (turns: number) => make({ key: "4-4", open: [true, false, false, false, false, false], turns, seed: 57 });
    // 4-4's east edge is 4-5's west edge
    const east = make({ key: "4-5", open: [false, false, false, true, false, false], turns: 3, seed: 58 });
    // Where the tile under it turned doesn't change a pixel, a crown covers it: across the edge
    // from such a pixel, the other hex carries on the same crown
    const [west, turned] = [westOf(0), westOf(2)];
    const covered = [...Array(H).keys()].filter((y) => at(west, W - 1, y).join() === at(turned, W - 1, y).join());

    expect(covered.length).toBeGreaterThan(H / 4);
    for (const y of covered) at(west, W - 1, y).forEach((v, c) => expect(Math.abs(v - at(east, 0, y)[c]!)).toBeLessThan(10));
  });

  it("keeps the tile as it is away from its joined edges", () => {
    const plain = joinedTileMaker("forest", tile(false), W, H, 1)({ key: "4-4", open: CLOSED, turns: 0, seed: 57 });
    const joined = joinedTileMaker("forest", tile(false), W, H, 1)({ key: "4-4", open: [true, false, false, false, false, false], turns: 0, seed: 57 });

    expect(at(joined, 6, H / 2)).toEqual(at(plain, 6, H / 2));
    expect(at(joined, W - 2, H / 2)).not.toEqual(at(plain, W - 2, H / 2));
  });

  it("lays a town's houses out again on each hex", () => {
    const make = joinedTileMaker("town", tile(true), W, H, 1);
    const blue = (pixels: Uint8Array) => {
      let n = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 2]! > pixels[i]! + 8) n++;
      return n;
    };
    const one = make({ key: "2-2", open: CLOSED, turns: 0, seed: 1 });
    const other = make({ key: "5-7", open: CLOSED, turns: 0, seed: 70 });

    // Houses still on it, but not where they were, nor where the other town has them
    expect(blue(one)).toBeGreaterThan(100);
    expect(one).not.toEqual(other);
  });
});
