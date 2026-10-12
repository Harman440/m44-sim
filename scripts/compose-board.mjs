// Build the scenarios' board art from their terrain, on the empty Memoir '44 board.
// Usage: npm run board [-- <part of a board's name>]
// scripts/boards.json lists every board: its terrain file (src/data/boards/*.json, which
// scenarios.ts imports too), the image to write, and optionally `drawn`: terrain to draw in code
// instead of painting it with the tiles ("river", which takes its bridges along, and "hedgerow").
//
// The art is the empty board cropped to the edges of its hex grid, which is the box the app lays
// the image in (components/boardGeometry.ts), at the empty board's resolution.
// Painted terrain comes from scripts/board-art/tiles/<terrain>/: one hex per image, filling the
// image's width, at any resolution. Each hex gets one of its terrain's tiles, turned 60° a random
// number of times. A river tile's name starts with the edges its river joins (0 = east, then
// clockwise: 3-0.webp runs west to east), and it's turned to join the river's edges; a painted
// bridge is a river tile with the bridge piece (board-art/pieces/bridge.webp) laid across it.
// Drawn terrain comes from terrain-tiles.mjs: lakes always, and rivers, bridges and hedgerows when
// the board asks. A river runs through the edges it shares with the next river or bridge hexes,
// and a lake joins the lake hexes next to it. The frame round the grid is put back over the new hexes.
import sharp from "sharp";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { TILES as DRAWN_TILES } from "./terrain-tiles.mjs";

const COLS = 13;
const ROWS = 9;
const ART = "scripts/board-art";
// Where the empty board's hex grid is: the centre of hex 0-0 and the width of a hex, in pixels
// (found by fitting the grid to the printed hex lines)
const EMPTY_BOARD = { file: `${ART}/empty-board.webp`, x0: 115.1, y0: 130.4, width: 187.35 };
// The pieces were cut out on a hex box from a board whose hexes are this wide, in pixels
const PIECE_HEX_WIDTH = 173.35;
// The terrain a board can ask to draw, and the terrain each choice takes along
const DRAWABLE = { river: ["river", "bridge"], hedgerow: ["hedgerow"] };
const ALWAYS_DRAWN = ["lake"];
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// The art's grid: 13 hexes across, and 9 rows, 14 hex radii high. Odd rows are shifted right
const emptyRadius = EMPTY_BOARD.width / Math.sqrt(3);
const H = Math.round(14 * emptyRadius);
const W = Math.round((H * COLS * Math.sqrt(3)) / 14);
const hexWidth = W / COLS;
const radius = H / 14;
const center = (key) => {
  const [row, col] = key.split("-").map(Number);
  return { x: hexWidth / 2 + col * hexWidth + (row % 2) * (hexWidth / 2), y: radius + row * 1.5 * radius };
};
const hexPath = ({ x, y }, r) =>
  [...Array(6)]
    .map((_, i) => {
      const a = ((i * 60 + 30) * Math.PI) / 180;
      return `${i ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    })
    .join("") + "Z";
const svg = (width, height, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);
// A number from 0 to n − 1 picked by the hex and a salt, so a rebuild gives the same map
const pickFor = (key, salt, n) => {
  const [row, col] = key.split("-").map(Number);
  let h = Math.imul(row + 1, 73856093) ^ Math.imul(col + 1, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) % n;
};

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
// Tiles are pasted on the board with a margin, so hexes on the edge can stick out
const PAD = 200;
const padded = await sharp(board).ensureAlpha().extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR }).png().toBuffer();

const tilesOf = (terrain) => {
  const dir = `${ART}/tiles/${terrain}`;
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".webp")).sort().map((f) => `${dir}/${f}`) : [];
};
const tileWidth = Math.round(hexWidth);
const tileHeight = Math.round(2 * radius);
const tileMask = svg(tileWidth, tileHeight, `<path d="${hexPath({ x: tileWidth / 2, y: tileHeight / 2 }, tileHeight / 2 + 0.5)}"/>`);
// A tile at the board's size, turned `turns` × 60° clockwise (at twice the size, so it blurs less)
const paintedTile = async (file, turns) => {
  const [w2, h2] = [2 * tileWidth, 2 * tileHeight];
  let img = await sharp(file).resize(w2, h2, { fit: "fill" }).png().toBuffer();
  if (turns % 6) {
    const turned = await sharp(img).rotate(turns * 60, { background: CLEAR }).png().toBuffer({ resolveWithObject: true });
    img = await sharp(turned.data)
      .extract({ left: Math.round((turned.info.width - w2) / 2), top: Math.round((turned.info.height - h2) / 2), width: w2, height: h2 })
      .png()
      .toBuffer();
  }
  const small = await sharp(img).resize(tileWidth, tileHeight).png().toBuffer();
  return sharp(small).composite([{ input: tileMask, blend: "dest-in" }]).png().toBuffer();
};
const placed = (input, key, width, height) => {
  const { x, y } = center(key);
  return { input, left: Math.round(x - width / 2) + PAD, top: Math.round(y - height / 2) + PAD };
};

// The painted river tiles that join edges a and b, each with its turn
const riverTile = (key, [a, b]) => {
  const fits = tilesOf("river").flatMap((file) => {
    const [p, q] = file.split("/").pop().match(/^(\d)-(\d)/).slice(1).map(Number);
    return [...Array(6).keys()]
      .filter((t) => [(p + t) % 6, (q + t) % 6].sort().join() === [a, b].sort().join())
      .map((turns) => ({ file, turns }));
  });
  if (!fits.length) {
    throw new Error(
      `No painted river tile joins edges ${a} and ${b} (at ${key}): add one to ${ART}/tiles/river, or draw this board's rivers ("drawn": ["river"] in scripts/boards.json)`
    );
  }
  return fits[pickFor(key, 3, fits.length)];
};
// The bridge piece laid square across the river from edge a to edge b, with its shadow.
// In the piece's image its deck runs north to south, across a river running west to east
const edgeMid = (d) => ({ x: Math.cos((d * Math.PI) / 3), y: Math.sin((d * Math.PI) / 3) });
const bridgeOver = async (key, [a, b]) => {
  const file = `${ART}/pieces/bridge.webp`;
  const { width, height } = await sharp(file).metadata();
  const k = hexWidth / PIECE_HEX_WIDTH;
  const scaled = await sharp(file).resize(Math.round(width * k), Math.round(height * k)).png().toBuffer();
  const [ma, mb] = [edgeMid(a), edgeMid(b)];
  const angle = (Math.atan2(mb.y - ma.y, mb.x - ma.x) * 180) / Math.PI;
  const turned = await sharp(scaled).rotate(angle, { background: CLEAR }).png().toBuffer({ resolveWithObject: true });
  // The board's light comes from the top left
  const shadow = await sharp(turned.data).linear([0, 0, 0, 0.45], [0, 0, 0, 0]).blur(3).png().toBuffer();
  const piece = placed(turned.data, key, turned.info.width, turned.info.height);
  return [{ ...piece, input: shadow, left: piece.left + 4, top: piece.top + 5 }, piece];
};

async function build({ terrain, image, drawn: drawnChoice = [] }) {
  const tiles = JSON.parse(readFileSync(terrain, "utf8"));
  const drawn = new Set([
    ...ALWAYS_DRAWN,
    ...drawnChoice.flatMap((t) => {
      if (!DRAWABLE[t]) throw new Error(`${terrain}: can't draw ${t}`);
      return DRAWABLE[t];
    }),
  ]);
  const wanted = new Map();
  for (const [type, positions] of Object.entries(tiles)) {
    const art = drawn.has(type) ? DRAWN_TILES[type] : type === "bridge" ? tilesOf("river").length : tilesOf(type).length;
    if (!art) throw new Error(`${terrain}: no art for ${type}`);
    positions.forEach(({ row, col }) => wanted.set(`${row}-${col}`, type));
  }

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
  // A drawn tile, rendered at the board's hex size; seeded by the hex so every one differs
  const drawnTile = async (type, key) => {
    const [row, col] = key.split("-").map(Number);
    const seed = row * 13 + col + 1;
    const tile =
      type === "river" || type === "bridge" ? DRAWN_TILES[type](...riverEdges(key), seed)
      : type === "lake" ? DRAWN_TILES.lake(edgesTo(key, ["lake"]), seed)
      : DRAWN_TILES[type](seed);
    const input = await sharp(Buffer.from(tile)).resize(tileWidth, tileHeight).png().toBuffer();
    return placed(input, key, tileWidth, tileHeight);
  };

  const layers = [];
  for (const [key, type] of wanted) {
    if (drawn.has(type)) {
      layers.push(await drawnTile(type, key));
    } else if (type === "river" || type === "bridge") {
      const edges = riverEdges(key);
      const { file, turns } = riverTile(key, edges);
      layers.push(placed(await paintedTile(file, turns), key, tileWidth, tileHeight));
      if (type === "bridge") layers.push(...(await bridgeOver(key, edges)));
    } else {
      const choices = tilesOf(type);
      const file = choices[pickFor(key, 1, choices.length)];
      layers.push(placed(await paintedTile(file, pickFor(key, 2, 6)), key, tileWidth, tileHeight));
    }
  }

  // Pasted on the padded board, cropped back, then the frame put back on top
  const composed = await sharp(padded).composite(layers).png().toBuffer();
  await sharp(await sharp(composed).extract({ left: PAD, top: PAD, width: W, height: H }).png().toBuffer())
    .composite([{ input: frame }])
    .removeAlpha()
    .webp({ quality: 85 })
    .toFile(image);
  console.log(`${image}: ${W}×${H}, ${wanted.size} terrain hexes${drawnChoice.length ? `, drawn ${drawnChoice.join(" and ")}` : ""}`);
}

const only = process.argv[2]?.toLowerCase();
const boards = JSON.parse(readFileSync("scripts/boards.json", "utf8")).filter(
  (b) => !only || `${b.terrain} ${b.image}`.toLowerCase().includes(only)
);
if (!boards.length) {
  console.error(`No board in scripts/boards.json matches "${process.argv[2]}"`);
  process.exit(1);
}
for (const b of boards) await build(b);
