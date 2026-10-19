// boardArt/softLines.mjs
// The board's hex lines softened: the empty board's printed lines and the rims of the terrain
// tiles, on the whole board once its art is laid. Each pixel near a hex's edge is blended with the
// board mirrored in from just inside the hex, so the line keeps only a part of its strength and
// what's beside it carries on across. Pixel work in plain JavaScript, done the same way by
// `npm run board` (scripts/compose-board.mjs) and the app (drawBoard.ts).

/** @typedef {import("./joinedHills.mjs").Pixels} Pixels */

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
 * @param {Pixels & { data: Uint8Array | Uint8ClampedArray }} image
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
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y++) {
      // Only the ends of each row are near an edge: the row's half-width inside the hex, and
      // how far in from each end the band reaches (a slanted edge comes in half as fast across)
      const hy = y + 0.5 - cy;
      const half = Math.min(inner, 2 * (inner - (Math.abs(hy) * SQRT3) / 2));
      const reach = 2 * band + 2;
      const [from, to] = [Math.max(0, Math.floor(cx - half - 1)), Math.min(width, Math.ceil(cx + half + 1))];
      for (let x = from; x < to; x++) {
        if (x > cx - half + reach && x < cx + half - reach - 1) x = Math.ceil(cx + half - reach - 1);
        const hx = x + 0.5 - cx;
        // The nearest edge of this hex, and how far in from it the pixel is
        let near = Infinity, edge = 0;
        for (let d = 0; d < 6; d++) {
          const toEdge = inner - (hx * /** @type {number} */ (NX[d]) + hy * /** @type {number} */ (NY[d]));
          if (toEdge < near) {
            near = toEdge;
            edge = d;
          }
        }
        // Outside the hex (another hex's), or past the band
        if (near < 0 || near >= band) continue;
        const [nx, ny] = [/** @type {number} */ (NX[edge]), /** @type {number} */ (NY[edge])];
        const push = 2 * (band - near);
        const sx = Math.min(width - 1, Math.max(0, Math.round(x - push * nx)));
        const sy = Math.min(height - 1, Math.max(0, Math.round(y - push * ny)));
        // The line itself kept at `keep`, fading to the board as it is at the band's edge
        const w = (1 - keep) * Math.min(1, (band - near) / (band / 2));
        const [o, s] = [channels * (y * width + x), channels * (sy * width + sx)];
        for (let c = 0; c < 3; c++) data[o + c] = Math.round(/** @type {number} */ (source[o + c]) * (1 - w) + /** @type {number} */ (source[s + c]) * w);
      }
    }
  }
}
