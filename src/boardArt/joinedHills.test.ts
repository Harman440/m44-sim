import { describe, expect, it } from "vitest";
import { blurPixels, joinedHillMaker, plateauCrop } from "./joinedHills.mjs";
import type { Pixels } from "./joinedHills.mjs";

// A made-up hill tile: a light plateau inside a dark cliff ring, on mid grass, RGBA
const hillTile = (size: number): Pixels => {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const tone = r < 0.5 ? 200 : r < 0.7 ? 60 : 140;
      data.set([tone, tone + 20, tone - 40, 255], (y * size + x) * 4);
    }
  }
  return { data, width: size, height: size, channels: 4 };
};
const flat = (width: number, height: number, tone: number, channels = 3): Pixels => ({
  data: new Uint8Array(width * height * channels).fill(tone),
  width,
  height,
  channels,
});
const crop = (image: Pixels, { left, top, width, height }: ReturnType<typeof plateauCrop>): Pixels => {
  const data = new Uint8Array(width * height * image.channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width * image.channels; x++) data[y * width * image.channels + x] = image.data[((top + y) * image.width + left) * image.channels + x]!;
  }
  return { data, width, height, channels: image.channels };
};

const TILE = hillTile(120);
const maker = (scale: number) =>
  joinedHillMaker(
    { tile: TILE, plateau: crop(TILE, plateauCrop(120, 120)), grass: flat(64, 64, 110), fullTile: hillTile(40 * scale) },
    40,
    40,
    scale,
  );
const CLOSED = [false, false, false, false, false, false];
const EAST = [true, false, false, false, false, false];
const pixel = (data: Uint8Array, size: number, x: number, y: number) => Array.from(data.slice((y * size + x) * 4, (y * size + x) * 4 + 4));

describe("joinedHillMaker", () => {
  it("makes a hex at the scale asked for, clear past the cliffs' foot", () => {
    const twice = maker(2)(EAST, 7, { x: 100, y: 100 });
    const once = maker(1)(EAST, 7, { x: 100, y: 100 });
    const alpha = (x: number, y: number) => once[(y * 40 + x) * 4 + 3];

    expect(twice).toHaveLength(80 * 80 * 4);
    expect(once).toHaveLength(40 * 40 * 4);
    // The plateau in the middle is solid; past the cliffs, out towards the closed edges, the
    // countryside shows through
    expect(alpha(20, 20)).toBe(255);
    const clear = [...Array(40 * 40).keys()].filter((p) => once[p * 4 + 3] === 0);
    expect(clear.length).toBeGreaterThan(40);
    expect(clear.every((p) => Math.hypot((p % 40) - 19.5, Math.floor(p / 40) - 19.5) > 12)).toBe(true);
  });

  it("makes the same hex every time", () => {
    const make = maker(1);

    expect(make(EAST, 7, { x: 100, y: 100 })).toEqual(make(EAST, 7, { x: 100, y: 100 }));
  });

  it("runs the plateau out through an edge joined to another hill", () => {
    const make = maker(1);
    // Near the east edge, half way down: grass round a lone hill, plateau where a hill joins
    const east = (open: boolean[]) => pixel(make(open, 7, { x: 100, y: 100 }), 40, 36, 20);

    expect(east(EAST)).not.toEqual(east(CLOSED));
  });
});

describe("blurPixels", () => {
  it("spreads a bright pixel evenly round it", () => {
    const image = flat(9, 9, 0, 1);
    (image.data as Uint8Array)[4 * 9 + 4] = 255;
    const { data } = blurPixels(image, 1.2);
    const at = (x: number, y: number) => data[y * 9 + x]!;

    expect(at(4, 4)).toBeGreaterThan(at(5, 4));
    expect([at(3, 4), at(4, 3), at(4, 5)]).toEqual([at(5, 4), at(5, 4), at(5, 4)]);
    expect(at(0, 0)).toBe(0);
  });
});
