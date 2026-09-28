// Build a scenario's board art from its terrain, by cutting hex tiles out of
// the Forêt d'Écouves art and pasting them where the new terrain goes.
// Usage: npm run board -- <tiles.json> <out.webp>
// Example: npm run board -- src/data/boards/arracourt.json src/assets/scenarios/Arracourt.webp
// tiles.json: { "forest": [{ "row": 3, "col": 9 }], "town": [...] }, in the scenario's
// positions; every other hex is plains. Plains, forest and town are cut out of the art,
// hills are drawn by terrain-tiles.mjs. The outer ring of hexes can't change terrain
// (the frame is drawn over them).
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { TILES } from "./terrain-tiles.mjs";

const SOURCE = "src/assets/scenarios/ForetDEcouves.webp";
// The source's terrain (from scenarios.ts), so its forests and towns can be painted over
const SOURCE_TILES = {
  forest: ["1-3", "1-7", "2-3", "2-4", "2-5", "2-7", "3-2", "3-3", "3-6", "3-7", "3-8", "4-4", "4-5", "4-7", "4-8", "4-9", "5-2", "5-3", "5-4", "5-6", "5-7"],
  town: ["0-5", "1-2", "1-8", "3-1", "3-5", "3-10", "6-2", "8-6"],
};
// Clean hexes to copy from. The section lines run through odd rows' columns 3 and 8,
// and along the edges of even rows' columns 3, 4, 8 and 9: plains there are copied
// from a hex with the line in the same place, and those hexes aren't copied elsewhere.
const SAMPLES = {
  plains: ["2-10", "4-2", "4-10", "6-5", "6-6", "7-5", "6-10", "4-11", "2-11", "7-10"],
  sectionLine: { odd: { 3: "7-3", 8: "7-8" }, even: { 3: "6-3", 4: "6-4", 8: "6-8", 9: "6-9" } },
  // The top and bottom rows are cut by the frame: plains there come from the same row
  edgeRow: { 0: "0-2", 8: "8-2" },
  forest: ["2-4", "4-5", "4-8", "3-6", "5-3", "2-5"],
  town: ["1-2", "1-8", "3-1", "3-5", "3-10", "6-2"],
};

// The same layout as components/boardGeometry.ts, in the image's pixels: the
// board draws the 1306×813 image into a 1169×700 box (hexSize 50), centred
const { width: W, height: H } = await sharp(SOURCE).metadata();
const boxWidth = 13 * 50 * Math.sqrt(3) + (50 * Math.sqrt(3)) / 2;
const scale = 700 / H;
const offsetX = (boxWidth - W * scale) / 2;
const radius = 50 / scale;
const hexWidth = (50 * Math.sqrt(3)) / scale;
const rowSpacing = 75 / scale;
const center = (key) => {
  const [row, col] = key.split("-").map(Number);
  return { x: (65 - offsetX) / scale + col * hexWidth + (row % 2) * (hexWidth / 2), y: 50 / scale + row * rowSpacing };
};
const isEdge = (key) => {
  const [row, col] = key.split("-").map(Number);
  return row === 0 || row === 8 || col === 0 || col === 12 - (row % 2);
};

// A hex cut out of the source, slightly larger so it keeps its outline
const size = Math.ceil(radius * 2 + 6);
const hexMask = (() => {
  const c = size / 2;
  const r = radius + 1.5;
  const points = [...Array(6)]
    .map((_, i) => {
      const a = (i * Math.PI) / 3 + Math.PI / 2;
      return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    })
    .join(" ");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><polygon points="${points}"/></svg>`);
})();
// The source with a transparent margin, so hexes cut by the frame can be cut out and pasted too
const PAD = size;
const padded = await sharp(SOURCE)
  .ensureAlpha()
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const corner = (key) => {
  const { x, y } = center(key);
  return { left: Math.round(x - size / 2) + PAD, top: Math.round(y - size / 2) + PAD };
};
const tile = (key) => {
  return sharp(padded)
    .extract({ ...corner(key), width: size, height: size })
    .composite([{ input: hexMask, blend: "dest-in" }])
    .png()
    .toBuffer();
};

// A drawn tile, rendered at the board's hex size; seeded by the hex so every hill differs
const drawn = (type, key) => {
  const [row, col] = key.split("-").map(Number);
  return sharp(Buffer.from(TILES[type](row * 13 + col + 1)))
    .resize(Math.round(hexWidth), Math.round(radius * 2))
    .png()
    .toBuffer();
};
const DRAWN = new Set(["hill"]);

const tiles = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = process.argv[3];
if (!out) {
  console.error("Usage: npm run board -- <tiles.json> <out.webp>");
  process.exit(1);
}
const wanted = new Map();
for (const [type, positions] of Object.entries(tiles)) {
  if ((!SAMPLES[type] && !DRAWN.has(type)) || type === "plains") throw new Error(`No art for ${type}`);
  positions.forEach(({ row, col }) => wanted.set(`${row}-${col}`, type));
}
const current = new Map(Object.entries(SOURCE_TILES).flatMap(([type, keys]) => keys.map((k) => [k, type])));

let n = 0;
const pick = (list) => list[n++ % list.length];
const layers = [];
for (const key of new Set([...wanted.keys(), ...current.keys()])) {
  const type = wanted.get(key) ?? "plains";
  if ((current.get(key) ?? "plains") === type) continue;
  const [row, col] = key.split("-").map(Number);
  if (isEdge(key) && !(type === "plains" && SAMPLES.edgeRow[row])) {
    throw new Error(`Hex ${key} is on the edge of the board: its terrain can't change`);
  }
  if (DRAWN.has(type)) {
    const { x, y } = center(key);
    layers.push({ input: await drawn(type, key), left: Math.round(x - hexWidth / 2) + PAD, top: Math.round(y - radius) + PAD });
    continue;
  }
  const sample =
    type === "plains" && SAMPLES.edgeRow[row]
      ? SAMPLES.edgeRow[row]
      : type === "plains" && SAMPLES.sectionLine[row % 2 ? "odd" : "even"][col]
        ? SAMPLES.sectionLine[row % 2 ? "odd" : "even"][col]
        : pick(SAMPLES[type]);
  layers.push({ input: await tile(sample), ...corner(key) });
}

// Pasted on the padded source, then cropped back; the frame is opaque, so nothing transparent is left
const composed = await sharp(padded).composite(layers).png().toBuffer();
await sharp(composed).extract({ left: PAD, top: PAD, width: W, height: H }).removeAlpha().webp({ quality: 85 }).toFile(out);
console.log(`${out}: ${layers.length} hexes changed`);
