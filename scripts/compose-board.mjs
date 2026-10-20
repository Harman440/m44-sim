// Build the scenarios' board art from their terrain, on the empty Memoir '44 board.
// Usage: npm run board [-- <part of a board's name>]
// scripts/boards.json lists every board: its terrain file (src/data/boards/*.json, which
// scenarios.ts imports too), the image to write, and optionally `drawn`: terrain to draw in code
// instead of painting it with the tiles ("river", which takes its bridges along; hedgerows and lakes
// are always drawn),
// and `separateHills`: each hill on its own tile instead of joined into ridges.
//
// The art is the empty board cropped to the edges of its hex grid, which is the box the app lays
// the image in (components/boardGeometry.ts), built at the empty board's resolution and saved at
// the size the app draws maps at (APP_ART_HEIGHT). The empty crop is written at that size too, for
// the app to draw maps on (src/assets/board-art/empty-board.webp).
// Which art goes on each hex is planned in src/boardArt/boardPlan.mjs, which the app uses too.
// Painted terrain comes from scripts/board-art/tiles/<terrain>/: one hex per image, filling the
// image's width, at any resolution. Each hex gets one of its terrain's tiles, turned 60° a random
// number of times. A river tile's name starts with the edges its river joins (0 = east, then
// clockwise: 3-0.webp runs west to east), and it's turned to join the river's edges; a painted
// bridge is a river tile with the bridge piece (board-art/pieces/bridge.webp) laid across it.
// A hill is made into a ridge (joined-hills.mjs) from its tile, running on into the hills and
// rivers beside it, its cliffs giving way to the countryside.
// Forests next to their own kind blend into it, their trees growing over the edge and out over
// the countryside, every town lays its tile's houses out again (some with a house standing over
// the edge, its streets running out a little), and towns and rivers end in the countryside, a
// forest growing into a river beside it (src/boardArt/joinedTiles.mjs).
// Drawn terrain comes from src/boardArt/terrainTiles.mjs: lakes and hedgerows always, and rivers
// and bridges when the board asks. A river runs through the edges it shares with the next river or
// bridge hexes, and a lake or a hedgerow joins the ones next to it. The board's edges are made soft
// (src/boardArt/softLines.mjs): the empty board's dark frame filled with countryside and the hex
// lines softened; the frame round the grid is put back over the new hexes.
import sharp from "sharp";
import { readFileSync, readdirSync } from "node:fs";
import {
  APP_ART_HEIGHT,
  ART_HEIGHT,
  BOARD_KEYS,
  COLS,
  PIECE_HEX_WIDTH,
  BRIDGE_WIDTH,
  artGrid,
  bridgeAngle,
  drawnSvg,
  planBoard,
} from "../src/boardArt/boardPlan.mjs";
import { joinedHills } from "./joined-hills.mjs";
import { HEDGEROW_SPREAD } from "../src/boardArt/terrainTiles.mjs";
import { OVERFLOW, growHill, growWoods, joinedTileMaker, toCountryside } from "../src/boardArt/joinedTiles.mjs";
import { LINE_BAND, fillFrame, softenHexLines } from "../src/boardArt/softLines.mjs";

const ART = "scripts/board-art";
// Where the empty board's hex grid is: the centre of hex 0-0 and the width of a hex, in pixels
// (found by fitting the grid to the printed hex lines)
const EMPTY_BOARD = { file: `${ART}/empty-board.webp`, x0: 115.1, y0: 130.4, width: 187.35 };
// The size the app draws boards at; the scenarios' art is saved at it too
const appWidth = artGrid(APP_ART_HEIGHT).width;
const APP_EMPTY_BOARD = "src/assets/board-art/empty-board.webp";
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// The art's grid: 13 hexes across, and 9 rows, 14 hex radii high. Odd rows are shifted right
const emptyRadius = EMPTY_BOARD.width / Math.sqrt(3);
const H = Math.round(14 * emptyRadius);
if (H !== ART_HEIGHT) throw new Error(`The empty board's grid is ${H} pixels high: set ART_HEIGHT in boardPlan.mjs`);
const { width: W, hexWidth, radius, center } = artGrid(H);
const hexPath = ({ x, y }, r) =>
  [...Array(6)]
    .map((_, i) => {
      const a = ((i * 60 + 30) * Math.PI) / 180;
      return `${i ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    })
    .join("") + "Z";
const svg = (width, height, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);

const printed = await sharp(EMPTY_BOARD.file)
  .extract({
    left: Math.round(EMPTY_BOARD.x0 - EMPTY_BOARD.width / 2),
    top: Math.round(EMPTY_BOARD.y0 - emptyRadius),
    width: Math.round(COLS * EMPTY_BOARD.width),
    height: Math.round(14 * emptyRadius),
  })
  .resize(W, H, { fit: "fill" })
  .ensureAlpha()
  .raw()
  .toBuffer();
// Its dark frame round the grid filled with the countryside beside it, so a map ends in countryside
fillFrame({ data: printed, width: W, height: H, channels: 4 }, BOARD_KEYS, center, radius);
const board = await sharp(printed, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
// The frame: everything outside the hexes
const frameMask = svg(W, H, `<path fill-rule="evenodd" d="M0,0H${W}V${H}H0Z${BOARD_KEYS.map((k) => hexPath(center(k), radius)).join("")}"/>`);
const frame = await sharp(board).ensureAlpha().composite([{ input: frameMask, blend: "dest-in" }]).png().toBuffer();
// Tiles are pasted on the board with a margin, so hexes on the edge can stick out
const PAD = 200;
const padded = await sharp(board).ensureAlpha().extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR }).png().toBuffer();

// The painted tiles' file names by terrain folder
const library = Object.fromEntries(
  readdirSync(`${ART}/tiles`).map((terrain) => [terrain, readdirSync(`${ART}/tiles/${terrain}`).filter((f) => f.endsWith(".webp")).sort()])
);
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
// Joined hills, one maker per hill tile
const hillMakers = new Map();
const hillMaker = async (file) => {
  if (!hillMakers.has(file)) hillMakers.set(file, await joinedHills(file, `${ART}/textures/grass.webp`, tileWidth, tileHeight));
  return hillMakers.get(file);
};
const joinedHill = async (file, open, key, seed) => {
  const tile = await (await hillMaker(file))(open, seed, center(key));
  return sharp(tile).composite([{ input: tileMask, blend: "dest-in" }]).png().toBuffer();
};
// The library's forest tile at twice its size, for the woods that grow into a river beside a forest
let forestPixels;
const forestTile = async () => {
  if (!forestPixels && library.forest?.length) {
    const file = `${ART}/tiles/forest/${library.forest[0]}`;
    const { width, height } = await sharp(file).metadata();
    const data = await sharp(file).resize(width * 2, height * 2).ensureAlpha().raw().toBuffer();
    forestPixels = { data, width: width * 2, height: height * 2, channels: 4 };
  }
  return forestPixels;
};
// Tiles blended into the same terrain beside them, one maker per tile, built at twice the board's size
const tileMakers = new Map();
const joinedTile = async (hex, file) => {
  if (!tileMakers.has(file)) {
    const { width, height } = await sharp(file).metadata();
    const [w2, h2] = [width * 2, height * 2];
    const data = await sharp(file).resize(w2, h2).ensureAlpha().raw().toBuffer();
    // The tile's folder is its terrain (a bridge's is a river tile)
    // (one maker per tile, made by the first hex that needs it: every river's gets the hills')
    const hills = library.hill?.length ? await hillMaker(`${ART}/tiles/hill/${library.hill[0]}`) : null;
    tileMakers.set(file, joinedTileMaker(hex.tile.split("/")[0], { data, width: w2, height: h2, channels: 4 }, tileWidth, tileHeight, 2, await forestTile(), hills?.raw));
  }
  const { tile: pixels, overflow } = tileMakers.get(file)({ ...hex, center: center(hex.key) });
  const tile = await sharp(Buffer.from(pixels.buffer), { raw: { width: 2 * tileWidth, height: 2 * tileHeight, channels: 4 } })
    .resize(tileWidth, tileHeight)
    .png()
    .toBuffer();
  const layer = placed(await sharp(tile).composite([{ input: tileMask, blend: "dest-in" }]).png().toBuffer(), hex.key, tileWidth, tileHeight);
  if (!overflow) return { layer, spill: null };
  // What spills out of the hex, laid over the board at the end
  const [w2, h2] = [Math.round(OVERFLOW * 2 * tileWidth), Math.round(OVERFLOW * 2 * tileHeight)];
  const [w, h] = [Math.round(w2 / 2), Math.round(h2 / 2)];
  const spill = await sharp(Buffer.from(overflow.buffer), { raw: { width: w2, height: h2, channels: 4 } }).resize(w, h).png().toBuffer();
  return { layer, spill: placed(spill, hex.key, w, h) };
};
const placed = (input, key, width, height) => {
  const { x, y } = center(key);
  return { input, left: Math.round(x - width / 2) + PAD, top: Math.round(y - height / 2) + PAD };
};
// The bridge piece laid square across the river from edge to edge, narrowed, with its shadow
const bridgeOver = async (key, edges) => {
  const file = `${ART}/pieces/bridge.webp`;
  const { width, height } = await sharp(file).metadata();
  const k = hexWidth / PIECE_HEX_WIDTH;
  const scaled = await sharp(file).resize(Math.round(width * k * BRIDGE_WIDTH), Math.round(height * k), { fit: "fill" }).png().toBuffer();
  const turned = await sharp(scaled).rotate(bridgeAngle(edges), { background: CLEAR }).png().toBuffer({ resolveWithObject: true });
  // The board's light comes from the top left
  const shadow = await sharp(turned.data).linear([0, 0, 0, 0.45], [0, 0, 0, 0]).blur(3).png().toBuffer();
  const piece = placed(turned.data, key, turned.info.width, turned.info.height);
  return [{ ...piece, input: shadow, left: piece.left + 4, top: piece.top + 5 }, piece];
};
// A drawn hedgerow, rendered HEDGEROW_SPREAD times the hex's box, to lay over what's round it
const hedgerowOver = async (hex) => {
  const [w, h] = [Math.round(HEDGEROW_SPREAD * tileWidth), Math.round(HEDGEROW_SPREAD * tileHeight)];
  return placed(await sharp(Buffer.from(drawnSvg(hex))).resize(w, h).png().toBuffer(), hex.key, w, h);
};
// A drawn tile, rendered at the board's hex size; a river's grass giving way to the countryside,
// or to a forest beside it
const drawnTile = async (hex) => {
  let input = await sharp(Buffer.from(drawnSvg(hex))).resize(tileWidth, tileHeight).png().toBuffer();
  if (hex.type === "river" || hex.type === "bridge") {
    const data = await sharp(input).ensureAlpha().raw().toBuffer();
    toCountryside(data, tileWidth, tileHeight, 0.07, hex.seed);
    const forest = await forestTile();
    if (forest) growWoods(data, tileWidth, tileHeight, hex.woods, hex.seed, forest);
    if (hex.hillTile && hex.hills) {
      const hill = (await hillMaker(`${ART}/tiles/${hex.hillTile}`)).raw1(hex.hills, hex.seed, center(hex.key));
      growHill(data, tileWidth, tileHeight, hex.hills, hex.seed, hill);
    }
    input = await sharp(data, { raw: { width: tileWidth, height: tileHeight, channels: 4 } }).png().toBuffer();
  }
  return placed(input, hex.key, tileWidth, tileHeight);
};

async function build({ terrain, image, drawn = [], separateHills = false }) {
  const tiles = JSON.parse(readFileSync(terrain, "utf8"));
  let plan;
  try {
    plan = planBoard(tiles, library, { drawn, separateHills });
  } catch (error) {
    const hint = error.message.startsWith("No painted river") ? ' ("drawn": ["river"] in scripts/boards.json)' : "";
    throw new Error(`${terrain}: ${error.message}${hint}`);
  }

  const layers = [];
  const spills = [];
  const hedgerows = [];
  for (const hex of plan) {
    const file = "tile" in hex ? `${ART}/tiles/${hex.tile}` : null;
    if (hex.art === "drawn" && hex.type === "hedgerow") hedgerows.push(await hedgerowOver(hex));
    else if (hex.art === "drawn") layers.push(await drawnTile(hex));
    else if (hex.art === "painted") layers.push(placed(await paintedTile(file, hex.turns), hex.key, tileWidth, tileHeight));
    else if (hex.art === "ridge") layers.push(placed(await joinedHill(file, hex.open, hex.key, hex.seed), hex.key, tileWidth, tileHeight));
    else if (hex.art === "joined") {
      const { layer, spill } = await joinedTile(hex, file);
      layers.push(layer);
      if (spill) spills.push(spill);
    }
    else layers.push(...(await bridgeOver(hex.key, hex.edges)));
  }

  // Pasted on the padded board, cropped back, its edges softened, then the frame put back on top
  const composed = await sharp(padded).composite(layers).png().toBuffer();
  const data = await sharp(composed).extract({ left: PAD, top: PAD, width: W, height: H }).raw().toBuffer();
  softenHexLines({ data, width: W, height: H, channels: 4 }, BOARD_KEYS, center, radius, LINE_BAND);
  // The hedgerows, larger than their hexes, and what spills out of the hexes laid on top
  const spilt = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: CLEAR })
    .composite([...hedgerows, ...spills])
    .png()
    .toBuffer();
  const framed = await sharp(await sharp(spilt).extract({ left: PAD, top: PAD, width: W, height: H }).png().toBuffer())
    .composite([{ input: frame }])
    .removeAlpha()
    .png()
    .toBuffer();
  // Built at the empty board's resolution, saved at the app's (a third of the download)
  await sharp(framed).resize(appWidth, APP_ART_HEIGHT, { fit: "fill" }).webp({ quality: 85 }).toFile(image);
  const notes = [...(drawn.length ? [`drawn ${drawn.join(" and ")}`] : []), ...(separateHills ? ["separate hills"] : [])];
  const hexes = new Set(plan.map((hex) => hex.key)).size;
  console.log(`${image}: ${appWidth}×${APP_ART_HEIGHT}, ${hexes} terrain hexes${notes.map((t) => `, ${t}`).join("")}`);
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

// The empty board the app draws maps on, at the size it draws them
await sharp(board).resize(appWidth, APP_ART_HEIGHT, { fit: "fill" }).webp({ quality: 85 }).toFile(APP_EMPTY_BOARD);
console.log(`${APP_EMPTY_BOARD}: ${appWidth}×${APP_ART_HEIGHT}`);
