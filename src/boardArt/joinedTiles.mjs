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
 * town's house stands over, or -1; `turns`: the tile turned × 60° clockwise
 * @typedef {{ key: string, open: boolean[], bare: boolean[], spill: number, turns: number, seed: number }} JoinedHex
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
 * The town tile's houses: each a mask over the tile (1 on the house, its outline and the shadow
 * under it), found by their blue-grey roofs and dark outlines
 * @param {Pixels} tile
 */
function findHouses(tile) {
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
  for (const house of houses) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const scale = attempt < 200 ? 1 : 0.85;
      const angle = rand() * 2 * Math.PI, dist = Math.sqrt(rand()) * 0.5 * OR, at = rand() * 2 * Math.PI;
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
 * @returns {JoinedMaker}
 */
export function joinedTileMaker(type, tile, tileWidth, tileHeight, scale = 2) {
  const TW = scale * tileWidth, TH = scale * tileHeight, TR = TH / 2;
  const OR = tile.height / 2;
  const { houses, roofs } = type === "town" ? findHouses(tile) : { houses: [], roofs: new Float32Array() };
  const ground = type === "town" ? emptyTown(tile, [roofs, ...houses.map((h) => h.mask)]) : tile;
  const trees = type === "forest" ? findCrowns(tile, 0.24) : [];
  const inside = new Uint8Array(houses.length ? tile.width * tile.height : 0);
  for (let p = 0; p < inside.length; p++) inside[p] = hexReach(((p % tile.width) - tile.width / 2) / OR, (((p / tile.width) | 0) - tile.height / 2) / OR) < 0.8 ? 1 : 0;
  const px = 1 / TR;

  const OW = Math.round(OVERFLOW * TW), OH = Math.round(OVERFLOW * TH);

  return ({ key, open, bare, spill, turns, seed }) => {
    const rand = rng(seed);
    // From the board's orientation to the tile's: turned back
    const turn = (-turns * Math.PI) / 3;
    const [ct, st] = [Math.cos(turn), Math.sin(turn)];

    // A town's house standing over a bare edge (one of the two smaller ones), then the rest laid
    // out again, the two smallest twice where there's room: the best of a few tries
    const spilt = houses.length && spill >= 0 ? spillHouse(/** @type {House} */ (houses[houses.length - 1 - Math.floor(rand() * 2)]), (((spill - turns) % 6) + 6) % 6, tile.width, tile.height, rand) : null;
    /** @type {Placed[]} */
    let placed = [];
    const wanted = [...houses, ...houses.slice(-2)];
    for (let i = 0; i < 8 && placed.length < wanted.length; i++) {
      const layout = layHouses(wanted, tile.width, tile.height, rand, inside, spilt);
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
    /** The tile (its houses re-laid) at a point in hex radii, in the board's orientation @param {number} x @param {number} y */
    const tileAt = (x, y) => {
      const [u = 0, v = 0] = toTile(x, y);
      sample(ground, u, v, a);
      a[3] = 1;
      if (!placed.length) return a;
      let shade = 1;
      for (const [i, h] of placed.entries()) {
        const [du, dv] = [u - h.x - shadowShift, v - h.y - shadowShift];
        const s = sample(/** @type {Pixels} */ (masks[i]), h.cx + (du * h.cos + dv * h.sin) / h.scale, h.cy + (dv * h.cos - du * h.sin) / h.scale, m)[0] ?? 0;
        shade *= 1 - 0.4 * s;
      }
      for (let c = 0; c < 3; c++) a[c] = /** @type {number} */ (a[c]) * shade;
      for (const [i, h] of placed.entries()) {
        const [du, dv] = [u - h.x, v - h.y];
        const [hu, hv] = [h.cx + (du * h.cos + dv * h.sin) / h.scale, h.cy + (dv * h.cos - du * h.sin) / h.scale];
        const w = sample(/** @type {Pixels} */ (masks[i]), hu, hv, m)[0] ?? 0;
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
        // A faint hex line where the terrain carries on
        if (open[edge] && nearest < 1.5 * scale * px) over(c, HEX_LINE[0] ?? 0, HEX_LINE[1] ?? 0, HEX_LINE[2] ?? 0, 0.45);
        // The crowns over the edges
        paintCrowns(crowns, hx, hy, c);
        out.set([c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, 255], 4 * (y * TW + x));
      }
    }

    if (!spilt && !spillCrowns.length) return { tile: out, overflow: null };
    // What spills out: the house over its edge, whole, and the trees over the countryside
    const overflow = new Uint8Array(OW * OH * 4);
    const spiltMask = spilt ? maskOf(spilt) : null;
    const px4 = [0, 0, 0, 0];
    for (let y = 0; y < OH; y++) {
      const hy = (y - OH / 2 + 0.5) / TR;
      for (let x = 0; x < OW; x++) {
        const hx = (x - OW / 2 + 0.5) / TR;
        px4.fill(0);
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
