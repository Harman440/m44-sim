// boardArt/drawBoard.ts
// A board's art drawn in the browser, for a map that has no painted art (one made in the map
// editor): the empty board, the art boardPlan.mjs plans for each terrain hex, as `npm run board`
// does for the catalog's art (hills next to each other joined into ridges, joinedHills.mjs), but
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
  BOARD_KEYS,
  PIECE_HEX_WIDTH,
  artGrid,
  bridgeAngle,
  canPaintRivers,
  drawnSvg,
  planBoard,
} from "./boardPlan.mjs";
import type { DrawnHex, HexArt, RidgeHex } from "./boardPlan.mjs";
import { blurPixels, joinedHillMaker, plateauCrop } from "./joinedHills.mjs";
import type { Pixels, RidgeMaker } from "./joinedHills.mjs";
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

/** The art the app plans for a map's terrain */
export const planMapArt = (tiles: Tiles): HexArt[] =>
  planBoard(tiles, TILE_LIBRARY, {
    drawn: canPaintRivers(tiles, TILE_LIBRARY) ? [] : ["river"],
    strict: false,
  });

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

// Drawn hexes rendered once at a size and kept as bitmaps: the browser would render an SVG
// image again every time it's pasted
const drawnTiles = new Map<string, Promise<HTMLCanvasElement>>();
const drawnTile = (hex: DrawnHex, width: number, height: number) =>
  cached(drawnTiles, `${hex.type}:${hex.seed}:${hex.edges.join()}:${hex.open.map(Number).join("")}@${width}x${height}`, async () => {
    const svg = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(drawnSvg(hex))}`);
    const tile = document.createElement("canvas");
    tile.width = width;
    tile.height = height;
    tile.getContext("2d")?.drawImage(svg, 0, 0, width, height);
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

/** The image a hex is drawn with: its painted tile, its ridge or its drawn tile, at the board's size */
const hexImage = (hex: HexArt, grid: ReturnType<typeof artGrid>): Promise<CanvasImageSource> | null => {
  if (hex.art === "painted") return loadImage(TILE_URLS.get(hex.tile) ?? hex.tile);
  if (hex.art === "ridge") return ridgeTile(hex, grid);
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

/** Draw a map's board art on a canvas, `height` pixels high */
export async function paintBoard(canvas: HTMLCanvasElement, tiles: Tiles, height = APP_ART_HEIGHT): Promise<void> {
  const grid = artGrid(height);
  const plan = planMapArt(tiles);
  const tileWidth = grid.hexWidth;
  const tileHeight = 2 * grid.radius;
  // Everything loaded first, so the board is drawn in one go
  const [base, bridge, art] = await Promise.all([
    loadImage(emptyBoardUrl),
    loadImage(bridgeUrl),
    Promise.all(plan.map((hex) => hexImage(hex, grid))),
  ]);

  canvas.width = grid.width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas to draw the board on");
  // Sizes in the painted art's pixels, scaled to this board
  const scale = height / ART_HEIGHT;

  ctx.drawImage(base, 0, 0, grid.width, height);
  plan.forEach((hex, i) => {
    const center = grid.center(hex.key);
    const image = art[i];
    ctx.save();
    if ((hex.art === "painted" || hex.art === "ridge") && image) {
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
      const [pieceWidth, pieceHeight] = [bridge.naturalWidth * k, bridge.naturalHeight * k];
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

  // The frame round the grid put back over anything that stuck out
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, grid.width, height);
  BOARD_KEYS.forEach((key) => hexPath(ctx, grid.center(key), grid.radius));
  ctx.clip("evenodd");
  ctx.drawImage(base, 0, 0, grid.width, height);
  ctx.restore();
}

/**
 * A map's board art as an image URL for Scenario.image. It's a blob: URL; revoke it
 * (URL.revokeObjectURL) once the image is no longer shown.
 */
export async function drawBoardArt(tiles: Tiles, height = APP_ART_HEIGHT): Promise<string> {
  const canvas = document.createElement("canvas");
  await paintBoard(canvas, tiles, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Couldn't draw the board");
  return URL.createObjectURL(blob);
}

// The editor's terrain tools show a hex of their terrain, cut from a board drawn with only that hex
const SWATCH_HEX = "4-6";
const swatches = new Map<string, Promise<string>>();

/** A picture of one hex of a terrain on the board (a data: URL), for the map editor's tools */
export const terrainSwatch = (type: HexType): Promise<string> =>
  cached(swatches, type, async () => {
    const board = document.createElement("canvas");
    const [row = 0, col = 0] = SWATCH_HEX.split("-").map(Number);
    await paintBoard(board, type === HexType.PLAINS ? {} : { [type]: [{ row, col }] });
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
