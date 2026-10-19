// boardArt/softLines.mjs
// The board's edges made soft, on the whole board, in two passes:
// - fillFrame: the empty board's dark frame round the grid (the notches at the ends of the rows,
//   the zigzag at the top and bottom) filled with the countryside of the hexes beside it, mirrored
//   out across their edge, so a scenario's map ends in countryside;
// - softenHexLines: the hex lines (the empty board's printed ones and the tiles' rims) blended
//   with the board mirrored in from just inside the hex, so a line keeps only a part of its
//   strength and what's beside it carries on across.
// Pixel work in plain JavaScript, done the same way by `npm run board` (scripts/compose-board.mjs)
// and the app (drawBoard.ts).

/** @typedef {import("./joinedHills.mjs").Pixels} Pixels */
/** @typedef {Pixels & { data: Uint8Array | Uint8ClampedArray }} Image */

const SQRT3 = Math.sqrt(3);
// The six edges' outward directions (0 = east, clockwise)
const NX = [0, 1, 2, 3, 4, 5].map((d) => Math.cos((d * Math.PI) / 3));
const NY = [0, 1, 2, 3, 4, 5].map((d) => Math.sin((d * Math.PI) / 3));

/** How wide the softened band is on each side of a line, in the painted art's pixels (its lines are about 4 wide) */
export const LINE_BAND = 4;
/** How much of a line is left */
export const LINE_KEEP = 0.3;

/**
 * Soften the hex lines of a board's pixels, in place. `center(key)` and `radius` are the art's
 * grid (boardPlan's artGrid); `band`: how far each side of a line is softened, in pixels
 * @param {Image} image
 * @param {string[]} keys every hex of the board
 * @param {(key: string) => { x: number, y: number }} center
 * @param {number} radius
 * @param {number} band
 * @param {number} [keep]
 */
export function softenHexLines({ data, width, height, channels }, keys, center, radius, band, keep = LINE_KEEP) {
  const source = Uint8Array.from(data);
  const inner = (SQRT3 / 2) * radius;
  for (const key of keys) {
    const { x: cx, y: cy } = center(key);
    forEdgeBand(cx, cy, inner, radius, width, height, band, (x, y, near, edge) => {
      const [nx, ny] = [/** @type {number} */ (NX[edge]), /** @type {number} */ (NY[edge])];
      const push = 2 * (band - near);
      const sx = Math.min(width - 1, Math.max(0, Math.round(x - push * nx)));
      const sy = Math.min(height - 1, Math.max(0, Math.round(y - push * ny)));
      // The line itself kept at `keep`, fading to the board as it is at the band's edge
      const w = (1 - keep) * Math.min(1, (band - near) / (band / 2));
      const [o, s] = [channels * (y * width + x), channels * (sy * width + sx)];
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(/** @type {number} */ (source[o + c]) * (1 - w) + /** @type {number} */ (source[s + c]) * w);
    });
  }
}

/**
 * Fill everything round the grid (the frame of the empty board) with the hexes beside it, each
 * pixel mirrored in across the edge of the hex it's nearest, in place
 * @param {Image} image
 * @param {string[]} keys
 * @param {(key: string) => { x: number, y: number }} center
 * @param {number} radius
 */
export function fillFrame({ data, width, height, channels }, keys, center, radius) {
  const key = `${width}x${height}:${radius}:${keys.length}:${keys.at(-1)}`;
  let pairs = frameMaps.get(key);
  if (!pairs) {
    pairs = frameMap(width, height, keys, center, radius);
    frameMaps.set(key, pairs);
  }
  const source = Uint8Array.from(data);
  for (let i = 0; i < pairs.length; i += 2) {
    const o = channels * /** @type {number} */ (pairs[i]), q = channels * /** @type {number} */ (pairs[i + 1]);
    for (let c = 0; c < 3; c++) data[o + c] = /** @type {number} */ (source[q + c]);
  }
}

// Which pixel each pixel of the frame is filled from, by board: the same every time a board of a
// size is drawn, so the map editor works it out once
/** @type {Map<string, Int32Array>} */
const frameMaps = new Map();

/**
 * The frame's pixels and the pixel inside the board each is filled from, in pairs
 * @param {number} width @param {number} height
 * @param {string[]} keys
 * @param {(key: string) => { x: number, y: number }} center
 * @param {number} radius
 */
function frameMap(width, height, keys, center, radius) {
  /** @type {number[]} */
  const pairs = [];
  const inner = (SQRT3 / 2) * radius;
  // The hexes' centres by row and column, to find the nine round a pixel
  /** @type {({ x: number, y: number } | undefined)[][]} */
  const grid = [];
  for (const key of keys) {
    const [row = 0, col = 0] = key.split("-").map(Number);
    (grid[row] ??= [])[col] = center(key);
  }
  /** @param {{ x: number, y: number }} c @param {number} x @param {number} y how far out of hex c a point is, 1 on its edge */
  const reach = (c, x, y) => {
    const dx = x - c.x, dy = y - c.y;
    let m = 0;
    for (let d = 0; d < 6; d++) {
      const t = dx * /** @type {number} */ (NX[d]) + dy * /** @type {number} */ (NY[d]);
      if (t > m) m = t;
    }
    return m / inner;
  };
  for (let y = 0; y < height; y++) {
    const row = Math.round((y - radius) / (1.5 * radius));
    // The frame is only round the edge: the zigzag above the first row and below the last, and
    // the notches at the ends of the short rows
    const across = y < radius || y >= height - radius;
    for (let x = 0; x < width; x++) {
      if (!across && x >= 2 * inner && x < width - 2 * inner) x = Math.floor(width - 2 * inner);
      const px = x + 0.5, py = y + 0.5;
      // The nine hexes round it: the one it's least far out of
      let best = Infinity;
      /** @type {{ x: number, y: number } | undefined} */
      let hex;
      for (let r = Math.max(0, row - 1); r <= row + 1; r++) {
        const line = grid[r];
        if (!line) continue;
        const col = Math.round((px - inner - (r % 2) * inner) / (2 * inner));
        for (let c = Math.max(0, col - 1); c <= col + 1; c++) {
          const h = line[c];
          if (!h) continue;
          const out = reach(h, px, py);
          if (out < best) {
            best = out;
            hex = h;
          }
        }
      }
      if (!hex || best <= 1) continue;
      // Mirrored in across the edges it's beyond, until it's inside
      let qx = px, qy = py;
      for (let i = 0; i < 3; i++) {
        let out = 0, edge = 0;
        for (let d = 0; d < 6; d++) {
          const t = (qx - hex.x) * /** @type {number} */ (NX[d]) + (qy - hex.y) * /** @type {number} */ (NY[d]) - inner;
          if (t > out) {
            out = t;
            edge = d;
          }
        }
        if (out <= 0) break;
        // A pixel more, past the hex line printed on the edge
        const push = 2 * out + 0.06 * radius;
        qx -= push * /** @type {number} */ (NX[edge]);
        qy -= push * /** @type {number} */ (NY[edge]);
      }
      const sx = Math.min(width - 1, Math.max(0, Math.floor(qx)));
      const sy = Math.min(height - 1, Math.max(0, Math.floor(qy)));
      pairs.push(y * width + x, sy * width + sx);
    }
  }
  return Int32Array.from(pairs);
}

/**
 * Calls `fn(x, y, near, edge)` for each pixel of a hex within `band` pixels of its edges: `near`
 * how far in from its nearest edge, `edge` which (0 = east, clockwise). Only the ends of each
 * row are visited
 * @param {number} cx @param {number} cy the hex's centre
 * @param {number} inner @param {number} radius
 * @param {number} width @param {number} height the board's
 * @param {number} band
 * @param {(x: number, y: number, near: number, edge: number) => void} fn
 */
function forEdgeBand(cx, cy, inner, radius, width, height, band, fn) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y++) {
    // The row's half-width inside the hex, and how far in from each end the band reaches (a
    // slanted edge comes in half as fast across)
    const hy = y + 0.5 - cy;
    const half = Math.min(inner, 2 * (inner - (Math.abs(hy) * SQRT3) / 2));
    const reach = 2 * band + 2;
    const [from, to] = [Math.max(0, Math.floor(cx - half - 1)), Math.min(width, Math.ceil(cx + half + 1))];
    for (let x = from; x < to; x++) {
      if (x > cx - half + reach && x < cx + half - reach - 1) x = Math.ceil(cx + half - reach - 1);
      const hx = x + 0.5 - cx;
      let near = Infinity, edge = 0;
      for (let d = 0; d < 6; d++) {
        const toEdge = inner - (hx * /** @type {number} */ (NX[d]) + hy * /** @type {number} */ (NY[d]));
        if (toEdge < near) {
          near = toEdge;
          edge = d;
        }
      }
      // Outside the hex (another hex's), or past the band
      if (near >= 0 && near < band) fn(x, y, near, edge);
    }
  }
}
