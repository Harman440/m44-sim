// boardArt/drawBoard.ts
// A board's art drawn in the browser, for a map that has no painted art (one made in the map
// editor): the empty board, the art boardPlan.mjs plans for each terrain hex, as `npm run board`
// does for the catalog's art (hills next to each other joined into ridges, joinedHills.mjs;
// forests and hedgerows blended into their own kind and towns' houses laid out again,
// joinedTiles.mjs, with what spills out of them over the countryside, and towns and rivers ending
// in the countryside) and the board's edges made soft (softLines.mjs: the frame filled with
// countryside, the hex lines softened), but
// with rivers painted only when the library has a tile for every bend (drawn otherwise), and the
// board's frame put back on top.
// It's laid out like the painted art, so its URL goes straight into Scenario.image.
// Each hex's image is loaded or drawn once and kept, so drawing the board again after a change
// only pastes images: the editor can redraw the whole board on every tap (about 25 ms on a
// desktop, 100 ms with its processor slowed 4 times; the JPEG takes most of it). A new ridge hex
// takes longest to make, about 26 ms on a desktop.
import { Tiles } from "../types/scenario";
import { HexType } from "../types/hex";
import {
  APP_ART_HEIGHT,
  ART_HEIGHT,
  PIECE_HEX_WIDTH,
  BRIDGE_WIDTH,
  artGrid,
  artHeightFor,
  boardKeys,
  bridgeAngle,
  canPaintRivers,
  drawnSvg,
  pickFor,
  planBoard,
} from "./boardPlan.mjs";
import { BoardSize, STANDARD_BOARD, isStandardBoard, sectionLines } from "../game-core/boardSize";
import type { DrawnHex, HexArt, JoinedHex, RidgeHex } from "./boardPlan.mjs";
import { blurPixels, joinedHillMaker, plateauCrop } from "./joinedHills.mjs";
import type { Pixels, RidgeMaker } from "./joinedHills.mjs";
import { OVERFLOW, growWoods, joinedTileMaker, toCountryside } from "./joinedTiles.mjs";
import { LINE_BAND, fillFrame, softenHexLines } from "./softLines.mjs";
import type { JoinedMaker } from "./joinedTiles.mjs";
import emptyBoardUrl from "../assets/board-art/empty-board.webp";
import bridgeUrl from "../../scripts/board-art/pieces/bridge.webp";
import grassUrl from "../../scripts/board-art/textures/grass.webp";

// The library of painted tiles (scripts/board-art/tiles/<terrain>/<file>), by "<terrain>/<file>"
const TILE_URLS = new Map(
  Object.entries(import.meta.glob<string>("../../scripts/board-art/tiles/*/*.webp", { eager: true, import: "default" })).map(
    ([path, url]) => [path.split("/").slice(-2).join("/"), url],
  ),
);

/** The library's file names by terrain, sorted, as boardPlan.mjs takes them */
export const TILE_LIBRARY: Record<string, string[]> = {};
for (const name of [...TILE_URLS.keys()].sort()) {
  const [terrain = "", file = ""] = name.split("/");
  (TILE_LIBRARY[terrain] ??= []).push(file);
}

/** The art the app plans for a map's terrain (`plain`: each hex its own tile, nothing joined) */
export const planMapArt = (tiles: Tiles, size: BoardSize = STANDARD_BOARD, plain = false): HexArt[] =>
  planBoard(tiles, TILE_LIBRARY, {
    drawn: canPaintRivers(tiles, TILE_LIBRARY) ? [] : ["river"],
    strict: false,
    keys: boardKeys(size.cols, size.rows),
    plain,
  });

/**
 * How a board is drawn: `height` the standard board's; `plain`, quickly, for the map editor while
 * a map is being made: each terrain hex its own library tile, with no hills joined into ridges, no
 * terrain blended or spilling over its edges and the hex lines as printed. The finished art is
 * drawn once the map is done (the menu and the game)
 */
export type DrawOptions = { height?: number; plain?: boolean };

const load = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the board art"));
    img.src = src;
  });

/** Kept by key; one that fails is tried again next time */
const cached = <T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<T> => {
  let value = cache.get(key);
  if (!value) {
    value = make();
    value.catch(() => cache.delete(key));
    cache.set(key, value);
  }
  return value;
};

const images = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (url: string) => cached(images, url, () => load(url));

// The library's forest tile at twice its size, for the woods that grow into a river beside a forest
let forestPixels: Promise<Pixels> | undefined;
const forestTile = () =>
  (forestPixels ??= loadImage(TILE_URLS.get(`forest/${TILE_LIBRARY.forest?.[0]}`) ?? "").then((image) =>
    pixelsOf(image, image.naturalWidth * 2, image.naturalHeight * 2),
  ));

// Drawn hexes rendered once at a size and kept as bitmaps: the browser would render an SVG
// image again every time it's pasted
const drawnTiles = new Map<string, Promise<HTMLCanvasElement>>();
const drawnTile = (hex: DrawnHex, width: number, height: number) =>
  cached(drawnTiles, `${hex.type}:${hex.seed}:${hex.edges.join()}:${hex.open.map(Number).join("")}:${hex.woods.map(Number).join("")}@${width}x${height}`, async () => {
    const svg = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawnSvg(hex))}`);
    const tile = document.createElement("canvas");
    tile.width = width;
    tile.height = height;
    const ctx = tile.getContext("2d", { willReadFrequently: true });
    ctx?.drawImage(svg, 0, 0, width, height);
    // A river's grass giving way to the countryside, or a forest beside it, as the script draws it
    if (ctx && (hex.type === "river" || hex.type === "bridge")) {
      const pixels = ctx.getImageData(0, 0, width, height);
      toCountryside(pixels.data as unknown as Uint8Array, width, height, 0.07, hex.seed);
      if (hex.woods.some(Boolean)) growWoods(pixels.data as unknown as Uint8Array, width, height, hex.woods, hex.seed, await forestTile());
      ctx.putImageData(pixels, 0, 0);
    }
    return tile;
  });

/** An image's pixels at a size (RGBA), or a part of them */
const pixelsOf = (image: CanvasImageSource, width: number, height: number, crop = { left: 0, top: 0, width, height }): Pixels => {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No canvas to read the board art");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, -crop.left, -crop.top, width, height);
  return { data: ctx.getImageData(0, 0, crop.width, crop.height).data, width: crop.width, height: crop.height, channels: 4 };
};

// Ridges made from a hill tile at a size, as scripts/joined-hills.mjs reads the images for the script
const ridgeMakers = new Map<string, Promise<RidgeMaker>>();
const ridgeMaker = (tile: string, width: number, height: number) =>
  cached(ridgeMakers, `${tile}@${width}x${height}`, async () => {
    const [hill, grass] = await Promise.all([loadImage(TILE_URLS.get(tile) ?? tile), loadImage(grassUrl)]);
    const [OW, OH] = [hill.naturalWidth * 2, hill.naturalHeight * 2];
    return joinedHillMaker(
      {
        tile: pixelsOf(hill, OW, OH),
        plateau: blurPixels(pixelsOf(hill, OW, OH, plateauCrop(OW, OH)), 1.2),
        grass: pixelsOf(grass, grass.naturalWidth * 2, grass.naturalHeight * 2),
        fullTile: pixelsOf(hill, width, height),
      },
      width,
      height,
      1,
    );
  });

/** A hill joined to the hills beside it, made at the board's size (the script makes it at twice), kept as a bitmap */
const ridgeTile = (hex: RidgeHex, grid: ReturnType<typeof artGrid>) => {
  const [width, height] = [Math.round(grid.hexWidth), Math.round(2 * grid.radius)];
  const key = `ridge:${hex.tile}:${hex.key}:${hex.open.map(Number).join("")}@${width}x${height}`;
  return cached(drawnTiles, key, async () => {
    const pixels = (await ridgeMaker(hex.tile, width, height))(hex.open, hex.seed, grid.center(hex.key));
    const tile = document.createElement("canvas");
    tile.width = width;
    tile.height = height;
    tile.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), width, height), 0, 0);
    return tile;
  });
};

// Tiles blended into the same terrain beside them, made from a library tile at a size: the tile
// read at twice its own size, as the script reads it
const joinedMakers = new Map<string, Promise<JoinedMaker>>();
const joinedMaker = (type: string, tile: string, width: number, height: number) =>
  cached(joinedMakers, `${tile}@${width}x${height}`, async () => {
    const image = await loadImage(TILE_URLS.get(tile) ?? tile);
    const forest = type === "river" ? await forestTile() : undefined;
    return joinedTileMaker(type, pixelsOf(image, image.naturalWidth * 2, image.naturalHeight * 2), width, height, 1, forest);
  });

/** RGBA pixels as a canvas */
const canvasOf = (pixels: Uint8Array, width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), width, height), 0, 0);
  return canvas;
};

/**
 * A forest, town or hedgerow blended into its own kind beside it, made at the board's size and
 * kept as bitmaps: the hex, and what spills out of it (OVERFLOW times the hex's size), if anything
 */
const joinedArt = new Map<string, Promise<{ tile: HTMLCanvasElement; overflow: HTMLCanvasElement | null }>>();
const joinedTile = (hex: JoinedHex, grid: ReturnType<typeof artGrid>) => {
  const [width, height] = [Math.round(grid.hexWidth), Math.round(2 * grid.radius)];
  const edges = (list: boolean[]) => list.map(Number).join("");
  const key = `${hex.tile}:${hex.key}:${hex.turns}:${edges(hex.open)}:${edges(hex.bare)}:${hex.spill}:${hex.streets ?? ""}@${width}x${height}`;
  return cached(joinedArt, key, async () => {
    // The tile's folder is its terrain (a bridge's is a river tile)
    const { tile, overflow } = (await joinedMaker(hex.tile.split("/")[0] ?? hex.type, hex.tile, width, height))(hex);
    const [ow, oh] = [Math.round(OVERFLOW * width), Math.round(OVERFLOW * height)];
    return { tile: canvasOf(tile, width, height), overflow: overflow ? canvasOf(overflow, ow, oh) : null };
  });
};

/** The image a hex is drawn with: its painted tile, its ridge, its joined tile or its drawn tile, at the board's size */
const hexImage = (hex: HexArt, grid: ReturnType<typeof artGrid>): Promise<CanvasImageSource> | null => {
  if (hex.art === "painted") return loadImage(TILE_URLS.get(hex.tile) ?? hex.tile);
  if (hex.art === "ridge") return ridgeTile(hex, grid);
  if (hex.art === "joined") return joinedTile(hex, grid).then(({ tile }) => tile);
  if (hex.art === "drawn") return drawnTile(hex, Math.ceil(grid.hexWidth), Math.ceil(2 * grid.radius));
  return null;
};

const hexPath = (ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }, r: number) => {
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + 30) * Math.PI) / 180;
    ctx[i ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
};

type Grid = ReturnType<typeof artGrid>;

// A bigger board's background is made from the empty standard board: its hexes, picked away from
// the section lines printed on it (the long rows' hexes on each side of a line, the short rows'
// hexes it runs through) and from its edges, and its dark green frame
const CLEAN_HEXES = [
  ...[2, 4, 6].flatMap((row) => [1, 2, 5, 6, 7, 10, 11].map((col) => `${row}-${col}`)),
  ...[1, 3, 5, 7].flatMap((row) => [1, 2, 4, 5, 6, 9, 10].map((col) => `${row}-${col}`)),
];
const cleanHexes = (row: number) => CLEAN_HEXES.filter((key) => Number(key.split("-")[0]) % 2 === row % 2);

/** The empty board's frame, from the grass at its left edge beside the second row, stretched over the whole board */
const paintFrame = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, source: Grid, width: number, height: number) => {
  const { y } = source.center("1-0");
  ctx.drawImage(base, 3, y - source.radius * 0.4, source.hexWidth * 0.3, source.radius * 0.8, 0, 0, width, height);
};

/** A bigger board's open ground: each hex one of the empty board's, the frame round them, and its own section lines */
function paintBigBase(ctx: CanvasRenderingContext2D, base: HTMLImageElement, grid: Grid, size: BoardSize, scale: number) {
  const source = artGrid(base.naturalHeight);
  paintFrame(ctx, base, source, grid.width, grid.height);
  for (const key of boardKeys(size.cols, size.rows)) {
    const choices = cleanHexes(Number(key.split("-")[0]));
    const from = source.center(choices[pickFor(key, 7, choices.length)]!);
    const to = grid.center(key);
    ctx.save();
    ctx.beginPath();
    hexPath(ctx, to, grid.radius + 0.5 * scale);
    ctx.clip();
    const [w, h] = [source.hexWidth * 1.1, source.radius * 2.2];
    const k = grid.hexWidth / source.hexWidth;
    ctx.drawImage(base, from.x - w / 2, from.y - h / 2, w, h, to.x - (w * k) / 2, to.y - (h * k) / 2, w * k, h * k);
    ctx.restore();
  }
}

/** The section lines, dashed red as on the printed board, where a bigger board's thirds meet */
function paintSectionLines(ctx: CanvasRenderingContext2D, grid: Grid, cols: number, scale: number) {
  const lines = sectionLines(cols);
  ctx.save();
  ctx.strokeStyle = "rgba(196, 66, 38, 0.85)";
  ctx.lineWidth = 3 * scale;
  ctx.setLineDash([9 * scale, 6 * scale]);
  for (const at of [lines.left, lines.right]) {
    const x = grid.hexWidth / 2 + at * grid.hexWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, grid.height);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw a map's board art on a canvas. `height` is the standard board's: a bigger board is drawn
 * taller and wider, its hexes the same size
 */
export async function paintBoard(
  canvas: HTMLCanvasElement,
  tiles: Tiles,
  size: BoardSize = STANDARD_BOARD,
  { height = APP_ART_HEIGHT, plain = false }: DrawOptions = {},
): Promise<void> {
  const standard = isStandardBoard(size);
  const grid = standard ? artGrid(height) : artGrid(artHeightFor(size.rows, height), size.cols, size.rows);
  const plan = planMapArt(tiles, size, plain);
  const keys = boardKeys(size.cols, size.rows);
  const tileWidth = grid.hexWidth;
  const tileHeight = 2 * grid.radius;
  // Everything loaded first, so the board is drawn in one go
  const [base, bridge, art, spills] = await Promise.all([
    loadImage(emptyBoardUrl),
    loadImage(bridgeUrl),
    Promise.all(plan.map((hex) => hexImage(hex, grid))),
    Promise.all(plan.map((hex) => (hex.art === "joined" ? joinedTile(hex, grid).then(({ overflow }) => overflow) : null))),
  ]);

  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas to draw the board on");
  // Sizes in the painted art's pixels, scaled to this board
  const scale = height / ART_HEIGHT;

  // The empty board, its frame already countryside (`npm run board` fills it); a bigger board's
  // filled here, and kept to put the frame back at the end
  let frame: CanvasImageSource = base;
  if (standard) ctx.drawImage(base, 0, 0, grid.width, height);
  else {
    paintBigBase(ctx, base, grid, size, scale);
    const pixels = ctx.getImageData(0, 0, grid.width, grid.height);
    fillFrame({ data: pixels.data, width: grid.width, height: grid.height, channels: 4 }, keys, grid.center, grid.radius);
    ctx.putImageData(pixels, 0, 0);
    frame = canvasOf(new Uint8Array(pixels.data.buffer), grid.width, grid.height);
  }
  plan.forEach((hex, i) => {
    const center = grid.center(hex.key);
    const image = art[i];
    ctx.save();
    if ((hex.art === "painted" || hex.art === "ridge" || hex.art === "joined") && image) {
      // Turned on the hex and cut to it, a hair larger so no seam shows
      ctx.beginPath();
      hexPath(ctx, center, tileHeight / 2 + 0.5 * scale);
      ctx.clip();
      ctx.translate(center.x, center.y);
      ctx.rotate(((hex.art === "painted" ? hex.turns : 0) * Math.PI) / 3);
      ctx.drawImage(image, -tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight);
    } else if (hex.art === "drawn" && image) {
      // Already cut to the hex, with its hex line
      ctx.drawImage(image, center.x - tileWidth / 2, center.y - tileHeight / 2, tileWidth, tileHeight);
    } else if (hex.art === "bridgePiece") {
      // Square across the river, its shadow cast down and right: the board's light is from the top left
      const k = grid.hexWidth / PIECE_HEX_WIDTH;
      const [pieceWidth, pieceHeight] = [bridge.naturalWidth * k * BRIDGE_WIDTH, bridge.naturalHeight * k];
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 6 * scale;
      ctx.shadowOffsetX = 4 * scale;
      ctx.shadowOffsetY = 5 * scale;
      ctx.translate(center.x, center.y);
      ctx.rotate((bridgeAngle(hex.edges) * Math.PI) / 180);
      ctx.drawImage(bridge, -pieceWidth / 2, -pieceHeight / 2, pieceWidth, pieceHeight);
    }
    ctx.restore();
  });

  // The hex lines softened, as the script does for the painted art, then what spills out of the
  // hexes on top; neither on the editor's plain art
  if (!plain) {
    const pixels = ctx.getImageData(0, 0, grid.width, grid.height);
    const image = { data: pixels.data, width: grid.width, height: grid.height, channels: 4 };
    softenHexLines(image, keys, grid.center, grid.radius, LINE_BAND * scale);
    ctx.putImageData(pixels, 0, 0);
    plan.forEach((hex, i) => {
      const spill = spills[i];
      if (!spill) return;
      const { x, y } = grid.center(hex.key);
      const [w, h] = [OVERFLOW * tileWidth, OVERFLOW * tileHeight];
      ctx.drawImage(spill, x - w / 2, y - h / 2, w, h);
    });
  }

  // The frame round the grid put back over anything that stuck out
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, grid.width, grid.height);
  boardKeys(size.cols, size.rows).forEach((key) => hexPath(ctx, grid.center(key), grid.radius));
  ctx.clip("evenodd");
  ctx.drawImage(frame, 0, 0, grid.width, grid.height);
  ctx.restore();
  if (!standard) paintSectionLines(ctx, grid, size.cols, scale);
}

/**
 * A map's board art as an image URL for Scenario.image. It's a blob: URL; revoke it
 * (URL.revokeObjectURL) once the image is no longer shown.
 */
export async function drawBoardArt(tiles: Tiles, size: BoardSize = STANDARD_BOARD, options: DrawOptions = {}): Promise<string> {
  const canvas = document.createElement("canvas");
  await paintBoard(canvas, tiles, size, options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Couldn't draw the board");
  return URL.createObjectURL(blob);
}

// The editor's terrain tools show a hex of their terrain, cut from a board drawn with only that
// hex, plain like the editor's board
const SWATCH_HEX = "4-6";
const swatches = new Map<string, Promise<string>>();

/** A picture of one hex of a terrain on the board (a data: URL), for the map editor's tools */
export const terrainSwatch = (type: HexType): Promise<string> =>
  cached(swatches, type, async () => {
    const board = document.createElement("canvas");
    const [row = 0, col = 0] = SWATCH_HEX.split("-").map(Number);
    await paintBoard(board, type === HexType.PLAINS ? {} : { [type]: [{ row, col }] }, STANDARD_BOARD, { plain: true });
    const grid = artGrid(APP_ART_HEIGHT);
    const { x, y } = grid.center(SWATCH_HEX);
    const [width, height] = [Math.ceil(grid.hexWidth), Math.ceil(2 * grid.radius)];
    const swatch = document.createElement("canvas");
    swatch.width = width;
    swatch.height = height;
    const ctx = swatch.getContext("2d");
    if (!ctx) throw new Error("No canvas to draw the terrain on");
    ctx.beginPath();
    hexPath(ctx, { x: width / 2, y: height / 2 }, grid.radius);
    ctx.clip();
    ctx.drawImage(board, x - width / 2, y - height / 2, width, height, 0, 0, width, height);
    return swatch.toDataURL("image/png");
  });
