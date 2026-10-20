import { describe, expect, it } from "vitest";
import { OVERFLOW, growWoods, joinedTileMaker, toCountryside } from "./joinedTiles.mjs";
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
type Hex = Parameters<ReturnType<typeof joinedTileMaker>>[0];
// A hex with no countryside round it and no house over its edge, unless given
const hex = (key: string, open: boolean[], turns: number, seed: number, more: Partial<Hex> = {}): Hex => ({ key, open, turns, seed, bare: CLOSED, spill: -1, ...more });
const EAST = [true, false, false, false, false, false];

describe("joinedTileMaker", () => {
  it("makes a hex at its size, the same every time", () => {
    const make = joinedTileMaker("forest", tile(false), W, H, 1);
    const one = hex("4-4", EAST, 2, 57);

    expect(make(one).tile).toHaveLength(W * H * 4);
    expect(make(one)).toEqual(make(one));
  });

  it("grows the same trees over a shared edge from both sides", () => {
    const make = joinedTileMaker("forest", tile(false), W, H, 1);
    const westOf = (turns: number) => make(hex("4-4", EAST, turns, 57)).tile;
    // 4-4's east edge is 4-5's west edge
    const east = make(hex("4-5", [false, false, false, true, false, false], 3, 58)).tile;
    // Where the tile under it turned doesn't change a pixel, a crown covers it: across the edge
    // from such a pixel, the other hex carries on the same crown
    const [west, turned] = [westOf(0), westOf(2)];
    const covered = [...Array(H).keys()].filter((y) => at(west, W - 1, y).join() === at(turned, W - 1, y).join());

    expect(covered.length).toBeGreaterThan(H / 4);
    for (const y of covered) at(west, W - 1, y).forEach((v, c) => expect(Math.abs(v - at(east, 0, y)[c]!)).toBeLessThan(10));
  });

  it("keeps the tile as it is away from its joined edges", () => {
    const plain = joinedTileMaker("forest", tile(false), W, H, 1)(hex("4-4", CLOSED, 0, 57)).tile;
    const joined = joinedTileMaker("forest", tile(false), W, H, 1)(hex("4-4", EAST, 0, 57)).tile;

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
    const one = make(hex("2-2", CLOSED, 0, 1));
    const other = make(hex("5-7", CLOSED, 0, 70));

    // Houses still on it, but not where they were, nor where the other town has them
    expect(blue(one.tile)).toBeGreaterThan(100);
    expect(one.tile).not.toEqual(other.tile);
    expect(one.overflow).toBeNull();
  });

  // The overflow image's strongest alpha past the hex's east edge
  const [OW, OH] = [Math.round(OVERFLOW * W), Math.round(OVERFLOW * H)];
  const pastEast = (overflow: Uint8Array | null) => {
    const from = Math.ceil(OW / 2 + W / 2) + 1;
    let most = 0;
    for (let y = 0; y < OH; y++) for (let x = from; x < OW; x++) most = Math.max(most, overflow?.[(y * OW + x) * 4 + 3] ?? 0);
    return most;
  };

  it("grows a forest's trees out over the countryside beside it, and only there", () => {
    const make = joinedTileMaker("forest", tile(false), W, H, 1);
    const { overflow } = make(hex("4-4", CLOSED, 0, 57, { bare: EAST }));

    expect(overflow).toHaveLength(OW * OH * 4);
    expect(pastEast(overflow)).toBe(255);
    // Nothing past the west edge, which isn't countryside
    const y = Math.floor(OH / 2);
    expect(Math.max(...[...Array(Math.floor(OW / 2 - W / 2) - 1).keys()].map((x) => overflow![(y * OW + x) * 4 + 3]!))).toBe(0);
  });

  it("stands a town's house partly over the edge it spills over", () => {
    const make = joinedTileMaker("town", tile(true), W, H, 1);
    const { overflow } = make(hex("2-2", CLOSED, 0, 1, { bare: EAST, spill: 0 }));

    expect(pastEast(overflow)).toBeGreaterThan(200);
  });
});

describe("a town's streets", () => {
  it("run out over the edges they're given", () => {
    const make = joinedTileMaker("town", tile(true), W, H, 1);
    const [OW, OH] = [Math.round(OVERFLOW * W), Math.round(OVERFLOW * H)];
    const past = (overflow: Uint8Array | null, east: boolean) => {
      let most = 0;
      for (let y = 0; y < OH; y++) {
        for (let x = 0; x < OW; x++) {
          const out = east ? x > OW / 2 + W / 2 + 1 : x < OW / 2 - W / 2 - 1;
          if (out) most = Math.max(most, overflow?.[(y * OW + x) * 4 + 3] ?? 0);
        }
      }
      return most;
    };
    const { overflow } = make(hex("2-2", CLOSED, 0, 1, { streets: [0] }));

    expect(past(overflow, true)).toBe(255);
    expect(past(overflow, false)).toBe(0);
  });
});

describe("a town's cobbled yards", () => {
  it("spill out over some of its edges onto the countryside", () => {
    const make = joinedTileMaker("town", tile(true), W, H, 1);
    const [OW, OH] = [Math.round(OVERFLOW * W), Math.round(OVERFLOW * H)];
    const pastEast = (overflow: Uint8Array | null) => {
      let most = 0;
      for (let y = 0; y < OH; y++) for (let x = Math.ceil(OW / 2 + W / 2) + 1; x < OW; x++) most = Math.max(most, overflow?.[(y * OW + x) * 4 + 3] ?? 0);
      return most;
    };
    const spilt = [...Array(8).keys()].map((seed) => pastEast(make(hex("2-2", CLOSED, 0, seed, { bare: EAST })).overflow));

    // Over the countryside to the east in some towns, not all
    expect(spilt.filter((alpha) => alpha === 255).length).toBeGreaterThan(0);
    expect(spilt.filter((alpha) => alpha === 0).length).toBeGreaterThan(0);
  });
});

describe("growWoods", () => {
  // A river hex: grass, with a band of water across its middle, west to east, RGBA
  const [w, h] = [80, 92];
  const river = () => {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) data.set(Math.abs(y - h / 2) < 8 ? [70, 110, 160, 255] : [150, 176, 80, 255], (y * w + x) * 4);
    }
    return data;
  };
  const forest = tile(false);

  it("grows a forest from its edge up to the water, and not across it", () => {
    const data = river();
    // A forest across the north-east edge (5)
    growWoods(data, w, h, [false, false, false, false, false, true], 3, forest);

    const at = (x: number, y: number) => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 3)].join();
    // North of the water, near the forest: changed; the water and the land south of it: as they were
    expect(at(w / 2 + 6, h / 2 - 14)).not.toBe("150,176,80");
    expect(at(w / 2, h / 2)).toBe("70,110,160");
    expect(at(w / 2, h / 2 + 20)).toBe("150,176,80");
  });

  it("leaves a river with no forest beside it alone", () => {
    const data = river();
    growWoods(data, w, h, CLOSED, 3, forest);

    expect(data).toEqual(river());
  });
});

describe("toCountryside", () => {
  // A hex of grass with a grey square of cobbles in its middle, RGBA
  const [w, h] = [80, 92];
  const town = () => {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cobbles = Math.abs(x - w / 2) < 14 && Math.abs(y - h / 2) < 14;
        data.set(cobbles ? [190, 192, 196, 255] : [150, 176, 80, 255], (y * w + x) * 4);
      }
    }
    return data;
  };
  const alpha = (data: Uint8Array, x: number, y: number) => data[(y * w + x) * 4 + 3];

  it("keeps the hex's own things and the grass just round them, and clears the rest", () => {
    const data = town();
    toCountryside(data, w, h, 0.1, 7);

    expect(alpha(data, w / 2, h / 2)).toBe(255);
    // Just past the cobbles' edge, and towards the hex's edge
    expect(alpha(data, w / 2 + 15, h / 2)).toBe(255);
    expect(alpha(data, w - 6, h / 2)).toBe(0);
  });

  it("doesn't count specks in the grass as the hex's own", () => {
    const data = town();
    // A stone near the edge
    data.set([120, 120, 120, 255], ((h / 2) * w + w - 8) * 4);
    toCountryside(data, w, h, 0.1, 7);

    expect(alpha(data, w - 8, h / 2)).toBe(0);
  });
});
