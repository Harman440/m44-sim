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
/** How wide the bridge piece is laid, of its own width: its deck runs north to south in the image, so this narrows the deck */
export const BRIDGE_WIDTH = 0.86;

/**
 * Terrain a board can ask to draw in code instead of painting it, and the terrain each choice takes along
 * @type {Record<string, string[] | undefined>}
 */
export const DRAWABLE = { river: ["river", "bridge"], hedgerow: ["hedgerow"] };
/** Painted terrain that blends into the same terrain next to it (joinedTiles.mjs) */
export const JOINED_TERRAIN = ["forest", "town"];
/**
 * Of those, terrain that's always made so: a forest's trees grow out over the countryside, a
 * town keeps its painted tile while its outside fades into the countryside
 */
const ALWAYS_JOINED = ["forest", "town"];
/** Terrain whose hexes end in countryside (joinedTiles.mjs's toCountryside) */
const COUNTRYSIDE_ENDS = ["town", "river", "bridge", "hedgerow"];
/** Terrain that's always drawn in code (a lake is drawn when the library's lake tiles don't fit it) */
export const ALWAYS_DRAWN = ["hedgerow"];
/**
 * Terrain whose trees stand here and there out on the hexes next to it, and the terrain they stand
 * on (plains: the open countryside): a lone tree or two by some of a forest's edges
 * @type {Record<string, string[]>}
 */
export const SPILLS = { forest: ["plains"] };

/**
 * @typedef {{ row: number, col: number }} Position
 * @typedef {Partial<Record<string, Position[]>>} Terrain the scenario's tiles: hexes by terrain
 * @typedef {Record<string, string[]>} TileLibrary the painted tiles' file names by terrain folder, sorted
 */

/**
 * A hex's row and column from its "row-col" key (a hex outside the board can be on row or column -1: "-1-4")
 * @param {string} key
 */
export const parseKey = (key) => {
  const [, row = "0", col = "0"] = key.match(/^(-?\d+)-(-?\d+)$/) ?? [];
  return { row: Number(row), col: Number(col) };
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
    return { x: hexWidth / 2 + col * hexWidth + (row & 1) * (hexWidth / 2), y: radius + row * 1.5 * radius };
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
  const shift = row & 1;
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

/** @param {string} type */
const isRiver = (type) => type === "river" || type === "bridge";

/**
 * A painted tile: `tile` is "<terrain folder>/<file>" in the library (river and bridge hexes take a
 * river tile), turned `turns` × 60° clockwise
 * @typedef {{ key: string, type: string, art: "painted", tile: string, turns: number }} PaintedHex
 */
/**
 * Drawn in code (terrainTiles.mjs): `edges`, the two edges a river runs through; `open`, the edges
 * a lake's edges to matching neighbors; `woods`, a river's edges facing a forest
 * `hills` and `hillTile`: a river's edges facing a hill, whose ridge (made from that tile) runs on
 * into it, short of the water; `hillShapes`: each one's edge, and its ridge's `open` and `seed`
 * @typedef {{ key: string, type: string, art: "drawn", seed: number, edges: number[], open: boolean[], woods: boolean[], hills?: boolean[], hillTile?: string, hillShapes?: HillShape[] }} DrawnHex
 * @typedef {{ edge: number, open: boolean[], toRiver: boolean[], seed: number }} HillShape
 */
/**
 * A hill made into a ridge, running on into the hills and rivers across its `open` edges (none for
 * a lone hill), its cliffs giving way to the countryside (joinedHills.mjs)
 * (`toRiver`: which of them lead into a river, where it bulges less far)
 * @typedef {{ key: string, type: string, art: "ridge", tile: string, open: boolean[], toRiver?: boolean[], cliffs?: boolean[], seed: number }} RidgeHex
 */
/**
 * A painted tile blended into the same terrain across its `open` edges, turned `turns` × 60°
 * clockwise (joinedTiles.mjs): forests grow trees across them and out over the countryside
 * across their `bare` edges; a town keeps its painted tile and lets countryside fade into its
 * outside edge; a painted river (or bridge) gives way to the countryside or a forest across its
 * `woods` edges; a beach fades out across its `fade` edges, into the land there
 * @typedef {{ key: string, type: string, art: "joined", tile: string, turns: number, open: boolean[], bare: boolean[], woods?: boolean[], hills?: boolean[], hillTile?: string, hillShapes?: HillShape[], fade?: boolean[], seed: number }} JoinedHex
 */
/**
 * The bridge piece laid across a painted river, from edge to edge
 * @typedef {{ key: string, type: string, art: "bridgePiece", edges: number[] }} BridgePiece
 */
/**
 * A lone tree or two of `type` standing on the hex at `key`, open countryside, by the edges it
 * shares with it (`toward`), cut from `tile` (joinedTiles.mjs's spillMaker); laid over every hex's
 * own art
 * @typedef {{ key: string, type: string, art: "spill", tile: string, toward: boolean[], seed: number }} SpillHex
 */
/** @typedef {PaintedHex | DrawnHex | RidgeHex | JoinedHex | BridgePiece | SpillHex} HexArt */

/**
 * The tiles picked for hexes, by "row-col", as planBoard takes them
 * @param {{ row: number, col: number, tile: string }[] | undefined} pickedTiles
 * @returns {Record<string, string>}
 */
export const pickedByHex = (pickedTiles) => Object.fromEntries((pickedTiles ?? []).map(({ row, col, tile }) => [`${row}-${col}`, tile]));

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
 * The edges a tile's file name starts with ("0-2-4.webp": 0, 2 and 4; none in "sand.webp"), and
 * the edges a river flows in through, after "-r" ("0-1-5-r3.webp": 3)
 * @param {string} file
 */
const edgesInName = (file) => {
  /** @param {string | undefined} list */
  const read = (list) => (list ? list.split("-").map(Number) : []);
  return { edges: read(file.match(/^(\d(?:-\d)*)/)?.[1]), river: read(file.match(/-r(\d(?:-\d)*)/)?.[1]) };
};
/** @param {number[]} a @param {number[]} b */
const sameEdges = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
/** @param {number[]} edges @param {number} turns */
const turned = (edges, turns) => edges.map((d) => (d + turns) % 6);

/**
 * The tiles of a library folder whose edges, turned, are just `edges` (and a river flows in
 * through just `river`), each with its turn. A river tile's file name starts with the edges its
 * river joins (0 = east, clockwise: 3-0.webp runs west to east, 0-2-4.webp forks, 3.webp ends in a
 * pond); a lake tile's, with the edges its water carries on through to the next lake hexes
 * @param {TileLibrary} library
 * @param {string} folder
 * @param {number[]} edges
 * @param {number[]} [river]
 */
const tilesJoining = (library, folder, edges, river = []) =>
  (library[folder] ?? []).flatMap((file) => {
    const named = edgesInName(file);
    if (!named.edges.length) return [];
    return [...Array(6).keys()]
      .filter((t) => sameEdges(turned(named.edges, t), edges) && sameEdges(turned(named.river, t), river))
      .map((turns) => ({ tile: `${folder}/${file}`, turns }));
  });

/**
 * The tiles of a library folder whose name starts with edges (after `prefix`: "surf-1-2.webp"),
 * each with the turns that face them best toward the edges `toward`: the most of its edges on
 * them, less those off them. None when no turn has more on than off
 * @param {TileLibrary} library
 * @param {string} folder
 * @param {number[]} toward
 * @param {string} [prefix]
 */
const tilesFacing = (library, folder, toward, prefix = "") => {
  /** @type {{ tile: string, turns: number }[]} */
  let best = [];
  let bestScore = 0;
  for (const file of library[folder] ?? []) {
    if (!file.startsWith(prefix)) continue;
    const { edges } = edgesInName(file.slice(prefix.length));
    if (!edges.length) continue;
    for (let t = 0; t < 6; t++) {
      const on = turned(edges, t);
      const score = on.filter((d) => toward.includes(d)).length - on.filter((d) => !toward.includes(d)).length;
      if (score > bestScore) [best, bestScore] = [[], score];
      if (score === bestScore && score > 0) best.push({ tile: `${folder}/${file}`, turns: t });
    }
  }
  return best;
};

/**
 * Where each river hex's river runs, and the painted tiles that fit it. A river runs through the
 * edges it shares with the next river or bridge hexes: a fork where it joins three (a tile for it
 * or not: the first two are taken otherwise), and, joining one, into a lake beside it (the lake hex
 * it bends least to), else a pond where it stops on the board, else straight on (at the board's
 * edge, off it); the first of these a river tile fits. A bridge doesn't fork or end in a pond. Two
 * branches of a fork that touch each other aren't joined: each runs from the fork. On a hex
 * joining more than three, or a fork with no tile for it, `strict` throws (`npm run board`).
 * `edges` is what the painted art does, `twoEdges` what a drawn river does (two edges, any bend),
 * `whole` whether every river beside it is joined
 * @param {Map<string, string>} wanted
 * @param {TileLibrary} library
 * @param {Set<string>} onBoard the board's hexes
 * @param {boolean} strict
 */
const riverPlanner = (wanted, library, onBoard, strict) => (/** @type {string} */ key) => {
  const type = wanted.get(key);
  /** The river hexes beside one @param {string} hex */
  const riversBy = (hex) => [...Array(6).keys()].filter((d) => isRiver(wanted.get(neighbor(hex, d)) ?? ""));
  /** Whether a hex is a fork: three rivers beside it @param {string} hex */
  const isFork = (hex) => isRiver(wanted.get(hex) ?? "") && riversBy(hex).length >= 3;
  const rivers = riversBy(key).filter((d) => {
    const other = neighbor(key, d);
    // Not a branch of a fork beside them both, when neither is the fork
    if (isFork(key) || isFork(other)) return true;
    return ![(d + 1) % 6, (d + 5) % 6].some((e) => isFork(neighbor(key, e)) && neighbor(key, e) !== other);
  });
  if (rivers.length > 3 && strict) throw new Error(`River at ${key} joins more than three river hexes`);
  const lakes = [...Array(6).keys()].filter((d) => wanted.get(neighbor(key, d)) === "lake");
  /** How far an edge turns from straight on from `from` @param {number} from @param {number} d */
  const bend = (from, d) => Math.min((d - from + 9) % 6, (from - d + 9) % 6);
  const [first, second] = rivers;

  // What the river could do, in order
  /** @type {number[][]} */
  const choices = [];
  if (rivers.length >= 3 && type === "river") choices.push(rivers.slice(0, 3));
  if (first !== undefined && second !== undefined) choices.push([first, second]);
  else if (first !== undefined) {
    for (const lake of [...lakes].sort((a, b) => bend(first, a) - bend(first, b))) choices.push([first, lake]);
    if (type === "river" && onBoard.has(neighbor(key, (first + 3) % 6))) choices.push([first]);
    choices.push([first, (first + 3) % 6]);
  } else {
    for (const lake of lakes) choices.push([lake, (lake + 3) % 6]);
    choices.push([0, 3]);
  }
  const twoEdges = /** @type {number[]} */ (choices.find((edges) => edges.length === 2));
  for (const edges of choices) {
    const fits = tilesJoining(library, "river", edges);
    if (fits.length) return { edges, fits, twoEdges, whole: rivers.length <= edges.length };
    if (strict && edges.length === 3) throw new Error(`No painted river tile forks to edges ${edges.join(", ")} (at ${key}): add one to the library's river tiles`);
  }
  return { edges: twoEdges, fits: [], twoEdges, whole: rivers.length <= 2 };
};

/**
 * Whether every river on the map can be painted from the library: a river tile turns to fit
 * each hex's river (a bend, a fork, a pond). When not, the app draws the rivers
 * @param {Terrain} tiles
 * @param {TileLibrary} library
 * @param {string[]} [keys] the board's hexes
 */
export function canPaintRivers(tiles, library, keys = BOARD_KEYS) {
  const wanted = terrainByHex(tiles);
  const river = riverPlanner(wanted, library, new Set(keys), false);
  return [...wanted].every(([key, type]) => {
    if (!isRiver(type)) return true;
    const { fits, whole } = river(key);
    return whole && fits.length > 0;
  });
}

/** Terrain that carries on into the outskirts beside it (a river only through the edge it flows out of) */
const OUTSKIRTS_TERRAIN = ["forest", "town", "hill", "hedgerow", "lake", "swamp", "beach", "ocean"];

/**
 * The hexes just outside a board whose part inside the art's box (the zigzag above the first row
 * and below the last, the half hexes at the ends of the short rows) shows on its image
 * @param {string[]} keys the board's hexes
 */
export function outskirtKeys(keys) {
  const onBoard = new Set(keys);
  const parsed = keys.map(parseKey);
  const rows = Math.max(...parsed.map((p) => p.row)) + 1;
  const cols = Math.max(...parsed.map((p) => p.col)) + 1;
  // In hexes of the art's grid (a hex 1 wide, √3 radii; rows 1.5 radii apart): the box is cols × (1.5 rows + 0.5) radii
  const [width, height] = [cols, (1.5 * rows + 0.5) / Math.sqrt(3)];
  const [halfWide, halfHigh] = [0.5, 1 / Math.sqrt(3)];
  /** @type {string[]} */
  const out = [];
  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const key = `${row}-${col}`;
      if (onBoard.has(key)) continue;
      const [x, y] = [0.5 + col + (row & 1) / 2, (1 + 1.5 * row) / Math.sqrt(3)];
      if (x + halfWide > 1e-6 && x - halfWide < width - 1e-6 && y + halfHigh > 1e-6 && y - halfHigh < height - 1e-6) out.push(key);
    }
  }
  return out;
}

/**
 * The board's terrain carried on into its outskirts (outskirtKeys), only for the art: each
 * outskirt hex takes the terrain of the board hexes beside it (the one most of them have, the
 * hex picking between equals), and a river runs on into the hex it flows out to. Plains stay plain
 * @param {Map<string, string>} wanted the board's terrain by hex
 * @param {string[]} keys the board's hexes
 * @param {(key: string) => number[]} riverEdges where a board river hex's river runs
 * @returns {Map<string, string>}
 */
const outskirtTerrain = (wanted, keys, riverEdges) => {
  const onBoard = new Set(keys);
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const key of outskirtKeys(keys)) {
    /** @type {Map<string, number>} */
    const count = new Map();
    for (let d = 0; d < 6; d++) {
      const other = neighbor(key, d);
      const type = onBoard.has(other) ? wanted.get(other) : undefined;
      if (type && OUTSKIRTS_TERRAIN.includes(type)) count.set(type, (count.get(type) ?? 0) + 1);
    }
    const most = Math.max(0, ...count.values());
    const best = [...count].filter(([, n]) => n === most).map(([type]) => type).sort();
    const type = best[pickFor(key, 50, best.length)];
    if (type) out.set(key, type);
  }
  for (const [key, type] of wanted) {
    if (!isRiver(type)) continue;
    for (const d of riverEdges(key)) {
      const other = neighbor(key, d);
      if (!onBoard.has(other) && outskirtKeys(keys).includes(other)) out.set(other, "river");
    }
  }
  return out;
};

/** Terrain a beach fades into at its edges: land that isn't beach (water and the board's edge keep the sand) @param {string} type */
const fadesInto = (type) => !isRiver(type) && type !== "lake" && type !== "beach" && type !== "ocean";
/** A beach tile with surf along the edges after "surf-" ("surf-1-2.webp"), turned to face the ocean */
const SURF = "surf-";

/**
 * The art for each terrain hex, in the order it's laid on the board.
 * `drawn`: terrain to draw in code (DRAWABLE's keys); `separateHills`: each hill on its own tile
 * instead of joined into ridges; `strict`: throw at a river that can't be painted or drawn as it is
 * (`npm run board`) instead of making do (the app); `keys`: the board's hexes (a bigger map's);
 * `plain`: each terrain hex its own tile as it is, nothing joined (the map editor's quick art,
 * while the map is being made); `picked`: the tile picked for a hex (in the map editor,
 * Scenario.pickedTiles), its file's name without ".webp" by "row-col", taken when its terrain's
 * folder has it; `outskirts`: the terrain carried on into the hexes just outside the board, as
 * far as the art's box shows them (outskirtTerrain), so a forest or a river doesn't stop dead at
 * the board's edge. They never spill back onto the board (no lone trees).
 * A lake is painted from the library's lake tiles when every hex of it has one that fits (the
 * edges its water carries on through, and any river flowing in), and drawn otherwise. A beach
 * fades into the land beside it, a beach tile whose name starts with edges (grass tufts on them)
 * turned to face it where one does, or one with surf turned to face the ocean beside it; a swamp
 * ends in the same ragged edge. An ocean hex next to land (anything but ocean, as far as the art
 * shows) takes the ocean tile whose shore best faces it ("4-5.webp": the land across edges 4 and
 * 5), else open sea, its waves turned level
 * @param {Terrain} tiles
 * @param {TileLibrary} library
 * @param {{ drawn?: string[], separateHills?: boolean, strict?: boolean, keys?: string[], plain?: boolean, picked?: Record<string, string>, outskirts?: boolean }} [options]
 * @returns {HexArt[]}
 */
export function planBoard(tiles, library, { drawn: drawnChoice = [], separateHills = false, strict = true, keys = BOARD_KEYS, plain = false, picked = {}, outskirts = false } = {}) {
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
    if (type !== "lake" && !drawn.has(type) && !library[isRiver(type) ? "river" : type]?.length) throw new Error(`No art for ${type}`);
  }
  const onBoard = new Set(keys);
  if (outskirts && !plain) {
    const board = riverPlanner(wanted, library, onBoard, strict);
    const extra = outskirtTerrain(wanted, keys, (key) => (drawn.has(wanted.get(key) ?? "") ? board(key).twoEdges : board(key).edges));
    for (const [key, type] of extra) wanted.set(key, type);
  }
  /** Whether a hex is in the outskirts, outside the board @param {string} key */
  const outside = (key) => !onBoard.has(key);
  /** The hexes the art shows: the board's, and its outskirts' */
  const shown = new Set([...keys, ...(outskirts && !plain ? outskirtKeys(keys) : [])]);
  const river = riverPlanner(wanted, library, onBoard, strict);
  /** Where a river hex's river runs, as it's drawn or painted @param {string} key */
  const riverEdges = (key) => (drawn.has(wanted.get(key) ?? "") ? river(key).twoEdges : river(key).edges);
  /** @param {string} key @param {string[]} types */
  const edgesTo = (key, types) => [...Array(6).keys()].map((d) => types.includes(wanted.get(neighbor(key, d)) ?? ""));
  /** The edges a lake hex's water carries on through, and those a river flows in through @param {string} key */
  const lakeEdges = (key) => {
    const all = [...Array(6).keys()];
    const lake = all.filter((d) => wanted.get(neighbor(key, d)) === "lake");
    const inflow = all.filter((d) => {
      const other = neighbor(key, d);
      return isRiver(wanted.get(other) ?? "") && riverEdges(other).includes((d + 3) % 6);
    });
    return { lake, inflow };
  };
  // Each lake, painted when every one of its hexes has a lake tile that fits
  /** @type {Map<string, { tile: string, turns: number } | null>} */
  const lakeArt = new Map();
  for (const [key, type] of wanted) {
    if (type !== "lake" || lakeArt.has(key)) continue;
    const lake = [key];
    for (let i = 0; i < lake.length; i++) {
      for (let d = 0; d < 6; d++) {
        const other = neighbor(/** @type {string} */ (lake[i]), d);
        if (wanted.get(other) === "lake" && !lake.includes(other)) lake.push(other);
      }
    }
    const fits = lake.map((hex) => {
      const { lake: open, inflow } = lakeEdges(hex);
      return tilesJoining(library, "lake", open, inflow);
    });
    const painted = fits.every((list) => list.length > 0);
    lake.forEach((hex, i) => {
      const list = fits[i] ?? [];
      lakeArt.set(hex, painted ? (list[pickFor(hex, 5, list.length)] ?? null) : null);
    });
  }
  /** A tile of a terrain's library: the one picked for the hex, or one by the hex @param {string} key @param {string} type */
  const tileFor = (key, type) => {
    const choices = library[type] ?? [];
    const pick = `${picked[key]}.webp`;
    return `${type}/${choices.includes(pick) ? pick : choices[pickFor(key, 1, choices.length)]}`;
  };

  // A river's edges facing a hill, whose ridge runs on into it up to the water, and the hill tile
  const hillTile = `hill/${(library.hill ?? [])[0]}`;
  /** @param {string} key */
  const hillsBeside = (key) => {
    const hills = separateHills ? [] : edgesTo(key, ["hill"]);
    if (!hills.some(Boolean)) return {};
    // Each hill's own ridge, as its hex makes it, to draw on in the river from where it is
    const hillShapes = [...Array(6).keys()]
      .filter((d) => hills[d])
      .map((d) => {
        const next = neighbor(key, d);
        const { row, col } = parseKey(next);
        return { edge: d, open: edgesTo(next, ["hill", "river", "bridge"]), toRiver: edgesTo(next, ["river", "bridge"]), seed: row * 13 + col + 1 };
      });
    return { hills, hillTile, hillShapes };
  };
  /** @type {HexArt[]} */
  const plan = [];
  for (const [key, type] of wanted) {
    const { row, col } = parseKey(key);
    const seed = row * 13 + col + 1;
    const lake = type === "lake" ? lakeArt.get(key) : null;
    if (lake) {
      plan.push({ key, type, art: "painted", ...lake });
    } else if (type === "lake") {
      // Drawn: running out to the lakes beside it, and to a river flowing in
      const { lake: open, inflow } = lakeEdges(key);
      const edges = [...Array(6).keys()].map((d) => open.includes(d) || inflow.includes(d));
      plan.push({ key, type, art: "drawn", seed, edges: [], open: edges, woods: [] });
    } else if (drawn.has(type)) {
      // Only hedge edges join across hexes; the fields stay inside their own hex.
      const joins = type === "hedgerow" && !plain;
      // A river's edges facing a forest, which grows into it up to the water
      const woods = isRiver(type) && !plain ? edgesTo(key, ["forest"]) : [];
      const hills = isRiver(type) && !plain ? hillsBeside(key) : {};
      plan.push({ key, type, art: "drawn", seed, edges: isRiver(type) ? riverEdges(key) : [], open: joins ? edgesTo(key, [type]) : [], woods, ...hills });
    } else if (isRiver(type)) {
      const { edges, fits } = river(key);
      const fit = fits[pickFor(key, 3, fits.length)];
      if (!fit) {
        throw new Error(
          `No painted river tile joins edges ${edges.join(" and ")} (at ${key}): add one to the library's river tiles, or draw this board's rivers`
        );
      }
      // Its tile's grass giving way to the countryside round it (joinedTiles.mjs), unless plain
      if (plain) plan.push({ key, type, art: "painted", ...fit });
      else plan.push({ key, type, art: "joined", ...fit, open: edgesTo(key, ["river", "bridge"]), bare: edgesTo(key, []).map(() => false), woods: edgesTo(key, ["forest"]), ...hillsBeside(key), seed });
      if (type === "bridge") plan.push({ key, type, art: "bridgePiece", edges });
    } else if (type === "beach") {
      const fade = [...Array(6).keys()].map((d) => {
        const other = neighbor(key, d);
        return onBoard.has(other) && fadesInto(wanted.get(other) ?? "plains");
      });
      const fading = fade.flatMap((on, d) => (on ? [d] : []));
      const files = library.beach ?? [];
      // The tile with surf that best faces the ocean, else the one with grass tufts that best
      // faces the land, or plain sand
      const sea = [...Array(6).keys()].filter((d) => wanted.get(neighbor(key, d)) === "ocean");
      const surf = sea.length ? tilesFacing(library, "beach", sea, SURF) : [];
      const best = surf.length ? surf : tilesFacing(library, "beach", fading);
      const sand = files.filter((file) => !edgesInName(file).edges.length && !file.startsWith(SURF));
      const pick = `${picked[key]}.webp`;
      const art = files.includes(pick)
        ? { tile: `beach/${pick}`, turns: pickFor(key, 2, 6) }
        : (best[pickFor(key, 4, best.length)] ?? { tile: `beach/${sand[pickFor(key, 1, sand.length)] ?? files[0]}`, turns: pickFor(key, 2, 6) });
      if (plain) plan.push({ key, type, art: "painted", ...art });
      else plan.push({ key, type, art: "joined", ...art, open: edgesTo(key, ["beach"]), bare: fade.map(() => false), fade, seed });
    } else if (type === "ocean") {
      const land = [...Array(6).keys()].filter((d) => {
        const other = neighbor(key, d);
        return shown.has(other) && wanted.get(other) !== "ocean";
      });
      const shore = plain ? [] : tilesFacing(library, "ocean", land);
      const sea = (library.ocean ?? []).filter((file) => !edgesInName(file).edges.length);
      const art = shore[pickFor(key, 4, shore.length)] ?? { tile: `ocean/${sea[pickFor(key, 1, sea.length)] ?? library.ocean?.[0]}`, turns: 3 * pickFor(key, 2, 2) };
      plan.push({ key, type, art: "painted", ...art });
    } else if (type === "swamp" && !plain) {
      // A swamp ends in a ragged edge into the land beside it, as a beach does, and runs on into
      // the swamp beside it
      const fade = [...Array(6).keys()].map((d) => {
        const other = neighbor(key, d);
        return onBoard.has(other) && (wanted.get(other) ?? "plains") !== "swamp";
      });
      plan.push({ key, type, art: "joined", tile: tileFor(key, type), turns: pickFor(key, 2, 6), open: edgesTo(key, ["swamp"]), bare: fade.map(() => false), fade, seed });
    } else {
      const tile = tileFor(key, type);
      // A hill is a ridge (its cliffs giving way to the countryside), running on into the hills and
      // the rivers beside it; a lone one too, its outline running out through no edge
      const ridge = type === "hill" && !separateHills && !plain ? edgesTo(key, ["hill", "river", "bridge"]) : [];
      const cliffs = type === "hill" && !plain ? edgesTo(key, ["beach", "ocean"]) : [];
      const joins = JOINED_TERRAIN.includes(type) && !plain ? edgesTo(key, [type]) : [];
      if (type === "town" && !plain) plan.push({ key, type, art: "joined", tile, turns: pickFor(key, 2, 6), open: [], bare: [], seed });
      else if (type === "hill" && !plain && (!separateHills || cliffs.some(Boolean)))
        plan.push({ key, type, art: "ridge", tile, open: ridge, toRiver: edgesTo(key, ["river", "bridge"]), ...(cliffs.some(Boolean) ? { cliffs } : {}), seed });
      else if ((ALWAYS_JOINED.includes(type) && !plain) || joins.some(Boolean)) {
        // Open countryside across an edge, on the board (towns and rivers end in countryside too,
        // so a forest's trees grow out over them)
        // (an outskirt hex has none: nothing of it reaches back onto the board)
        const across = (/** @type {number} */ d) => (!outside(key) && onBoard.has(neighbor(key, d)) ? (wanted.get(neighbor(key, d)) ?? "plains") : null);
        // (a forest's ground patches spill onto a river's bank too)
        const bare = [...Array(6).keys()].map((d) => ["plains", ...COUNTRYSIDE_ENDS].includes(across(d) ?? ""));
        plan.push({ key, type, art: "joined", tile, turns: pickFor(key, 2, 6), open: joins, bare, seed });
      }
      else plan.push({ key, type, art: "painted", tile, turns: pickFor(key, 2, 6) });
    }
  }
  if (plain) return plan;

  // A lone tree or two standing out on the countryside by some of a forest's edges, laid over
  // everything else
  /** @type {Map<string, SpillHex>} */
  const spills = new Map();
  for (const hex of [...plan]) {
    const onto = SPILLS[hex.type];
    if (!onto || !("tile" in hex) || outside(hex.key)) continue;
    for (let d = 0; d < 6; d++) {
      const other = neighbor(hex.key, d);
      if (!onBoard.has(other) || !onto.includes(wanted.get(other) ?? "plains")) continue;
      // By about one edge in three
      if (pickFor(hex.key, 40 + d, 3) !== 0) continue;
      const { row, col } = parseKey(other);
      const id = `${hex.type}:${other}`;
      const spill = spills.get(id) ?? { key: other, type: hex.type, art: "spill", tile: hex.tile, toward: [false, false, false, false, false, false], seed: row * 13 + col + 1 };
      spill.toward[(d + 3) % 6] = true;
      spills.set(id, spill);
    }
  }
  return [...plan, ...spills.values()];
}

/**
 * A drawn hex's SVG (a hex-shaped tile in a √3 : 2 box)
 * @param {DrawnHex} hex
 * @returns {string}
 */
export function drawnSvg({ type, seed, edges, open }) {
  if (type === "river" || type === "bridge") return TILES[type](edges[0], edges[1], seed);
  if (type === "lake") return TILES.lake(open, seed);
  throw new Error(`Can't draw ${type}`);
}
