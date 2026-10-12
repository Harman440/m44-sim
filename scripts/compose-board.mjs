// Build a scenario's board art from its terrain, on the empty Memoir '44 board.
// Usage: npm run board -- <tiles.json> <out.webp>
// Example: npm run board -- src/data/boards/arracourt.json src/assets/scenarios/Arracourt.webp
// tiles.json: { "forest": [{ "row": 3, "col": 9 }], "town": [...] }, in the scenario's
// positions; every other hex is plains, the empty board's own.
// The art is the empty board cropped to the edges of its hex grid, which is the box the app
// lays the image in (components/boardGeometry.ts), at the empty board's resolution. Forest and
// town hexes are cut out of the Forêt d'Écouves painting; hills, hedgerows, rivers, bridges and
// lakes are drawn by terrain-tiles.mjs (a river runs through the edges it shares with the next
// river or bridge hexes, a lake joins the lake hexes next to it). The frame round the grid
// (with the medal tracks) is put back over the new hexes.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { TILES } from "./terrain-tiles.mjs";

const COLS = 13;
const ROWS = 9;

// The source images, and where their hex grid is: the centre of hex 0-0 and the width of a
// hex, in pixels (found by fitting the grid to the printed hex lines)
const EMPTY_BOARD = { file: "scripts/board-art/empty-board.webp", x0: 115.1, y0: 130.4, width: 187.35 };
const PAINTING = { file: "scripts/board-art/foret-decouves.webp", x0: 51.2, y0: 59.5, width: 100.1 };
// The painting's own terrain: a hex wanted with the same terrain is cut from the same place
const PAINTING_TILES = "src/data/boards/foret-decouves.json";
// Painting hexes never copied: Écouché's town has the scenario's medal on it
const MARKED = new Set(["0-5"]);
// Clean forest and town hexes of the painting, copied where the painting has other terrain
const SAMPLES = {
  forest: ["2-4", "4-5", "4-8", "3-6", "5-3", "2-5"],
  town: ["1-2", "1-8", "3-1", "3-5", "3-10", "6-2"],
};
const DRAWN = new Set(["hill", "hedgerow", "river", "bridge", "lake"]);

const tiles = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = process.argv[3];
if (!out) {
  console.error("Usage: npm run board -- <tiles.json> <out.webp>");
  process.exit(1);
}

// The art's grid: 13 hexes across, and 9 rows, 14 hex radii high. Odd rows are shifted right
const emptyRadius = EMPTY_BOARD.width / Math.sqrt(3);
const H = Math.round(14 * emptyRadius);
const W = Math.round((H * COLS * Math.sqrt(3)) / 14);
const hexWidth = W / COLS;
const radius = H / 14;
const gridCenter = ({ x0, y0, width }) => (key) => {
  const [row, col] = key.split("-").map(Number);
  return { x: x0 + col * width + (row % 2) * (width / 2), y: y0 + (row * 1.5 * width) / Math.sqrt(3) };
};
const center = gridCenter({ x0: hexWidth / 2, y0: radius, width: hexWidth });
const paintingCenter = gridCenter(PAINTING);
const hexPath = ({ x, y }, r) =>
  [...Array(6)]
    .map((_, i) => {
      const a = ((i * 60 + 30) * Math.PI) / 180;
      return `${i ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    })
    .join("") + "Z";
const svg = (width, height, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);

const board = await sharp(EMPTY_BOARD.file)
  .extract({
    left: Math.round(EMPTY_BOARD.x0 - EMPTY_BOARD.width / 2),
    top: Math.round(EMPTY_BOARD.y0 - emptyRadius),
    width: Math.round(COLS * EMPTY_BOARD.width),
    height: Math.round(14 * emptyRadius),
  })
  .resize(W, H, { fit: "fill" })
  .png()
  .toBuffer();

// The frame: everything outside the hexes
const keys = [...Array(ROWS)].flatMap((_, row) => [...Array(COLS - (row % 2))].map((_, col) => `${row}-${col}`));
const frameMask = svg(W, H, `<path fill-rule="evenodd" d="M0,0H${W}V${H}H0Z${keys.map((k) => hexPath(center(k), radius)).join("")}"/>`);
const frame = await sharp(board).ensureAlpha().composite([{ input: frameMask, blend: "dest-in" }]).png().toBuffer();

// The painting with a transparent margin, so hexes cut by its edge can be cut out too
const PAD = 100;
const painting = await sharp(PAINTING.file)
  .ensureAlpha()
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const paintingRadius = PAINTING.width / Math.sqrt(3);
const scale = hexWidth / PAINTING.width;
// The painting's hex `from`, slightly larger so it keeps its outline, scaled and placed on hex `to`
const cut = async (from, to) => {
  const { x, y } = paintingCenter(from);
  const half = Math.ceil(paintingRadius + 3);
  const left = Math.round(x) - half;
  const top = Math.round(y) - half;
  const size = Math.round(2 * half * scale);
  // Where the hex's centre falls in the scaled cut-out
  const inner = { x: (x - left) * scale, y: (y - top) * scale };
  const scaled = await sharp(painting)
    .extract({ left: left + PAD, top: top + PAD, width: 2 * half, height: 2 * half })
    .resize(size, size)
    .png()
    .toBuffer();
  const input = await sharp(scaled)
    .composite([{ input: svg(size, size, `<path d="${hexPath(inner, (paintingRadius + 1.5) * scale)}"/>`), blend: "dest-in" }])
    .png()
    .toBuffer();
  const target = center(to);
  return { input, left: Math.round(target.x - inner.x) + PAD, top: Math.round(target.y - inner.y) + PAD };
};

// The hex across each edge (0 = east, then clockwise), odd rows shifted right
const neighbor = (key, d) => {
  const [row, col] = key.split("-").map(Number);
  const shift = row % 2;
  const [dr, dc] = [[0, 1], [1, shift], [1, shift - 1], [0, -1], [-1, shift - 1], [-1, shift]][d];
  return `${row + dr}-${col + dc}`;
};
const edgesTo = (key, types) => [...Array(6)].map((_, d) => types.includes(wanted.get(neighbor(key, d))));
// Where a river flows through a hex: the edges it shares with the next river or bridge hexes.
// At the end of a river (on the board's edge) it carries straight on off the board.
const riverEdges = (key) => {
  const edges = edgesTo(key, ["river", "bridge"]).flatMap((water, d) => (water ? [d] : []));
  if (edges.length > 2) throw new Error(`River at ${key} joins more than two river hexes`);
  if (edges.length === 2) return edges;
  if (edges.length === 1) return [edges[0], (edges[0] + 3) % 6];
  return [0, 3];
};
// A drawn tile, rendered at the board's hex size; seeded by the hex so every hill differs
const drawn = async (type, key) => {
  const [row, col] = key.split("-").map(Number);
  const seed = row * 13 + col + 1;
  const tile =
    type === "river" || type === "bridge" ? TILES[type](...riverEdges(key), seed)
    : type === "lake" ? TILES.lake(edgesTo(key, ["lake"]), seed)
    : TILES[type](seed);
  const input = await sharp(Buffer.from(tile))
    .resize(Math.round(hexWidth), Math.round(radius * 2))
    .png()
    .toBuffer();
  const { x, y } = center(key);
  return { input, left: Math.round(x - hexWidth / 2) + PAD, top: Math.round(y - radius) + PAD };
};

const wanted = new Map();
for (const [type, positions] of Object.entries(tiles)) {
  if (!SAMPLES[type] && !DRAWN.has(type)) throw new Error(`No art for ${type}`);
  positions.forEach(({ row, col }) => wanted.set(`${row}-${col}`, type));
}
const paintingTerrain = new Map(
  Object.entries(JSON.parse(readFileSync(PAINTING_TILES, "utf8"))).flatMap(([type, positions]) =>
    positions.map(({ row, col }) => [`${row}-${col}`, type])
  )
);

let n = 0;
const pick = (list) => list[n++ % list.length];
const layers = [];
for (const [key, type] of wanted) {
  if (DRAWN.has(type)) layers.push(await drawn(type, key));
  else layers.push(await cut(paintingTerrain.get(key) === type && !MARKED.has(key) ? key : pick(SAMPLES[type]), key));
}

// Pasted on the padded board, cropped back, then the frame put back on top
const padded = await sharp(board)
  .ensureAlpha()
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const composed = await sharp(padded).composite(layers).png().toBuffer();
await sharp(await sharp(composed).extract({ left: PAD, top: PAD, width: W, height: H }).png().toBuffer())
  .composite([{ input: frame }])
  .removeAlpha()
  .webp({ quality: 85 })
  .toFile(out);
console.log(`${out}: ${W}×${H}, ${layers.length} terrain hexes`);
