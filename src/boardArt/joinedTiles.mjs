// boardArt/joinedTiles.mjs
// Painted tiles that blend into the same terrain next to them, made from a library tile:
// - on every edge shared with the same terrain, the tile's bevel is replaced by the tile itself,
//   mirrored in from a little way inside, and only a faint hex line is left, as on a ridge
//   (joinedHills.mjs). Edges next to other terrain, or open countryside, keep the tile's bevel:
//   the tiles' green isn't the board's, so they'd show a seam however they were blended;
// - forests: tree crowns, cut from the tile, grow across each edge shared with another forest,
//   so the trees aren't held inside their hex. Both hexes draw the same crowns, each its own side;
// - towns: the tile's houses are lifted off it, the ground under them filled in, and laid out
//   again on each hex, turned and placed by the hex, so no two towns look alike;
// - spilling over the countryside: a forest's trees grow out over each edge it shares with open
//   countryside, and some towns have a house standing partly over one such edge (`spill`). These
//   are an overflow image, larger than the hex and clear round them, laid on the board after
//   everything else (and after softLines.mjs's passes) so they lie over the hex next door.
// Only the pixel work, in plain JavaScript, made the same way by `npm run board` (scripts/
// compose-board.mjs reads and writes the images with sharp) and the app (drawBoard.ts, a canvas).
import { rng } from "./terrainTiles.mjs";
import { HEX_LINE } from "./joinedHills.mjs";
import { neighbor, pickFor } from "./boardPlan.mjs";

/** @typedef {import("./joinedHills.mjs").Pixels} Pixels */
/**
 * `key`: the hex, "row-col"; `open`: the six edges (0 = east, clockwise) shared with the same
 * terrain; `bare`: the edges shared with open countryside on the board; `spill`: the bare edge a
 * town's house stands over, or -1; `streets`: the edges a town's streets run out over a little;
 * `woods`: a river's edges facing a forest, which grows into it up to the water (growWoods);
 * `hillShapes`: the hills beside a river, whose ridges run on into it (growHill), `center` the
 * hex's centre on the board (for the ridge's plateau texture); `fade`: the edges a beach fades
 * out across, into the land beside it, along a ragged line; `turns`: the tile turned × 60°
 * clockwise
 * @typedef {{ key: string, open: boolean[], bare: boolean[], spill: number, streets?: number[], woods?: boolean[], hillShapes?: import("./boardPlan.mjs").HillShape[], center?: { x: number, y: number }, fade?: boolean[], turns: number, seed: number }} JoinedHex
 * `tile`: the hex, RGBA; `overflow`: what spills out of it, RGBA, OVERFLOW times the hex's size
 * and centred on it, or null
 * @typedef {(hex: JoinedHex) => { tile: Uint8Array, overflow: Uint8Array | null }} JoinedMaker
 */

/** How much larger than its hex a hex's overflow image is */
export const OVERFLOW = 1.5;

const SQRT3 = Math.sqrt(3);
// The hex's inner radius, in hex radii
const INNER = SQRT3 / 2;
// How deep the tile's bevel is, in hex radii: on a joined edge the tile is mirrored in from here
const BEVEL = 0.09;
// The six edges' outward directions (0 = east, clockwise)
const DIRS = [0, 1, 2, 3, 4, 5].map((d) => [Math.cos((d * Math.PI) / 3), Math.sin((d * Math.PI) / 3)]);

/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * How far out a point is, 1 on the hex's edges (a point in hex radii from its centre)
 * @param {number} x @param {number} y
 */
const hexReach = (x, y) => {
  let m = 0;
  for (const [nx = 0, ny = 0] of DIRS) m = Math.max(m, (x * nx + y * ny) / INNER);
  return m;
};

/**
 * Bilinear sample of an image's RGB (and alpha in out[3]), edges repeated
 * @param {Pixels} image @param {number} x @param {number} y @param {number[]} out
 */
const sample = ({ data, width, height, channels }, x, y, out) => {
  x = clamp(x, 0, width - 1.001);
  y = clamp(y, 0, height - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = channels * (y0 * width + x0), j = i + channels * width;
  for (let c = 0; c < channels; c++) {
    const top = /** @type {number} */ (data[i + c]) * (1 - fx) + /** @type {number} */ (data[i + channels + c]) * fx;
    const bottom = /** @type {number} */ (data[j + c]) * (1 - fx) + /** @type {number} */ (data[j + channels + c]) * fx;
    out[c] = top * (1 - fy) + bottom * fy;
  }
  if (channels < 4) out[3] = 255;
  return out;
};

/**
 * A town tile's houses drawn round by hand, for a tile whose roofs its colours can't tell from the
 * ground (light roofs on white cobbles, red ones on brown earth): each house's outline as points
 * in the tile's pixels, the tile being `size` (its library image's width and height). Kept beside
 * the tile as <tile>.json
 * @typedef {{ size: [number, number], houses: [number, number][][] }} HouseOutlines
 */

/**
 * Grow a mask by `radius` pixels, on a W × H image
 * @param {Uint8Array} mask @param {number} W @param {number} H @param {number} radius
 */
const grown = (mask, W, H, radius) => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dy = -radius; dy <= radius && !v; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const [xx, yy] = [x + dx, y + dy];
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) {
            v = 1;
            break;
          }
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
};

/**
 * The houses drawn round in `outlines`, on the tile read at any size: each outline filled and
 * grown by the house's own dark outline, as findHouses makes them
 * @param {Pixels} tile @param {HouseOutlines} outlines
 */
function outlinedHouses({ data, width: W, height: H, channels: C }, { size: [SW, SH], houses: shapes }) {
  const k = Math.max(1, Math.round(H / 149));
  const [fx, fy] = [W / SW, H / SH];
  const roofs = new Float32Array(W * H);
  const houses = shapes
    .map((shape) => {
      const poly = shape.map(([x, y]) => [x * fx, y * fy]);
      const filled = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // Even-odd, at the pixel's middle
          let inside = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const [xi = 0, yi = 0] = /** @type {number[]} */ (poly[i]);
            const [xj = 0, yj = 0] = /** @type {number[]} */ (poly[j]);
            if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
          }
          // Only what the tile has: not the corners outside its hex
          if (inside && (C < 4 || /** @type {number} */ (data[C * (y * W + x) + 3]) > 200)) filled[y * W + x] = 1;
        }
      }
      const mask = grown(filled, W, H, k);
      if (C === 4) for (let p = 0; p < W * H; p++) if (/** @type {number} */ (data[4 * p + 3]) <= 200) mask[p] = 0;
      let [sx, sy, n] = [0, 0, 0];
      for (let p = 0; p < W * H; p++) {
        if (!mask[p]) continue;
        roofs[p] = 1;
        sx += p % W;
        sy += (p / W) | 0;
        n++;
      }
      const [cx, cy] = [sx / n, sy / n];
      /** @type {[number, number][]} */
      const points = [];
      for (let p = 0; p < W * H; p++) if (mask[p] && (p % W) % (2 * k) === 0 && ((p / W) | 0) % (2 * k) === 0) points.push([(p % W) - cx, ((p / W) | 0) - cy]);
      // Outermost first: a spot that won't fit is found out sooner
      points.sort((a, b) => b[0] * b[0] + b[1] * b[1] - (a[0] * a[0] + a[1] * a[1]));
      return { mask: Float32Array.from(mask), cx, cy, size: n, points };
    })
    .sort((a, b) => b.size - a.size);
  return { houses, roofs };
}

/**
 * The town tile's houses: each a mask over the tile (1 on the house, its outline and the shadow
 * under it), drawn round in `outlines` when the tile has them, or found by their blue-grey roofs
 * and dark outlines
 * @param {Pixels} tile
 * @param {HouseOutlines} [outlines]
 */
function findHouses(tile, outlines) {
  if (outlines) return outlinedHouses(tile, outlines);
  const { data, width: W, height: H, channels: C } = tile;
  const R = H / 2;
  const k = Math.max(1, Math.round(H / 149));
  const roof = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = C * (y * W + x);
      const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
      const alpha = C === 4 ? /** @type {number} */ (data[i + 3]) : 255;
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const inside = hexReach((x - W / 2) / R, (y - H / 2) / R) < 0.92;
      if (alpha > 200 && inside && ((b - r > 8 && b >= g - 6) || (lum < 75 && g - b < 35))) roof[y * W + x] = 1;
    }
  }
  /** @param {Uint8Array} mask @param {number} radius @param {boolean} grow */
  const morph = (mask, radius, grow) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = grow ? 0 : 1;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const [xx, yy] = [x + dx, y + dy];
            const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : /** @type {number} */ (mask[yy * W + xx]);
            v = grow ? v | s : v & s;
          }
        }
        out[y * W + x] = v;
      }
    }
    return out;
  };
  // Closed, so each house is one piece with its outline
  const closed = morph(morph(roof, k, true), k, false);
  const label = new Int32Array(W * H).fill(-1);
  /** @type {number[][]} */
  const pieces = [];
  for (let s = 0; s < W * H; s++) {
    if (!closed[s] || /** @type {number} */ (label[s]) >= 0) continue;
    const stack = [s], cells = [];
    label[s] = pieces.length;
    while (stack.length) {
      const p = /** @type {number} */ (stack.pop());
      cells.push(p);
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= W * H || !closed[q] || /** @type {number} */ (label[q]) >= 0) continue;
        label[q] = pieces.length;
        stack.push(q);
      }
    }
    pieces.push(cells);
  }
  const houses = pieces
    .filter((cells) => cells.length > 30 * k * k)
    .map((cells) => {
      const piece = new Uint8Array(W * H);
      for (const p of cells) piece[p] = 1;
      // Its holes filled (the white chimneys), grown by the outline
      const outside = new Uint8Array(W * H);
      const stack = [0];
      outside[0] = 1;
      while (stack.length) {
        const p = /** @type {number} */ (stack.pop());
        const x = p % W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
          if (q < 0 || q >= W * H || piece[q] || outside[q]) continue;
          outside[q] = 1;
          stack.push(q);
        }
      }
      const mask = morph(outside.map((v) => 1 - v), k, true);
      let [sx, sy, n] = [0, 0, 0];
      for (let p = 0; p < W * H; p++) {
        if (mask[p]) {
          sx += p % W;
          sy += (p / W) | 0;
          n++;
        }
      }
      const [cx, cy] = [sx / n, sy / n];
      // The house's outline points, from its middle, for placing it
      /** @type {[number, number][]} */
      const points = [];
      for (let p = 0; p < W * H; p++) if (mask[p] && (p % W) % (2 * k) === 0 && ((p / W) | 0) % (2 * k) === 0) points.push([(p % W) - cx, ((p / W) | 0) - cy]);
      // Outermost first: a spot that won't fit is found out sooner
      points.sort((a, b) => b[0] * b[0] + b[1] * b[1] - (a[0] * a[0] + a[1] * a[1]));
      return { mask: Float32Array.from(mask), cx, cy, size: n, points };
    })
    .sort((a, b) => b.size - a.size);
  // Everything that looked like a house, the bits too small to be one included, to clear off the ground
  const roofs = Float32Array.from(closed);
  return { houses, roofs };
}

// The turns (× 60°) and mirrorings tried, in order, for the ground under a house
/** @type {[number, boolean][]} */
const FILLS = [[2, false], [4, false], [3, true], [0, true], [1, false], [5, false], [3, false], [1, true], [2, true], [4, true], [5, true]];

/**
 * The town tile with its houses lifted off: each pixel under a house filled from the nearest
 * open ground the tile has there when turned or mirrored (cobbles in the middle, grass further
 * out, as the tile is laid out)
 * @param {Pixels} tile @param {Float32Array[]} masks
 * @returns {Pixels}
 */
function emptyTown(tile, masks) {
  const { data, width: W, height: H, channels: C } = tile;
  const k = Math.max(1, Math.round(H / 149));
  const hole = new Uint8Array(W * H);
  for (const mask of masks) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue;
        for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H) hole[(y + dy) * W + x + dx] = 1;
      }
    }
  }
  const out = Uint8Array.from(data);
  const left = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!hole[y * W + x]) continue;
      const [dx, dy] = [x - W / 2, y - H / 2];
      // The tile turned round its middle, or mirrored, by the hex's own symmetries: whole patches
      // of ground come across, rather than single pixels
      left[y * W + x] = 1;
      for (const [k, flip] of FILLS) {
        const a = (k * Math.PI) / 3, [ex, ey] = [flip ? -dx : dx, dy];
        const [sx, sy] = [Math.round(W / 2 + ex * Math.cos(a) - ey * Math.sin(a)), Math.round(H / 2 + ex * Math.sin(a) + ey * Math.cos(a))];
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || hole[sy * W + sx]) continue;
        for (let c = 0; c < C; c++) out[C * (y * W + x) + c] = /** @type {number} */ (data[C * (sy * W + sx) + c]);
        left[y * W + x] = 0;
        break;
      }
    }
  }
  // Round the middle every turn lands on a house too: ground from a little way off, filled already
  const shift = Math.round(0.36 * (H / 2));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!left[y * W + x]) continue;
      for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const [sx, sy] = [x + (ux ?? 0) * shift, y + (uy ?? 0) * shift];
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || left[sy * W + sx]) continue;
        for (let c = 0; c < C; c++) out[C * (y * W + x) + c] = /** @type {number} */ (out[C * (sy * W + sx) + c]);
        break;
      }
    }
  }
  return { data: out, width: W, height: H, channels: C };
}

/**
 * The forest tile's tree crowns: where its light is brightest round about (each crown is lit in
 * its middle), from its middle out, each at least `apart` hex radii from the next
 * @param {Pixels} tile @param {number} apart
 */
function findCrowns({ data, width: W, height: H, channels: C }, apart) {
  const R = H / 2;
  const lum = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = C * p;
    lum[p] = 0.3 * /** @type {number} */ (data[i]) + 0.59 * /** @type {number} */ (data[i + 1]) + 0.11 * /** @type {number} */ (data[i + 2]);
  }
  // Blurred over about a crown's middle: a box across, then down
  const k = Math.max(1, Math.round(0.07 * R));
  /** @param {Float32Array} from @param {number} step @param {number} along @param {number} lines @param {number} lineStep */
  const box = (from, step, along, lines, lineStep) => {
    const to = new Float32Array(W * H);
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < along; i++) {
        let [t, n] = [0, 0];
        for (let j = Math.max(0, i - k); j <= Math.min(along - 1, i + k); j++) {
          t += /** @type {number} */ (from[l * lineStep + j * step]);
          n++;
        }
        to[l * lineStep + i * step] = t / n;
      }
    }
    return to;
  };
  const blurred = box(box(lum, 1, W, H, W), W, H, W, 1);
  /** @type {[number, number, number][]} */
  const peaks = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (hexReach((x - W / 2) / R, (y - H / 2) / R) > 0.62) continue;
      peaks.push([/** @type {number} */ (blurred[y * W + x]), x, y]);
    }
  }
  peaks.sort((a, b) => b[0] - a[0]);
  /** @type {[number, number][]} */
  const crowns = [];
  for (const [, x, y] of peaks) {
    if (crowns.every(([cx, cy]) => Math.hypot(cx - x, cy - y) > apart * R)) crowns.push([x, y]);
  }
  return crowns;
}

/**
 * A town's street: from `ox, oy` along `dx, dy` for `length`, in hex radii in the board's orientation
 * @typedef {{ ox: number, oy: number, dx: number, dy: number, length: number, phase: number }} Lane
 */

/** How far a point is from a street's middle line, in hex radii @param {Lane} lane @param {number} x @param {number} y */
const laneReach = (lane, x, y) => {
  const [rx, ry] = [x - lane.ox, y - lane.oy];
  const along = clamp(rx * lane.dx + ry * lane.dy, 0, lane.length);
  return Math.hypot(rx - along * lane.dx, ry - along * lane.dy);
};

/** @typedef {ReturnType<typeof findHouses>["houses"][number]} House */
/** @typedef {House & { x: number, y: number, cos: number, sin: number, scale: number }} Placed */

/** @param {Placed[]} layout */
const area = (layout) => layout.reduce((t, h) => t + h.size * h.scale * h.scale, 0);

/**
 * The houses laid out on the tile, in its own pixels: largest first, each turned any way and put
 * where it clears the others and stays off the hex's edges; one that won't fit tries again a
 * little smaller, and is left out after that
 * @param {House[]} houses @param {number} W @param {number} H @param {() => number} rand
 * @param {Uint8Array} inside where a house may go on an empty tile: 1 off the hex's edges
 * @param {Placed | null} first a house already placed (the one spilling over an edge)
 * @returns {Placed[]}
 */
function layHouses(houses, W, H, rand, inside, first) {
  const OR = H / 2;
  // Where a house may go: off the hex's edges and clear of the houses already placed
  const free = Uint8Array.from(inside);
  const gap = 2 * Math.max(1, Math.round(OR / 40));
  /** @type {Placed[]} */
  const placed = [];
  if (first) {
    const [cos, sin] = [first.scale * first.cos, first.scale * first.sin];
    for (const [u, v] of first.points) {
      const [sx, sy] = [Math.round(first.x + u * cos - v * sin), Math.round(first.y + u * sin + v * cos)];
      for (let dy = -gap; dy <= gap; dy++) {
        for (let dx = -gap; dx <= gap; dx++) {
          const [tx, ty] = [sx + dx, sy + dy];
          if (tx >= 0 && ty >= 0 && tx < W && ty < H) free[ty * W + tx] = 0;
        }
      }
    }
  }
  for (const [index, house] of houses.entries()) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const scale = attempt < 200 ? 1 : 0.85;
      const angle = rand() * 2 * Math.PI, dist = Math.sqrt(rand()) * 0.62 * OR, at = rand() * 2 * Math.PI;
      const [x, y] = [W / 2 + dist * Math.cos(at), H / 2 + dist * Math.sin(at)];
      const [cos, sin] = [scale * Math.cos(angle), scale * Math.sin(angle)];
      /** @param {[number, number]} point */
      const spot = ([u, v]) => [Math.round(x + u * cos - v * sin), Math.round(y + u * sin + v * cos)];
      const fits = house.points.every((point) => {
        const [sx = 0, sy = 0] = spot(point);
        return sx >= 0 && sy >= 0 && sx < W && sy < H && free[sy * W + sx];
      });
      if (!fits) continue;
      for (const point of house.points) {
        const [sx = 0, sy = 0] = spot(point);
        for (let dy = -gap; dy <= gap; dy++) {
          for (let dx = -gap; dx <= gap; dx++) {
            const [tx, ty] = [sx + dx, sy + dy];
            if (tx >= 0 && ty >= 0 && tx < W && ty < H) free[ty * W + tx] = 0;
          }
        }
      }
      placed.push({ ...house, x, y, cos: Math.cos(angle), sin: Math.sin(angle), scale });
      break;
    }
    // The largest, when it won't fit anywhere (a church, a farm's barn), stays where it is on the
    // tile, so the tile keeps its main building
    if (index === 0 && !placed.length) {
      for (const [u, v] of house.points) {
        const [sx, sy] = [Math.round(house.cx + u), Math.round(house.cy + v)];
        for (let dy = -gap; dy <= gap; dy++) {
          for (let dx = -gap; dx <= gap; dx++) {
            const [tx, ty] = [sx + dx, sy + dy];
            if (tx >= 0 && ty >= 0 && tx < W && ty < H) free[ty * W + tx] = 0;
          }
        }
      }
      placed.push({ ...house, x: house.cx, y: house.cy, cos: 1, sin: 0, scale: 1 });
    }
  }
  return placed;
}

/**
 * A house placed standing partly over edge `edge` (in the tile's own orientation): its middle near
 * the edge, just inside it, clear of the hex's other edges and of the corners, or null when it won't go
 * @param {House} house @param {number} edge @param {number} W @param {number} H @param {() => number} rand
 * @returns {Placed | null}
 */
function spillHouse(house, edge, W, H, rand) {
  const OR = H / 2;
  const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[edge]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const angle = rand() * 2 * Math.PI;
    const [depth, along] = [(0.86 + 0.14 * rand()) * INNER, (rand() - 0.5) * 0.4];
    const [x, y] = [W / 2 + (nx * depth - ny * along) * OR, H / 2 + (ny * depth + nx * along) * OR];
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const fits = house.points.every(([u, v]) => {
      const [px, py] = [(x + u * cos - v * sin - W / 2) / OR, (y + u * sin + v * cos - H / 2) / OR];
      // Off the other edges, and within the edge's own length, short of its corners
      for (let d = 0; d < 6; d++) {
        const [mx = 0, my = 0] = /** @type {number[]} */ (DIRS[d]);
        if (d !== edge && px * mx + py * my > 0.86 * INNER) return false;
      }
      return Math.abs(-px * ny + py * nx) < 0.36 && px * nx + py * ny < 1.3 * INNER;
    });
    if (fits) return { ...house, x, y, cos, sin, scale: 1 };
  }
  return null;
}

/**
 * Returns a function that draws one hex of `type` (boardPlan's JOINED_TERRAIN) `scale` times the board's
 * size, `scale·tileWidth` × `scale·tileHeight` RGBA pixels in the board's orientation (the
 * tile's turn already made). `tile`: the library tile, RGBA, at any size (twice its own reads best)
 * @param {string} type
 * @param {Pixels} tile
 * @param {number} tileWidth
 * @param {number} tileHeight
 * @param {number} [scale]
 * @param {Pixels} [forest] the forest tile, RGBA, for a river's woods
 * @param {import("./joinedHills.mjs").RidgeMaker} [hillMaker] ridges at the same size and scale, for the hills beside a river
 * @param {HouseOutlines} [outlines] a town tile's houses drawn round by hand (<tile>.json)
 * @returns {JoinedMaker}
 */
export function joinedTileMaker(type, tile, tileWidth, tileHeight, scale = 2, forest, hillMaker, outlines) {
  const TW = scale * tileWidth, TH = scale * tileHeight, TR = TH / 2;
  const OR = tile.height / 2;
  const { houses, roofs } = type === "town" ? findHouses(tile, outlines) : { houses: [], roofs: new Float32Array() };
  const ground = type === "town" ? emptyTown(tile, [roofs, ...houses.map((h) => h.mask)]) : tile;
  const trees = type === "forest" ? findCrowns(tile, 0.24) : [];
  const inside = new Uint8Array(houses.length ? tile.width * tile.height : 0);
  for (let p = 0; p < inside.length; p++) inside[p] = hexReach(((p % tile.width) - tile.width / 2) / OR, (((p / tile.width) | 0) - tile.height / 2) / OR) < 0.8 ? 1 : 0;
  const px = 1 / TR;

  const OW = Math.round(OVERFLOW * TW), OH = Math.round(OVERFLOW * TH);

  return ({ key, open, bare, spill, streets = [], woods = [], hillShapes = [], center = { x: 0, y: 0 }, fade = [], turns, seed }) => {
    const rand = rng(seed);
    const fading = DIRS.filter((_, d) => fade[d]);
    // The ragged line a beach fades along: how far in the land reaches, by the angle round the hex
    const [f1, f2] = fading.length ? [rand() * 6.3, rand() * 6.3] : [0, 0];
    /** @param {number} hx @param {number} hy */
    const fadeAt = (hx, hy) => {
      if (!fading.length) return 1;
      let near = Infinity;
      for (const [nx = 0, ny = 0] of fading) near = Math.min(near, INNER - (hx * nx + hy * ny));
      const along = Math.atan2(hy, hx);
      const reach = 0.3 + 0.07 * Math.sin(along * 9 + f1) + 0.04 * Math.sin(along * 23 + f2);
      const t = clamp((near - 0.02) / reach, 0, 1);
      return t * t * (3 - 2 * t);
    };
    // From the board's orientation to the tile's: turned back
    const turn = (-turns * Math.PI) / 3;
    const [ct, st] = [Math.cos(turn), Math.sin(turn)];

    // A town's house standing over a bare edge (one of the two smaller ones), then the rest laid
    // out again, the two smallest twice where there's room: the best of a few tries
    // (one of the two smallest houses, and never a long one: a fence or a wall would reach too far)
    const compact = houses.filter((h) => h.points.every(([u, v]) => u * u + v * v < (0.3 * OR) ** 2));
    const spillable = compact.slice(-2);
    const spilt =
      spillable.length && spill >= 0
        ? spillHouse(/** @type {House} */ (spillable[Math.floor(rand() * spillable.length)]), (((spill - turns) % 6) + 6) % 6, tile.width, tile.height, rand)
        : null;
    // A town's streets: from its square out across an edge, a little way into the hex beside it
    /** @type {Lane[]} */
    const lanes = streets.map((d) => {
      const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[d]);
      const tilt = (rand() - 0.5) * 0.4, side = (rand() - 0.5) * 0.2;
      const [dx, dy] = [nx * Math.cos(tilt) - ny * Math.sin(tilt), nx * Math.sin(tilt) + ny * Math.cos(tilt)];
      return { ox: nx * 0.2 * INNER - ny * side, oy: ny * 0.2 * INNER + nx * side, dx, dy, length: (1.03 + 0.12 * rand()) * INNER, phase: rand() * 6.3 };
    });
    // The town's square near the middle and its main street across the hex (along its first
    // street out, if it has one), kept clear of houses, so the houses stand apart round them
    const square = houses.length
      ? { x: (rand() - 0.5) * 0.12, y: (rand() - 0.5) * 0.12, r: 0.19 + 0.05 * rand(), lumps: [rand() * 6.3, rand() * 6.3] }
      : null;
    const axis = ((streets[0] ?? Math.floor(rand() * 3)) * Math.PI) / 3 + (rand() - 0.5) * 0.3;
    /** @type {Lane[]} */
    const mainStreet = square
      ? [axis, axis + Math.PI].map((angle) => ({ ox: square.x, oy: square.y, dx: Math.cos(angle), dy: Math.sin(angle), length: 0.68 * INNER, phase: rand() * 6.3 }))
      : [];
    /** @type {Placed[]} */
    let placed = [];
    const wanted = [...houses, ...houses.slice(-2)];
    // Where a house may go in this hex: off the hex's edges, the square and the streets
    const free = Uint8Array.from(inside);
    if (square) {
      for (let p = 0; p < free.length; p++) {
        if (!free[p]) continue;
        const [tu, tv] = [((p % tile.width) - tile.width / 2) / OR, (((p / tile.width) | 0) - tile.height / 2) / OR];
        // In hex radii in the board's orientation (toTile turned back)
        const [x, y] = [tu * ct + tv * st, -tu * st + tv * ct];
        if (Math.hypot(x - square.x, y - square.y) < square.r + 0.03) free[p] = 0;
        else if ([...mainStreet, ...lanes].some((lane) => laneReach(lane, x, y) < 0.15)) free[p] = 0;
      }
    }
    for (let i = 0; i < 8 && placed.length < wanted.length; i++) {
      const layout = layHouses(wanted, tile.width, tile.height, rand, free, spilt);
      if (area(layout) > area(placed)) placed = layout;
    }
    /** @param {Placed} h */
    const maskOf = (h) => ({ data: h.mask, width: tile.width, height: tile.height, channels: 1 });
    const masks = placed.map(maskOf);
    // Houses cast a short shadow down and to the right, the board's light being from the top left
    const shadowShift = 0.035 * OR;

    // Crowns across each edge shared with another forest, the same from either side: each edge's
    // crowns are made from its own seed, in the frame of the hex that owns it
    /** @typedef {{ x: number, y: number, r: number, sx: number, sy: number, cos: number, sin: number, lumps: number[] }} Crown */
    /** @type {Crown[]} */
    const crowns = [];
    /** One of the tile's crowns, turned any way, at x, y @param {number} x @param {number} y @param {number} r @param {() => number} r0 @returns {Crown} */
    const crownAt = (x, y, r, r0) => {
      const [sx = 0, sy = 0] = trees[Math.floor(r0() * trees.length)] ?? [tile.width / 2, tile.height / 2];
      const angle = r0() * 2 * Math.PI;
      return { x, y, r, sx, sy, cos: Math.cos(angle), sin: Math.sin(angle), lumps: [r0() * 6.3, r0() * 6.3, 0.05 + 0.04 * r0()] };
    };
    /**
     * Crowns along edge d, seen from a hex whose centre is at `o` from this one's, `out` how
     * far past the edge their middles go (in hex radii, from − to +)
     * @param {number} d @param {number[]} o @param {[number, number]} out @param {() => number} r0
     */
    const alongEdge = (d, [ox = 0, oy = 0], [lo, hi], r0) => {
      const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[d]);
      const [mx, my] = [ox + nx * INNER, oy + ny * INNER];
      const count = 3 + Math.floor(r0() * 2);
      /** @type {Crown[]} */
      const list = [];
      for (let i = 0; i < count; i++) {
        const r = 0.13 + 0.06 * r0();
        // Kept off the corners: a crown nearer the corner than its size would reach the third hex there
        const span = 0.47 - r - 0.04;
        const s = (count === 1 ? 0 : -span + (2 * span * i) / (count - 1)) + (r0() - 0.5) * 0.06;
        const u = lo + (hi - lo) * r0();
        list.push(crownAt(mx - ny * s + nx * u, my + nx * s + ny * u, r, r0));
      }
      return list;
    };
    if (type === "forest") {
      for (let d = 0; d < 6; d++) {
        if (!open[d]) continue;
        // The edge belongs to the hex of the two that comes first, row by row
        const other = neighbor(key, d);
        const [row = 0, col = 0] = key.split("-").map(Number);
        const [orow = 0, ocol = 0] = other.split("-").map(Number);
        const mine = row < orow || (row === orow && col < ocol);
        const r0 = rng(pickFor(mine ? key : other, 11 + (mine ? d : (d + 3) % 6), 1 << 30));
        const o = mine ? [0, 0] : [SQRT3 * (DIRS[d]?.[0] ?? 0), SQRT3 * (DIRS[d]?.[1] ?? 0)];
        crowns.push(...alongEdge(mine ? d : (d + 3) % 6, o, [-0.06, 0.06], r0));
      }
    }
    // Trees growing out over the countryside: in the overflow, over everything round the hex
    /** @type {Crown[]} */
    const spillCrowns = [];
    if (type === "forest") for (let d = 0; d < 6; d++) if (bare[d]) spillCrowns.push(...alongEdge(d, [0, 0], [-0.08, 0.02], rand));
    // Light from the top left: crowns cast their shadow down and to the right
    const [shx, shy] = [0.03, 0.04];

    const a = [0, 0, 0, 0], b = [0, 0, 0, 0], m = [0];
    /** Tile coordinates of a point in hex radii, in the board's orientation @param {number} x @param {number} y */
    const toTile = (x, y) => [(x * ct - y * st) * OR + tile.width / 2, (x * st + y * ct) * OR + tile.height / 2];
    /**
     * A house's shadow and the house over a colour with alpha, at tile coordinates u, v
     * @param {Placed} h @param {Pixels} mask @param {number} u @param {number} v @param {number[]} px
     */
    const paintHouse = (h, mask, u, v, px) => {
      const [du, dv] = [u - h.x - shadowShift, v - h.y - shadowShift];
      const s = 0.4 * (sample(mask, h.cx + (du * h.cos + dv * h.sin) / h.scale, h.cy + (dv * h.cos - du * h.sin) / h.scale, m)[0] ?? 0);
      over(px, 0, 0, 0, s);
      const [eu, ev] = [u - h.x, v - h.y];
      const [hu, hv] = [h.cx + (eu * h.cos + ev * h.sin) / h.scale, h.cy + (ev * h.cos - eu * h.sin) / h.scale];
      const w = sample(mask, hu, hv, m)[0] ?? 0;
      if (w <= 0) return;
      sample(tile, hu, hv, b);
      over(px, b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, w);
    };
    // The streets run from the square out across an edge, a little way into the hex
    // beside it, narrowing; cobbles from the middle of the tile's square, with a darker kerb.
    // Inside the hex they're laid under the houses, past its edge in the overflow
    // Cobbled yards over some of the edges with streets or countryside beyond: lumpy patches of
    // the square's cobbles straddling the edge, so the town's ground runs on a little past it.
    // Laid under the houses inside the hex, and in the overflow past its edge, as the streets are
    const yards = [...new Set([...streets, ...[0, 1, 2, 3, 4, 5].filter((d) => bare[d])])]
      .sort((p, q) => p - q)
      .filter(() => rand() < 0.6)
      .map((d) => {
        const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[d]);
        const [depth, side] = [(0.88 + 0.1 * rand()) * INNER, (rand() - 0.5) * 0.35];
        return { x: nx * depth - ny * side, y: ny * depth + nx * side, r: 0.17 + 0.07 * rand(), lumps: [rand() * 6.3, rand() * 6.3] };
      });
    /**
     * Cobbled patches (the yards, the square) over a colour with alpha, at a point in hex radii
     * @param {number} hx @param {number} hy @param {number[]} px @param {typeof yards} [list]
     */
    const paintYards = (hx, hy, px, list = yards) => {
      for (const yard of list) {
        const [dx, dy] = [hx - yard.x, hy - yard.y];
        if (Math.abs(dx) > yard.r * 1.3 || Math.abs(dy) > yard.r * 1.3) continue;
        const theta = Math.atan2(dy, dx);
        const [l1 = 0, l2 = 0] = yard.lumps;
        const edge = yard.r * (1 + 0.18 * Math.sin(3 * theta + l1) + 0.1 * Math.sin(5 * theta + l2));
        const dist = Math.hypot(dx, dy);
        const w = clamp((edge - dist) / 0.012, 0, 1);
        if (w <= 0) continue;
        sample(ground, tile.width / 2 + mirrorIn(dx * OR, 0.22 * OR), tile.height / 2 + mirrorIn(dy * OR, 0.22 * OR), b);
        // Worn darker at its rim, where the grass begins
        const rim = dist > edge * 0.82 ? 0.78 : 0.92;
        over(px, (b[0] ?? 0) * rim, (b[1] ?? 0) * rim, (b[2] ?? 0) * rim, w);
      }
    };
    /**
     * The streets' cobbles over a colour with alpha, at a point in hex radii
     * @param {number} hx @param {number} hy @param {number[]} px @param {Lane[]} [list]
     */
    const paintStreets = (hx, hy, px, list = lanes) => {
      for (const lane of list) {
        const [rx, ry] = [hx - lane.ox, hy - lane.oy];
        const along = rx * lane.dx + ry * lane.dy, across = -rx * lane.dy + ry * lane.dx;
        if (along < -0.1 || along > lane.length + 0.1) continue;
        const t = clamp(along / lane.length, 0, 1);
        const half = (0.1 - 0.035 * t) * (1 + 0.12 * Math.sin(along * 40 + lane.phase));
        // Squared off where it starts, among the houses; rounded at its far end
        const off = along > lane.length ? Math.hypot(along - lane.length, across) : along < 0 ? Infinity : Math.abs(across);
        const w = clamp((half - off) / 0.012, 0, 1);
        if (w <= 0) continue;
        const [mu, mv] = [mirrorIn(along * OR * 0.9, 0.22 * OR), mirrorIn(across * OR, 0.22 * OR)];
        sample(ground, tile.width / 2 + mu, tile.height / 2 + mv, b);
        const kerb = off > half * 0.75 ? 0.7 : 0.9;
        over(px, (b[0] ?? 0) * kerb, (b[1] ?? 0) * kerb, (b[2] ?? 0) * kerb, w);
      }
    };

    // Inside the hex: the main street and the streets out
    const inHex = [...mainStreet, ...lanes];
    // The alpha of the tile at the last point tileAt read
    let seen = 1;
    /** A house's mask at a point of the tile: nothing off the tile @param {number} i @param {number} u @param {number} v */
    const maskAt = (i, u, v) => (u < 0 || v < 0 || u > tile.width - 1 || v > tile.height - 1 ? 0 : (sample(/** @type {Pixels} */ (masks[i]), u, v, m)[0] ?? 0));
    /** The tile (its houses re-laid) at a point in hex radii, in the board's orientation @param {number} x @param {number} y */
    const tileAt = (x, y) => {
      const [u = 0, v = 0] = toTile(x, y);
      sample(ground, u, v, a);
      // The tile's own alpha kept aside (a water tile is clear round its banks); the colour is solid
      seen = /** @type {number} */ (a[3]) / 255;
      a[3] = 1;
      if (yards.length) paintYards(x, y, a);
      if (square) paintYards(x, y, a, [square]);
      if (inHex.length) paintStreets(x, y, a, inHex);
      if (!placed.length) return a;
      let shade = 1;
      for (const [i, h] of placed.entries()) {
        const [du, dv] = [u - h.x - shadowShift, v - h.y - shadowShift];
        const s = maskAt(i, h.cx + (du * h.cos + dv * h.sin) / h.scale, h.cy + (dv * h.cos - du * h.sin) / h.scale);
        shade *= 1 - 0.4 * s;
      }
      for (let c = 0; c < 3; c++) a[c] = /** @type {number} */ (a[c]) * shade;
      for (const [i, h] of placed.entries()) {
        const [du, dv] = [u - h.x, v - h.y];
        const [hu, hv] = [h.cx + (du * h.cos + dv * h.sin) / h.scale, h.cy + (dv * h.cos - du * h.sin) / h.scale];
        const w = maskAt(i, hu, hv);
        if (w <= 0) continue;
        sample(tile, hu, hv, b);
        for (let c = 0; c < 3; c++) a[c] = /** @type {number} */ (a[c]) * (1 - w) + /** @type {number} */ (b[c]) * w;
      }
      return a;
    };
    /**
     * The crowns over a colour with alpha, each with its shadow, at a point in hex radii
     * @param {Crown[]} list @param {number} hx @param {number} hy @param {number[]} px
     */
    const paintCrowns = (list, hx, hy, px) => {
      for (const crown of list) {
        const [dx, dy] = [hx - crown.x, hy - crown.y];
        if (Math.abs(dx) > crown.r + 0.1 || Math.abs(dy) > crown.r + 0.1) continue;
        const [l1 = 0, l2 = 0, lump = 0] = crown.lumps;
        const theta = Math.atan2(dy, dx);
        const edgeR = crown.r * (1 + lump * Math.sin(5 * theta + l1) + 0.6 * lump * Math.sin(3 * theta + l2));
        const soft = 0.025;
        const shadow = clamp((edgeR - Math.hypot(dx - shx, dy - shy)) / soft, 0, 1);
        if (shadow > 0) over(px, 0, 0, 0, 0.25 * shadow);
        const dist = Math.hypot(dx, dy);
        const w = clamp((edgeR - dist) / soft, 0, 1);
        if (w <= 0) continue;
        const [u, v] = [crown.sx + (dx * crown.cos - dy * crown.sin) * OR, crown.sy + (dx * crown.sin + dy * crown.cos) * OR];
        const t = sample(tile, u, v, b);
        // Rounded: darker towards its rim, lit from the top left
        const rim = dist / edgeR;
        const shade = 1.04 - 0.3 * rim * rim - (0.12 * (0.6 * dx + 0.8 * dy)) / edgeR;
        over(px, clamp((t[0] ?? 0) * shade, 0, 255), clamp((t[1] ?? 0) * shade, 0, 255), clamp((t[2] ?? 0) * shade, 0, 255), w);
      }
    };

    const out = new Uint8Array(TW * TH * 4);
    for (let y = 0; y < TH; y++) {
      const hy = (y - TH / 2 + 0.5) / TR;
      for (let x = 0; x < TW; x++) {
        const hx = (x - TW / 2 + 0.5) / TR;
        // On a joined edge's bevel, the tile mirrored in from just inside it
        let [qx, qy] = [hx, hy];
        let nearest = Infinity, edge = -1;
        for (let d = 0; d < 6; d++) {
          const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[d]);
          const toEdge = INNER - (hx * nx + hy * ny);
          if (toEdge < nearest) {
            nearest = toEdge;
            edge = d;
          }
        }
        if (open[edge] && nearest < BEVEL) {
          const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[edge]);
          const push = 2 * (BEVEL - nearest);
          [qx, qy] = [hx - push * nx, hy - push * ny];
        }
        const c = tileAt(qx, qy);
        const tileAlpha = seen;
        // A faint hex line where the terrain carries on
        if (open[edge] && nearest < 1.5 * scale * px) over(c, HEX_LINE[0] ?? 0, HEX_LINE[1] ?? 0, HEX_LINE[2] ?? 0, 0.45);
        // The crowns over the edges
        paintCrowns(crowns, hx, hy, c);
        out.set([c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, Math.round(255 * tileAlpha * fadeAt(hx, hy))], 4 * (y * TW + x));
      }
    }
    // A town or a river ends in the board's own countryside
    if (type === "town" || type === "river") toCountryside(out, TW, TH, type === "town" ? 0.1 : 0.07, seed);
    // A forest beside a river grows into it, up to the water
    if (type === "river" && forest) growWoods(out, TW, TH, woods, seed, forest);
    // A hill beside it comes down to its bank
    if (type === "river" && hillMaker) for (const shape of hillShapes) growHill(out, TW, TH, shape.edge, seed, hillOver(hillMaker, shape, center));

    if (!spilt && !spillCrowns.length && !lanes.length && !yards.length) return { tile: out, overflow: null };
    // What spills out: the streets and the house over its edge, whole, and the trees over the countryside
    const overflow = new Uint8Array(OW * OH * 4);
    const spiltMask = spilt ? maskOf(spilt) : null;
    const px4 = [0, 0, 0, 0];
    for (let y = 0; y < OH; y++) {
      const hy = (y - OH / 2 + 0.5) / TR;
      for (let x = 0; x < OW; x++) {
        const hx = (x - OW / 2 + 0.5) / TR;
        px4.fill(0);
        if (hexReach(hx, hy) > 0.99) {
          if (yards.length) paintYards(hx, hy, px4);
          if (lanes.length) paintStreets(hx, hy, px4);
        }
        if (spilt && spiltMask) {
          const [u = 0, v = 0] = toTile(hx, hy);
          paintHouse(spilt, spiltMask, u, v, px4);
        }
        paintCrowns(spillCrowns, hx, hy, px4);
        const alpha = px4[3] ?? 0;
        if (alpha <= 0) continue;
        overflow.set([(px4[0] ?? 0) / alpha, (px4[1] ?? 0) / alpha, (px4[2] ?? 0) / alpha, 255 * alpha], 4 * (y * OW + x));
      }
    }
    return { tile: out, overflow };
  };
}

/** A coordinate folded back and forth into −half…half, so a texture repeats mirrored @param {number} v @param {number} half */
const mirrorIn = (v, half) => {
  const period = 4 * half;
  const m = (((v + half) % period) + period) % period;
  return m < 2 * half ? m - half : 3 * half - m;
};

/** Whatever isn't grass: grass is green over blue, and not as light as cobbles or water's glints @param {number} r @param {number} g @param {number} b */
const notGrass = (r, g, b) => !(g - b > 40 && g >= r - 6 && 0.3 * r + 0.59 * g + 0.11 * b < 205);

/**
 * Let the board's countryside show through a hex's grass, in place: the tile's own grass is kept
 * only near what makes the hex (a town's cobbles and houses, a river's water and banks), out to
 * `keep` hex radii from it with a wandering edge, and is clear beyond, so the hex ends in the
 * countryside round it rather than on its tile's rim. `pixels`: the hex, RGBA, `width` ×
 * `height` (a hex in a √3 : 2 box, as drawn tiles are)
 * @param {Uint8Array} pixels @param {number} width @param {number} height @param {number} keep @param {number} seed
 */
export function toCountryside(pixels, width, height, keep, seed) {
  const R = height / 2;
  const n = width * height;
  // The hex's own things, inside the hex: then only where most round about is, so the stones and
  // flowers in the grass and the tile's rim don't count, only the cobbles, the houses, the water
  const other = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const [r = 0, g = 0, b = 0, a = 0] = [pixels[4 * p], pixels[4 * p + 1], pixels[4 * p + 2], pixels[4 * p + 3]];
    const inside = hexReach((((p % width) + 0.5 - width / 2) / R), ((((p / width) | 0) + 0.5 - height / 2) / R)) < 0.97;
    other[p] = a > 0 && inside && notGrass(r, g, b) ? 1 : 0;
  }
  const k = Math.max(1, Math.round(0.04 * R));
  /** @param {Float32Array} from @param {number} step @param {number} along @param {number} lines @param {number} lineStep */
  const box = (from, step, along, lines, lineStep) => {
    const to = new Float32Array(n);
    for (let l = 0; l < lines; l++) {
      let t = 0;
      for (let j = 0; j < Math.min(along, k); j++) t += /** @type {number} */ (from[l * lineStep + j * step]);
      for (let i = 0; i < along; i++) {
        if (i + k < along) t += /** @type {number} */ (from[l * lineStep + (i + k) * step]);
        if (i - k - 1 >= 0) t -= /** @type {number} */ (from[l * lineStep + (i - k - 1) * step]);
        to[l * lineStep + i * step] = t / (2 * k + 1);
      }
    }
    return to;
  };
  const solid = box(box(other, 1, width, height, width), width, height, width, 1);
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) dist[p] = /** @type {number} */ (solid[p]) > 0.55 ? 0 : Infinity;
  // How far each pixel is from the hex's own things: a two-pass chamfer
  const D = Math.SQRT2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      let d = /** @type {number} */ (dist[p]);
      if (x > 0) d = Math.min(d, /** @type {number} */ (dist[p - 1]) + 1);
      if (y > 0) {
        d = Math.min(d, /** @type {number} */ (dist[p - width]) + 1);
        if (x > 0) d = Math.min(d, /** @type {number} */ (dist[p - width - 1]) + D);
        if (x < width - 1) d = Math.min(d, /** @type {number} */ (dist[p - width + 1]) + D);
      }
      dist[p] = d;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      let d = /** @type {number} */ (dist[p]);
      if (x < width - 1) d = Math.min(d, /** @type {number} */ (dist[p + 1]) + 1);
      if (y < height - 1) {
        d = Math.min(d, /** @type {number} */ (dist[p + width]) + 1);
        if (x < width - 1) d = Math.min(d, /** @type {number} */ (dist[p + width + 1]) + D);
        if (x > 0) d = Math.min(d, /** @type {number} */ (dist[p + width - 1]) + D);
      }
      dist[p] = d;
    }
  }
  // The edge wanders, by the hex
  const rand = rng(seed + 977);
  const [p1, p2, p3] = [rand() * 6.3, rand() * 6.3, rand() * 6.3];
  const soft = Math.max(1, R / 60);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const [u, v] = [(x - width / 2) / R, (y - height / 2) / R];
      const wander = 1 + 0.45 * Math.sin(7 * u + 3 * v + p1) * Math.sin(5 * v - 2 * u + p2) + 0.25 * Math.sin(13 * u - 11 * v + p3);
      const reach = keep * R * wander;
      const left = clamp((reach + soft - /** @type {number} */ (dist[p])) / (2 * soft), 0, 1);
      pixels[4 * p + 3] = Math.round(/** @type {number} */ (pixels[4 * p + 3]) * left);
    }
  }
}

/**
 * Lay a colour over a pixel, in place: `px` is premultiplied RGB with its alpha in px[3] (an
 * opaque pixel's alpha is 1, so it stays plain RGB)
 * @param {number[]} px @param {number} r @param {number} g @param {number} b @param {number} alpha
 */
function over(px, r, g, b, alpha) {
  const keep = 1 - alpha;
  px[0] = r * alpha + (px[0] ?? 0) * keep;
  px[1] = g * alpha + (px[1] ?? 0) * keep;
  px[2] = b * alpha + (px[2] ?? 0) * keep;
  px[3] = alpha + (px[3] ?? 0) * keep;
}

// Each forest tile's crowns, found once
/** @type {WeakMap<Pixels, [number, number][]>} */
const forestCrowns = new WeakMap();

/**
 * Grow a forest into a river hex from its edges facing one (`woods`), in place: the land in the
 * part of the hex facing each such edge, up to the bank, filled with the forest tile's trees, so
 * the forest runs straight into the river instead of ending at the hex line. `pixels`: the river hex, RGBA,
 * `width` × `height` (after toCountryside); `forest`: the forest tile, RGBA
 * @param {Uint8Array} pixels @param {number} width @param {number} height @param {boolean[]} woods
 * @param {number} seed @param {Pixels} forest
 */
export function growWoods(pixels, width, height, woods, seed, forest) {
  if (!woods.some(Boolean)) return;
  const R = height / 2, n = width * height;
  const { land: wood, solid } = landFacing(pixels, width, height, woods, seed);
  /** @param {number} p */
  const at = (p) => [((p % width) + 0.5 - width / 2) / R, (((p / width) | 0) + 0.5 - height / 2) / R];
  const rand = rng(seed + 4211);
  // Under the trees the forest's shade, then its crowns on a jittered grid, over the woods only
  let sources = forestCrowns.get(forest);
  if (!sources) {
    sources = findCrowns(forest, 0.24);
    forestCrowns.set(forest, sources);
  }
  const OR = forest.height / 2;
  // The crowns standing in the woods (their middles in it), which reach a little past them over
  // the land, never over the water
  /** @param {number} x @param {number} y */
  const inWood = (x, y) => {
    const [px, py] = [Math.round(x * R + width / 2 - 0.5), Math.round(y * R + height / 2 - 0.5)];
    return px >= 0 && py >= 0 && px < width && py < height && wood[py * width + px] === 1;
  };
  /** Whether a crown there is clear of the water and inside the hex, its shadow too @param {number} x @param {number} y @param {number} r */
  const fits = (x, y, r) =>
    [...Array(16).keys()].every((i) => {
      const a = (i * Math.PI) / 8;
      const [cx, cy] = [x + 0.015 + (r + 0.03) * Math.cos(a), y + 0.02 + (r + 0.03) * Math.sin(a)];
      const [px, py] = [Math.round(cx * R + width / 2 - 0.5), Math.round(cy * R + height / 2 - 0.5)];
      return hexReach(cx, cy) < 0.99 && px >= 0 && py >= 0 && px < width && py < height && !solid[py * width + px];
    });
  /** @type {{ x: number, y: number, r: number, sx: number, sy: number, cos: number, sin: number }[]} */
  const crowns = [];
  for (let gy = -1.1; gy < 1.1; gy += 0.15) {
    for (let gx = -1; gx < 1; gx += 0.15) {
      const [sx = 0, sy = 0] = sources[Math.floor(rand() * sources.length)] ?? [forest.width / 2, forest.height / 2];
      const angle = rand() * 2 * Math.PI;
      const [x, y] = [gx + (rand() - 0.5) * 0.1, gy + (rand() - 0.5) * 0.1];
      // A whole tree or none: smaller by the water or the hex's edge if it must, never cut by them
      const r = [0.1 + 0.05 * rand(), 0.075, 0.055].find((size) => inWood(x, y) && fits(x, y, size));
      if (r) crowns.push({ x, y, r, sx, sy, cos: Math.cos(angle), sin: Math.sin(angle) });
    }
  }
  const b = [0, 0, 0, 0];
  for (let p = 0; p < n; p++) {
    if (solid[p]) continue;
    const [x = 0, y = 0] = at(p);
    if (!wood[p] && hexReach(x, y) > 0.985) continue;
    // In the woods, the forest floor; outside, the land as it is, under the crowns' rims
    const px = wood[p] ? [SHADE[0], SHADE[1], SHADE[2], 1] : [0, 0, 0, 0];
    for (const crown of crowns) {
      const [dx, dy] = [x - crown.x, y - crown.y];
      if (Math.abs(dx) > crown.r + 0.05 || Math.abs(dy) > crown.r + 0.05) continue;
      const shadow = clamp((crown.r - Math.hypot(dx - 0.03, dy - 0.04)) / 0.025, 0, 1);
      if (shadow > 0) over(px, 0, 0, 0, 0.25 * shadow);
      const dist = Math.hypot(dx, dy);
      const w = clamp((crown.r - dist) / 0.025, 0, 1);
      if (w <= 0) continue;
      sample(forest, crown.sx + (dx * crown.cos - dy * crown.sin) * OR, crown.sy + (dx * crown.sin + dy * crown.cos) * OR, b);
      const rim = dist / crown.r;
      const shade = 1.04 - 0.3 * rim * rim - (0.12 * (0.6 * dx + 0.8 * dy)) / crown.r;
      over(px, clamp((b[0] ?? 0) * shade, 0, 255), clamp((b[1] ?? 0) * shade, 0, 255), clamp((b[2] ?? 0) * shade, 0, 255), w);
    }
    const alpha = px[3] ?? 0;
    if (alpha <= 0) continue;
    // Laid over what's there (premultiplied), opaque where the crowns or the woods cover it
    const o = 4 * p;
    const under = /** @type {number} */ (pixels[o + 3]) / 255;
    const total = alpha + under * (1 - alpha);
    for (let c = 0; c < 3; c++) pixels[o + c] = ((px[c] ?? 0) + /** @type {number} */ (pixels[o + c]) * under * (1 - alpha)) / total;
    pixels[o + 3] = 255 * total;
  }
}

// The forest floor between its crowns
/** @type {[number, number, number]} */
const SHADE = [44, 72, 22];

/**
 * The land of a river hex in the part facing some of its edges (`edges`): what isn't water (nor a
 * bridge) inside the hex, nearest by angle to one of those edges (the line between the parts
 * wanders a little), and reached from the edge without crossing the water. `solid`: the water
 * @param {Uint8Array} pixels @param {number} width @param {number} height @param {boolean[]} edges @param {number} seed
 */
function landFacing(pixels, width, height, edges, seed) {
  const R = height / 2, n = width * height;
  // The water (and a bridge): what isn't grass, where most round about isn't
  const solid = new Uint8Array(n);
  const k = Math.max(1, Math.round(0.03 * R));
  const other = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const [r = 0, g = 0, b = 0] = [pixels[4 * p], pixels[4 * p + 1], pixels[4 * p + 2]];
    other[p] = notGrass(r, g, b) ? 1 : 0;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let t = 0, c = 0;
      for (let dy = -k; dy <= k; dy++) {
        for (let dx = -k; dx <= k; dx++) {
          const [xx, yy] = [x + dx, y + dy];
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          t += /** @type {number} */ (other[yy * width + xx]);
          c++;
        }
      }
      solid[y * width + x] = t / c > 0.55 ? 1 : 0;
    }
  }
  /** @param {number} p */
  const at = (p) => [((p % width) + 0.5 - width / 2) / R, (((p / width) | 0) + 0.5 - height / 2) / R];
  const rand = rng(seed + 4211);
  const [p1, p2] = [rand() * 6.3, rand() * 6.3];
  /** Inside the hex and in a part facing one of the edges @param {number} x @param {number} y */
  const facing = (x, y) => {
    if (hexReach(x, y) > 0.985) return false;
    const r = Math.hypot(x, y);
    const wander = (10 * Math.sin(9 * r + p1) + 6 * Math.sin(17 * r + p2)) * (Math.PI / 180);
    const angle = Math.atan2(y, x) + wander;
    const d = ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
    return edges[d] === true;
  };
  // Flooded from the edges over the land, never across the water
  const land = new Uint8Array(n);
  const stack = [];
  for (let p = 0; p < n; p++) {
    const [x = 0, y = 0] = at(p);
    if (solid[p] || !facing(x, y)) continue;
    for (let d = 0; d < 6; d++) {
      const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[d]);
      if (edges[d] && INNER - (x * nx + y * ny) < 0.08) {
        land[p] = 1;
        stack.push(p);
        break;
      }
    }
  }
  while (stack.length) {
    const p = /** @type {number} */ (stack.pop());
    const x = p % width;
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
      if (q < 0 || q >= n || land[q] || solid[q]) continue;
      const [qx = 0, qy = 0] = at(q);
      if (!facing(qx, qy)) continue;
      land[q] = 1;
      stack.push(q);
    }
  }
  return { land, solid };
}

/**
 * The ridge of the hill across edge `shape.edge`, drawn in this hex's box where it runs on past
 * that edge (RGBA, the hex's size): the hill's own outline, so the two meet at the hex line
 * @param {import("./joinedHills.mjs").RidgeMaker} hillMaker @param {import("./boardPlan.mjs").HillShape} shape
 * @param {{ x: number, y: number }} center this hex's centre on the board
 */
export const hillOver = (hillMaker, { edge, open, toRiver, seed }, center) =>
  hillMaker(open, seed, center, { x: SQRT3 * (DIRS[edge]?.[0] ?? 0), y: SQRT3 * (DIRS[edge]?.[1] ?? 0) }, toRiver);

/**
 * Run a hill on into a river hex from its edge facing one (`edge`), in place: `hill` is the hill's
 * ridge where it runs on past that edge (hillOver: it bulges a little past it, its cliffs closing
 * round), laid over the land short of the water, so the hill comes down towards the river's bank
 * instead of ending at the hex line
 * @param {Uint8Array} pixels @param {number} width @param {number} height @param {number} edge
 * @param {number} seed @param {Uint8Array} hill
 */
export function growHill(pixels, width, height, edge, seed, hill) {
  void edge;
  const n = width * height;
  // The hill's own outline keeps it to the part of the hex by its edge: only the water stops it
  const { land, solid } = landFacing(pixels, width, height, [true, true, true, true, true, true], seed);
  // How far each pixel is from the water, for a strip of bank kept along it
  const near = Math.max(2, Math.round(height / 40));
  for (let p = 0; p < n; p++) {
    if (!land[p]) continue;
    const x = p % width, y = (p / width) | 0;
    let wet = false;
    for (let dy = -near; dy <= near && !wet; dy++) {
      for (let dx = -near; dx <= near; dx++) {
        const [xx, yy] = [x + dx, y + dy];
        if (xx >= 0 && yy >= 0 && xx < width && yy < height && solid[yy * width + xx]) {
          wet = true;
          break;
        }
      }
    }
    if (wet) continue;
    const o = 4 * p;
    const a = /** @type {number} */ (hill[o + 3]) / 255;
    if (a <= 0) continue;
    const under = /** @type {number} */ (pixels[o + 3]) / 255;
    const total = a + under * (1 - a);
    for (let c = 0; c < 3; c++) pixels[o + c] = (/** @type {number} */ (hill[o + c]) * a + /** @type {number} */ (pixels[o + c]) * under * (1 - a)) / total;
    pixels[o + 3] = 255 * total;
  }
}

/**
 * A lone tree or two of a forest standing out on the open countryside next to it
 * @typedef {{ key: string, toward: boolean[], seed: number }} SpillHex
 * `toward`: the six edges (0 = east, clockwise) the hex shares with the forest
 * @typedef {(hex: SpillHex) => Uint8Array} SpillMaker
 */

/**
 * Returns a function that draws the trees a forest stands here and there on a hex of countryside
 * next to it, by the edges it shares with it: by each, one tree, or two, set a little way out from
 * the forest (some just touching its edge, some on their own), cut from the forest `tile` as the
 * joined forests' crowns are, each with its shadow. The rest is transparent: the art round them
 * shows. A square of `scale·tileHeight` RGBA pixels round the hex's middle, in the board's
 * orientation
 * @param {Pixels} tile
 * @param {number} tileWidth
 * @param {number} tileHeight
 * @param {number} [scale]
 * @returns {SpillMaker}
 */
export function spillMaker(tile, tileWidth, tileHeight, scale = 2) {
  void tileWidth;
  const TW = scale * tileHeight, TH = scale * tileHeight, TR = TH / 2;
  const OR = tile.height / 2;
  const trees = findCrowns(tile, 0.24);

  return ({ key, toward }) => {
    /** @type {{ x: number, y: number, r: number, sx: number, sy: number, cos: number, sin: number, lumps: number[] }[]} */
    const crowns = [];
    for (let d = 0; d < 6; d++) {
      if (!toward[d]) continue;
      const r0 = rng(pickFor(key, 31 + d, 1 << 30));
      const count = 1 + Math.floor(r0() * 2);
      const [nx = 0, ny = 0] = /** @type {number[]} */ (DIRS[d]);
      for (let i = 0; i < count; i++) {
        const r = 0.13 + 0.07 * r0();
        // Along the edge, off its corners, each in its own stretch of it; out from the forest
        // from just touching it to about a third of the way across the hex
        const span = 0.45 - r;
        const s = -span + ((2 * span) / count) * (i + 0.15 + 0.7 * r0());
        const depth = 0.7 * r + 0.28 * r0();
        const [x, y] = [nx * (INNER - depth) - ny * s, ny * (INNER - depth) + nx * s];
        const [sx = 0, sy = 0] = trees[Math.floor(r0() * trees.length)] ?? [tile.width / 2, tile.height / 2];
        const angle = r0() * 2 * Math.PI;
        crowns.push({ x, y, r, sx, sy, cos: Math.cos(angle), sin: Math.sin(angle), lumps: [r0() * 6.3, r0() * 6.3, 0.05 + 0.04 * r0()] });
      }
    }
    // Light from the top left: crowns cast their shadow down and to the right
    const [shx, shy] = [0.03, 0.04];
    const out = new Uint8Array(TW * TH * 4);
    const b = [0, 0, 0, 0];
    for (let y = 0; y < TH; y++) {
      const hy = (y - TH / 2 + 0.5) / TR;
      for (let x = 0; x < TW; x++) {
        const hx = (x - TW / 2 + 0.5) / TR;
        // Built up over transparent: the shadows, then the crowns (premultiplied)
        const px = [0, 0, 0, 0];
        for (const crown of crowns) {
          const [dx, dy] = [hx - crown.x, hy - crown.y];
          if (Math.abs(dx) > crown.r + 0.1 || Math.abs(dy) > crown.r + 0.1) continue;
          const [l1 = 0, l2 = 0, lump = 0] = crown.lumps;
          const theta = Math.atan2(dy, dx);
          const edgeR = crown.r * (1 + lump * Math.sin(5 * theta + l1) + 0.6 * lump * Math.sin(3 * theta + l2));
          const soft = 0.02;
          const shadow = 0.3 * clamp((edgeR - Math.hypot(dx - shx, dy - shy)) / soft, 0, 1);
          if (shadow > 0) over(px, 0, 0, 0, shadow);
          const dist = Math.hypot(dx, dy);
          const w = clamp((edgeR - dist) / soft, 0, 1);
          if (w <= 0) continue;
          const [u, v] = [crown.sx + (dx * crown.cos - dy * crown.sin) * OR, crown.sy + (dx * crown.sin + dy * crown.cos) * OR];
          const t = sample(tile, u, v, b);
          const rim = dist / edgeR;
          const shade = 1.04 - 0.3 * rim * rim - (0.12 * (0.6 * dx + 0.8 * dy)) / edgeR;
          over(px, clamp((t[0] ?? 0) * shade, 0, 255), clamp((t[1] ?? 0) * shade, 0, 255), clamp((t[2] ?? 0) * shade, 0, 255), w);
        }
        const alpha = px[3] ?? 0;
        if (alpha <= 0) continue;
        out.set([(px[0] ?? 0) / alpha, (px[1] ?? 0) / alpha, (px[2] ?? 0) / alpha, 255 * alpha], 4 * (y * TW + x));
      }
    }
    return out;
  };
}
