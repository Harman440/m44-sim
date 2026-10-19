// boardArt/boardPlan.mjs
// Which art goes on each hex of a board, decided the same way wherever a board is made: by
// `npm run board` (scripts/compose-board.mjs paints the catalog's art with sharp) and in the app
// (drawBoard.ts draws a map that has no painted art on a canvas). A painted hex gets a tile from
// the library (scripts/board-art/tiles/<terrain>/) picked by the hex and turned 60° a number of
// times; a drawn one is made in code (terrainTiles.mjs). Plain JavaScript, typed with JSDoc, so the
// Node scripts import it as it is.
import { TILES } from "./terrainTiles.mjs";

/** The standard board: 13 hexes across and 9 rows, odd rows one hex shorter and shifted right */
export const COLS = 13;
export const ROWS = 9;

/**
 * Every hex of a board as "row-col" (a bigger map's, grown in the map editor, with its size)
 * @param {number} [cols]
 * @param {number} [rows]
 */
export const boardKeys = (cols = COLS, rows = ROWS) =>
  [...Array(rows)].flatMap((_, row) => [...Array(cols - (row % 2))].map((_, col) => `${row}-${col}`));

/** Every hex of the standard board as "row-col" */
export const BOARD_KEYS = boardKeys();

/** The painted art's height in pixels (the empty board's, cropped to its grid) */
export const ART_HEIGHT = 1514;
/** The height the app draws a board at: the library's tiles are about this size on it */
export const APP_ART_HEIGHT = 1008;

/** The bridge piece (board-art/pieces/bridge.webp) was cut out on a hex box from a board whose hexes are this wide */
export const PIECE_HEX_WIDTH = 173.35;

/**
 * Terrain a board can ask to draw in code instead of painting it, and the terrain each choice takes along
 * @type {Record<string, string[] | undefined>}
 */
export const DRAWABLE = { river: ["river", "bridge"], hedgerow: ["hedgerow"] };
/** Painted terrain that blends into the same terrain next to it (joinedTiles.mjs); a town always re-lays its houses */
export const JOINED_TERRAIN = ["forest", "town", "hedgerow"];
/** Terrain that's always drawn in code */
export const ALWAYS_DRAWN = ["lake"];

/**
 * @typedef {{ row: number, col: number }} Position
 * @typedef {Partial<Record<string, Position[]>>} Terrain the scenario's tiles: hexes by terrain
 * @typedef {Record<string, string[]>} TileLibrary the painted tiles' file names by terrain folder, sorted
 */

/** @param {string} key */
const parseKey = (key) => {
  const [row = 0, col = 0] = key.split("-").map(Number);
  return { row, col };
};

/** A board's height in hex radii: 14 for the standard board's 9 rows @param {number} rows */
const radiiHigh = (rows) => rows * 1.5 + 0.5;

/**
 * The art's grid at a height: 14 hex radii high, as wide as 13 hexes on the standard board (a
 * bigger board's as wide as its columns and as high as its rows). It's the box the app lays a
 * board's image in (components/boardGeometry.ts).
 * @param {number} height
 * @param {number} [cols]
 * @param {number} [rows]
 */
export function artGrid(height, cols = COLS, rows = ROWS) {
  const width = Math.round((height * cols * Math.sqrt(3)) / radiiHigh(rows));
  const hexWidth = width / cols;
  const radius = height / radiiHigh(rows);
  /** @param {string} key */
  const center = (key) => {
    const { row, col } = parseKey(key);
    return { x: hexWidth / 2 + col * hexWidth + (row % 2) * (hexWidth / 2), y: radius + row * 1.5 * radius };
  };
  return { width, height, hexWidth, radius, center };
}

/**
 * The height a board of `rows` rows is drawn at for its hexes to be the size they are on the
 * standard board drawn `standardHeight` high
 * @param {number} rows
 * @param {number} standardHeight
 */
export const artHeightFor = (rows, standardHeight) => Math.round((standardHeight * radiiHigh(rows)) / radiiHigh(ROWS));

/**
 * A number from 0 to n − 1 picked by the hex and a salt, so a rebuild gives the same map
 * @param {string} key
 * @param {number} salt
 * @param {number} n
 */
export const pickFor = (key, salt, n) => {
  const { row, col } = parseKey(key);
  let h = Math.imul(row + 1, 73856093) ^ Math.imul(col + 1, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) % n;
};

/**
 * The hex across edge `d` (0 = east, then clockwise)
 * @param {string} key
 * @param {number} d
 */
export const neighbor = (key, d) => {
  const { row, col } = parseKey(key);
  const shift = row % 2;
  const [dr, dc] = /** @type {[number, number]} */ ([[0, 1], [1, shift], [1, shift - 1], [0, -1], [-1, shift - 1], [-1, shift]][d]);
  return `${row + dr}-${col + dc}`;
};

/**
 * The angle, in degrees clockwise, of the bridge laid square across a river from edge a to edge b.
 * In the bridge piece's image its deck runs north to south, across a river running west to east
 * @param {number[]} edges
 */
export const bridgeAngle = ([a = 0, b = 3]) => {
  const mid = (/** @type {number} */ d) => ({ x: Math.cos((d * Math.PI) / 3), y: Math.sin((d * Math.PI) / 3) });
  const [ma, mb] = [mid(a), mid(b)];
  return (Math.atan2(mb.y - ma.y, mb.x - ma.x) * 180) / Math.PI;
};

/**
 * The tiles picked for hexes, by "row-col", as planBoard takes them
 * @param {{ row: number, col: number, tile: string }[] | undefined} pickedTiles
 * @returns {Record<string, string>}
 */
export const pickedByHex = (pickedTiles) => Object.fromEntries((pickedTiles ?? []).map(({ row, col, tile }) => [`${row}-${col}`, tile]));

/** @param {string} type */
const isRiver = (type) => type === "river" || type === "bridge";

/**
 * A painted tile: `tile` is "<terrain folder>/<file>" in the library (river and bridge hexes take a
 * river tile), turned `turns` × 60° clockwise
 * @typedef {{ key: string, type: string, art: "painted", tile: string, turns: number }} PaintedHex
 */
/**
 * Drawn in code (terrainTiles.mjs): `edges`, the two edges a river runs through; `open`, the edges
 * a lake runs out through
 * @typedef {{ key: string, type: string, art: "drawn", seed: number, edges: number[], open: boolean[] }} DrawnHex
 */
/**
 * A hill joined into a ridge with the hills across its `open` edges (scripts/joined-hills.mjs, only
 * in `npm run board`)
 * @typedef {{ key: string, type: string, art: "ridge", tile: string, open: boolean[], seed: number }} RidgeHex
 */
/**
 * A painted tile blended into the same terrain across its `open` edges, turned `turns` × 60°
 * clockwise (joinedTiles.mjs): forests grow trees across them, and a town lays its houses out
 * again, joined or not
 * @typedef {{ key: string, type: string, art: "joined", tile: string, turns: number, open: boolean[], seed: number }} JoinedHex
 */
/**
 * The bridge piece laid across a painted river, from edge to edge
 * @typedef {{ key: string, type: string, art: "bridgePiece", edges: number[] }} BridgePiece
 */
/** @typedef {PaintedHex | DrawnHex | RidgeHex | JoinedHex | BridgePiece} HexArt */

/**
 * The hexes of each terrain by hex, the last one listed winning; plains need no art
 * @param {Terrain} tiles
 */
const terrainByHex = (tiles) => {
  /** @type {Map<string, string>} */
  const wanted = new Map();
  for (const [type, positions] of Object.entries(tiles)) {
    if (type === "plains") continue;
    for (const { row, col } of positions ?? []) wanted.set(`${row}-${col}`, type);
  }
  return wanted;
};

/**
 * Where rivers run: through the edges each river hex shares with the next river or bridge hexes.
 * At the end of a river it carries straight on; on a hex joining more than two, `strict` throws
 * (`npm run board`) and otherwise the first two are taken (a map half made in the editor)
 * @param {Map<string, string>} wanted
 * @param {boolean} strict
 */
const riverEdgesIn = (wanted, strict) => (/** @type {string} */ key) => {
  const edges = [...Array(6).keys()].filter((d) => isRiver(wanted.get(neighbor(key, d)) ?? ""));
  if (edges.length > 2 && strict) throw new Error(`River at ${key} joins more than two river hexes`);
  const [first, second] = edges;
  if (first === undefined) return [0, 3];
  return [first, second ?? (first + 3) % 6];
};

/**
 * The painted river tiles that join two edges, each with its turn. A river tile's file name
 * starts with the edges its river joins (0 = east, clockwise: 3-0.webp runs west to east)
 * @param {TileLibrary} library
 * @param {number[]} edges
 */
const riverTilesFor = (library, [a, b]) =>
  (library.river ?? []).flatMap((file) => {
    const [, p = 0, q = 0] = (file.match(/^(\d)-(\d)/) ?? []).map(Number);
    return [...Array(6).keys()]
      .filter((t) => [(p + t) % 6, (q + t) % 6].sort().join() === [a, b].sort().join())
      .map((turns) => ({ tile: `river/${file}`, turns }));
  });

/**
 * Whether every river on the map can be painted from the library: each river hex joins at most
 * two others, and a river tile turns to fit each bend. When not, the app draws the rivers
 * @param {Terrain} tiles
 * @param {TileLibrary} library
 */
export function canPaintRivers(tiles, library) {
  const wanted = terrainByHex(tiles);
  const riverEdges = riverEdgesIn(wanted, false);
  return [...wanted].every(([key, type]) => {
    if (!isRiver(type)) return true;
    const joins = [...Array(6).keys()].filter((d) => isRiver(wanted.get(neighbor(key, d)) ?? "")).length;
    return joins <= 2 && riverTilesFor(library, riverEdges(key)).length > 0;
  });
}

/**
 * The art for each terrain hex, in the order it's laid on the board.
 * `drawn`: terrain to draw in code (DRAWABLE's keys); `separateHills`: each hill on its own tile
 * instead of joined into ridges; `strict`: throw at a river that can't be painted or drawn as it is
 * (`npm run board`) instead of making do (the app); `picked`: the tile picked for a hex (in the map
 * editor, Scenario.pickedTiles), its file's name without ".webp" by "row-col", taken when its
 * terrain's folder has it
 * @param {Terrain} tiles
 * @param {TileLibrary} library
 * @param {{ drawn?: string[], separateHills?: boolean, strict?: boolean, picked?: Record<string, string> }} [options]
 * @returns {HexArt[]}
 */
export function planBoard(tiles, library, { drawn: drawnChoice = [], separateHills = false, strict = true, picked = {} } = {}) {
  const drawn = new Set([
    ...ALWAYS_DRAWN,
    ...drawnChoice.flatMap((choice) => {
      const types = DRAWABLE[choice];
      if (!types) throw new Error(`Can't draw ${choice}`);
      return types;
    }),
  ]);
  const wanted = terrainByHex(tiles);
  for (const type of new Set(wanted.values())) {
    if (!drawn.has(type) && !library[isRiver(type) ? "river" : type]?.length) throw new Error(`No art for ${type}`);
  }
  const riverEdges = riverEdgesIn(wanted, strict);
  /** @param {string} key @param {string[]} types */
  const edgesTo = (key, types) => [...Array(6).keys()].map((d) => types.includes(wanted.get(neighbor(key, d)) ?? ""));

  /** @type {HexArt[]} */
  const plan = [];
  for (const [key, type] of wanted) {
    const { row, col } = parseKey(key);
    const seed = row * 13 + col + 1;
    if (drawn.has(type)) {
      plan.push({ key, type, art: "drawn", seed, edges: isRiver(type) ? riverEdges(key) : [], open: type === "lake" ? edgesTo(key, ["lake"]) : [] });
    } else if (isRiver(type)) {
      const edges = riverEdges(key);
      const fits = riverTilesFor(library, edges);
      const fit = fits[pickFor(key, 3, fits.length)];
      if (!fit) {
        throw new Error(
          `No painted river tile joins edges ${edges[0]} and ${edges[1]} (at ${key}): add one to the library's river tiles, or draw this board's rivers`
        );
      }
      plan.push({ key, type, art: "painted", ...fit });
      if (type === "bridge") plan.push({ key, type, art: "bridgePiece", edges });
    } else {
      const choices = library[type] ?? [];
      const pick = `${picked[key]}.webp`;
      const tile = `${type}/${choices.includes(pick) ? pick : choices[pickFor(key, 1, choices.length)]}`;
      const ridge = type === "hill" && !separateHills ? edgesTo(key, ["hill"]) : [];
      const joins = JOINED_TERRAIN.includes(type) ? edgesTo(key, [type]) : [];
      if (ridge.some(Boolean)) plan.push({ key, type, art: "ridge", tile, open: ridge, seed });
      else if (type === "town" || joins.some(Boolean)) plan.push({ key, type, art: "joined", tile, turns: pickFor(key, 2, 6), open: joins, seed });
      else plan.push({ key, type, art: "painted", tile, turns: pickFor(key, 2, 6) });
    }
  }
  return plan;
}

/**
 * A drawn hex's SVG (a hex-shaped tile in a √3 : 2 box)
 * @param {DrawnHex} hex
 * @returns {string}
 */
export function drawnSvg({ type, seed, edges, open }) {
  if (type === "river" || type === "bridge") return TILES[type](edges[0], edges[1], seed);
  if (type === "lake") return TILES.lake(open, seed);
  if (type === "hedgerow") return TILES.hedgerow(seed);
  throw new Error(`Can't draw ${type}`);
}
