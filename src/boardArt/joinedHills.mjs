// boardArt/joinedHills.mjs
// Hills that join the hills next to them into a ridge, made from a painted hill tile.
// The plateau's outline runs out through every edge shared with another hill, as a lake's shore
// does (shoreCurves in terrainTiles.mjs), wide enough there to read as one ridge. The tile's
// cliff ring, measured at every angle, is unrolled along that outline, so the cliffs are the
// tile's own strokes. The plateau is a texture laid across the whole board, so it carries on over
// the hex lines; a little past the cliffs' foot the hill is clear, at a wandering line, so the
// board's countryside shows round it. Where it joins another hill a faint hex line crosses it.
// A lone hill is made the same way, its outline running out through no edge.
// Only the pixel work, in plain JavaScript: scripts/joined-hills.mjs reads and writes the images
// with sharp for `npm run board`, and the app (drawBoard.ts) with a canvas, so a ridge is made
// the same way in both.
import { R, edgeDir, rng, shoreCurves } from "./terrainTiles.mjs";

/**
 * An image's pixels, row by row, `channels` values each (RGB or RGBA)
 * @typedef {{ data: ArrayLike<number>, width: number, height: number, channels: number }} Pixels
 */
/**
 * `offset`: draw the hill of the hex that far away instead (in hex radii; its outline only, the
 * textures staying where `center` is on the board), for a hill running on into a river beside it
 * `toRiver`: which of the `open` edges lead into a river rather than another hill; `cliffs`: the
 * edges a coastal bluff faces (when present, its other sides become grassy slopes)
 * @typedef {(open: boolean[], seed: number, center: { x: number, y: number }, offset?: { x: number, y: number }, toRiver?: boolean[], cliffs?: boolean[]) => Uint8Array} RidgeMaker
 */

const SQRT3 = Math.sqrt(3);
// How far from the middle of a shared edge towards its corners the plateau crosses it
const NECK = 0.68;
// The board's hex line, drawn faintly where the ridge crosses one
export const HEX_LINE = [0x6f, 0x7a, 0x48];
// The six edges' outward directions (0 = east, clockwise)
const EDGE_DIRS = [0, 1, 2, 3, 4, 5].map((d) => edgeDir(d));

/**
 * The middle of the hill tile's plateau (the tile read at `width` × `height`, twice its size),
 * which is repeated over the ridges: the caller cuts it out and blurs it a little (sigma 1.2)
 * @param {number} width
 * @param {number} height
 */
export const plateauCrop = (width, height) => {
  const r = height / 2;
  return {
    left: Math.round(width / 2 - 0.28 * r),
    top: Math.round(height / 2 - 0.28 * r),
    width: Math.round(0.56 * r),
    height: Math.round(0.56 * r),
  };
};

/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Returns a function that draws one hill hex `scale` times the board's size, `scale·tileWidth` ×
 * `scale·tileHeight` RGBA pixels: `(open, seed, center)` with `open` the six edges (0 = east,
 * clockwise) shared with another hill and `center` the hex's centre on the board, in pixels.
 * `npm run board` builds at twice the size and brings it down, so it blurs less; the app builds at
 * the board's size, four times quicker.
 * `tile`: the hill tile at twice its size; `plateau`: its plateauCrop, blurred; `grass`: the grass
 * texture at twice its size; `fullTile` (no longer used: the tile's bevel isn't drawn) the hill tile
 * at scale·tileWidth × scale·tileHeight
 * @param {{ tile: Pixels, plateau: Pixels, grass: Pixels, fullTile: Pixels }} images
 * @param {number} tileWidth
 * @param {number} tileHeight
 * @param {number} [scale]
 * @returns {RidgeMaker}
 */
export function joinedHillMaker({ tile, plateau: plateauImage, grass }, tileWidth, tileHeight, scale = 2) {
  const OW = tile.width, OH = tile.height, OR = OH / 2, TC = tile.channels;
  const tileData = tile.data;
  /** @param {number} x @param {number} y @param {number[]} out */
  const sample = (x, y, out) => {
    x = Math.max(0, Math.min(OW - 1.001, x));
    y = Math.max(0, Math.min(OH - 1.001, y));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = TC * (y0 * OW + x0);
    for (let c = 0; c < 3; c++) {
      const top = /** @type {number} */ (tileData[i + c]) * (1 - fx) + /** @type {number} */ (tileData[i + TC + c]) * fx;
      const bottom = /** @type {number} */ (tileData[i + TC * OW + c]) * (1 - fx) + /** @type {number} */ (tileData[i + TC * OW + TC + c]) * fx;
      out[c] = top * (1 - fy) + bottom * fy;
    }
    return out;
  };
  const tmp = [0, 0, 0];
  /** @param {number} x @param {number} y */
  const lum = (x, y) => {
    const c = sample(x, y, tmp);
    return 0.299 * (c[0] ?? 0) + 0.587 * (c[1] ?? 0) + 0.114 * (c[2] ?? 0);
  };

  // The cliff ring at each degree, from its top (rIn) to its foot (rOut): the darkest stretch of
  // the ray between 0.4 and 0.92 R, out to where it turns half-way back to the plateau's colour
  const rIn = new Float32Array(360), rOut = new Float32Array(360);
  for (let a = 0; a < 360; a++) {
    const ca = Math.cos((a * Math.PI) / 180), sa = Math.sin((a * Math.PI) / 180);
    /** @type {[number, number][]} */
    const ray = [];
    for (let r = 0.1 * OR; r < 0.96 * OR; r += 0.5) ray.push([r, lum(OW / 2 + ca * r, OH / 2 + sa * r)]);
    /** @type {[number, number][]} */
    const smooth = ray.map(([r], i) => {
      const near = ray.slice(Math.max(0, i - 16), i + 17);
      return [r, near.reduce((t, [, l]) => t + l, 0) / near.length];
    });
    const at = (/** @type {number} */ i) => /** @type {[number, number]} */ (smooth[i]);
    let low = -1;
    smooth.forEach(([r, l], i) => {
      if (r > 0.4 * OR && r < 0.92 * OR && (low < 0 || l < at(low)[1])) low = i;
    });
    const middle = smooth.filter(([r]) => r < 0.3 * OR);
    const plateau = middle.reduce((t, [, l]) => t + l, 0) / middle.length;
    const half = (at(low)[1] + plateau) / 2;
    let i0 = low, i1 = low;
    while (i0 > 0 && at(i0 - 1)[1] < half) i0--;
    while (i1 < smooth.length - 1 && at(i1 + 1)[1] < half) i1++;
    rIn[a] = at(i0)[0];
    rOut[a] = at(i1)[0];
  }
  // Smoothed round the ring, kept in 32-bit floats as the script always has (so its boards don't change)
  /** @param {Float32Array} arr @param {number} k */
  const around = (arr, k) =>
    arr.map((_, i) => {
      let t = 0;
      for (let j = -k; j <= k; j++) t += /** @type {number} */ (arr[(i + j + 360) % 360]);
      return t / (2 * k + 1);
    });
  const top = around(around(rIn, 15).map((v) => clamp(v, 0.45 * OR, 0.62 * OR)), 8);
  const foot = around(rOut.map((v, i) => clamp(v, /** @type {number} */ (top[i]) + 0.16 * OR, 0.84 * OR)), 8);
  /** @param {Float32Array} arr @param {number} deg */
  const at = (arr, deg) => {
    const a = ((deg % 360) + 360) % 360, i = Math.floor(a), f = a - i;
    return /** @type {number} */ (arr[i]) * (1 - f) + /** @type {number} */ (arr[(i + 1) % 360]) * f;
  };

  // The plateau texture: the middle of the tile's plateau, slightly blurred and its contrast
  // softened so its mirrored repeats don't show
  const PC = plateauImage.channels;
  const plateau = Uint8Array.from(plateauImage.data);
  const mean = [0, 1, 2].map((c) => {
    let t = 0;
    for (let i = c; i < plateau.length; i += PC) t += /** @type {number} */ (plateau[i]);
    return (PC * t) / plateau.length;
  });
  const [m0 = 0, m1 = 0, m2 = 0] = mean;
  // Dark specks would repeat as mirrored pairs: lift them towards the plateau's colour
  const meanLum = 0.299 * m0 + 0.587 * m1 + 0.114 * m2;
  for (let i = 0; i < plateau.length; i += PC) {
    const l = 0.299 * /** @type {number} */ (plateau[i]) + 0.587 * /** @type {number} */ (plateau[i + 1]) + 0.114 * /** @type {number} */ (plateau[i + 2]);
    const t = clamp((meanLum - 12 - l) / 20, 0, 0.85);
    for (let c = 0; c < 3; c++) plateau[i + c] = /** @type {number} */ (plateau[i + c]) * (1 - t) + /** @type {number} */ (mean[c]) * t;
  }
  // Built at `scale` times the board's size; k turns those pixels into the tile's
  const TW = scale * tileWidth, TH = scale * tileHeight, TR = TH / 2, k = OR / TR;
  const PLATEAU_REACH = 0.16 * TR + 1;
  /**
   * A texture repeated over the board, mirrored so it has no seams
   * @param {Pixels} image @param {number} bx @param {number} by @param {number[]} out
   * @param {number} contrast @param {number[]} base
   */
  const mirrored = ({ data, width: w, height: h, channels }, bx, by, out, contrast, base) => {
    let u = (bx * k) % (2 * w), v = (by * k) % (2 * h);
    if (u >= w) u = 2 * w - 1 - u;
    if (v >= h) v = 2 * h - 1 - v;
    const i = channels * ((v | 0) * w + (u | 0));
    for (let c = 0; c < 3; c++) out[c] = /** @type {number} */ (base[c]) + (/** @type {number} */ (data[i + c]) - /** @type {number} */ (base[c])) * contrast;
    return out;
  };
  /** @type {Pixels} */
  const plateauTexture = { ...plateauImage, data: plateau };
  // Past these distances from the plateau's outline a pixel is the plateau's texture alone (inside)
  // or the grass alone (outside), whichever point of the outline is the nearest: the search for
  // it gives up there. A pixel further than 0.16 TR inside, or whose cliff reaches the foot's
  // blend at every angle outside; one pixel more on each, for the rounding
  let deepestCliff = 0;
  for (let i = 0; i < 360; i++) deepestCliff = Math.max(deepestCliff, /** @type {number} */ (foot[i]) - /** @type {number} */ (top[i]));
  const GRASS_REACH = (deepestCliff + 6) / k + 1;

  return (open, seed, center, offset, toRiver, cliffs) => {
    const rand = rng(seed);
    // The plateau's outline, as points at the build's scale, with the distance along it
    /** @type {[number, number][]} */
    const pts = [];
    // Into a river it only bulges a little way, its cliffs closing well short of the water
    const outAt = (/** @type {number} */ d) => (toRiver?.[d] ? 1.02 : 1.35);
    for (const curve of shoreCurves(open, rand, { neck: NECK, wobble: true, outAt })) {
      const [p0, p1, p2, p3] = /** @type {[number, number][]} */ (curve);
      for (let j = 0; j < 60; j++) {
        const t = j / 60, u = 1 - t;
        const [x, y] = [0, 1].map((c) => u ** 3 * (p0?.[c] ?? 0) + 3 * u * u * t * (p1?.[c] ?? 0) + 3 * u * t * t * (p2?.[c] ?? 0) + t ** 3 * (p3?.[c] ?? 0));
        pts.push([((x ?? 0) * TR) / R + (offset?.x ?? 0) * TR, ((y ?? 0) * TR) / R + (offset?.y ?? 0) * TR]);
      }
    }
    const n = pts.length;
    const px0 = (/** @type {number} */ i) => /** @type {[number, number]} */ (pts[i]);
    const along = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) along[i] = /** @type {number} */ (along[i - 1]) + Math.hypot(px0(i % n)[0] - px0(i - 1)[0], px0(i % n)[1] - px0(i - 1)[1]);
    const length = /** @type {number} */ (along[n]);
    // The ring goes round the outline about as many times as it fits, from a random start
    const laps = Math.max(1, Math.round(length / (2 * Math.PI * 0.7 * TR)));
    const start = rand() * 360;

    // The points sorted by x, so the search for the nearest one at each pixel looks outwards from
    // its x and stops where the points are further away across than the nearest found so far
    const order = Int32Array.from(pts.keys()).sort((i, j) => px0(i)[0] - px0(j)[0] || i - j);
    const sx = Float64Array.from(order, (i) => px0(i)[0]);
    const sdy2 = new Float64Array(n);
    let guess = 0;

    const ox = scale * center.x - TW / 2, oy = scale * center.y - TH / 2;
    const out = new Uint8Array(TW * TH * 4);
    const a = [0, 0, 0], b = [0, 0, 0];
    for (let y = 0; y < TH; y++) {
      const hy = y - TH / 2 + 0.5;
      // Where this row crosses the outline (even-odd: a pixel is inside with an odd number of crossings to its right)
      const crossings = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = px0(i), [xj, yj] = px0(j);
        if (yi > hy !== yj > hy) crossings.push(((xj - xi) * (hy - yi)) / (yj - yi) + xi);
      }
      for (let k = 0; k < n; k++) {
        const dy = px0(/** @type {number} */ (order[k]))[1] - hy;
        sdy2[k] = dy * dy;
      }
      let from = 0;
      for (let x = 0; x < TW; x++) {
        const hx = x - TW / 2 + 0.5;
        let inside = false;
        for (const cross of crossings) if (hx < cross) inside = !inside;
        // The nearest point of the outline within reach, the first one listed when two are as
        // near (as measuring every point finds it): starting from the last pixel's, every point
        // nearer across than the nearest so far is measured
        const reach = inside ? PLATEAU_REACH : GRASS_REACH;
        const [gx, gy] = px0(guess);
        const guessed = (gx - hx) * (gx - hx) + (gy - hy) * (gy - hy);
        let best = reach * reach, bi = -1;
        if (guessed < best) {
          best = guessed;
          bi = guess;
        }
        while (from < n && /** @type {number} */ (sx[from]) < hx) from++;
        for (let kk = from; kk < n; kk++) {
          const dx = /** @type {number} */ (sx[kk]) - hx, dx2 = dx * dx;
          if (dx2 > best) break;
          const d = dx2 + /** @type {number} */ (sdy2[kk]), i = /** @type {number} */ (order[kk]);
          if (d < best || (d === best && i < bi)) {
            best = d;
            bi = i;
          }
        }
        for (let kk = from - 1; kk >= 0; kk--) {
          const dx = /** @type {number} */ (sx[kk]) - hx, dx2 = dx * dx;
          if (dx2 > best) break;
          const d = dx2 + /** @type {number} */ (sdy2[kk]), i = /** @type {number} */ (order[kk]);
          if (d < best || (d === best && i < bi)) {
            best = d;
            bi = i;
          }
        }

        let w, near, far;
        // Past the cliff's foot the hill gives way to the board's countryside, at a wandering line
        let alpha = 1;
        if (bi < 0) {
          if (!inside) alpha = 0;
          // Out of reach of the outline: the texture alone (what the blend below gives at w = 1)
          w = 1;
          near = a;
          far = inside ? mirrored(plateauTexture, ox + x, oy + y, b, 0.45, mean) : mirrored(grass, ox + x, oy + y, b, 1, [0, 0, 0]);
        } else {
          guess = bi;
          const dist = Math.sqrt(best);
          const deg = start + (360 * laps * /** @type {number} */ (along[bi])) / length;
          const ca = Math.cos((deg * Math.PI) / 180), sa = Math.sin((deg * Math.PI) / 180);
          const rTop = at(top, deg), rFoot = at(foot, deg);
          if (inside) {
            // The plateau: the tile's own lip near the cliff, the board-wide texture further in
            const r = Math.max(0.1 * OR, rTop - dist * k);
            near = sample(OW / 2 + ca * r, OH / 2 + sa * r, a);
            far = mirrored(plateauTexture, ox + x, oy + y, b, 0.45, mean);
            w = Math.min(1, dist / (0.16 * TR));
          } else {
            const r = rTop + dist * k;
            const rc = Math.min(r, rFoot + 3);
            far = mirrored(grass, ox + x, oy + y, b, 1, [0, 0, 0]);
            const angle = (Math.atan2(hy, hx) * 180) / Math.PI;
            const edge = Math.round((((angle % 360) + 360) % 360) / 60) % 6;
            const bluffSide = cliffs?.some(Boolean) ? cliffs[edge] : true;
            if (bluffSide) {
              // Keep the source tile's rock face toward the sea or beach.
              near = sample(OW / 2 + ca * rc, OH / 2 + sa * rc, a);
              w = clamp((r - rFoot) / 6, 0, 1);
            } else {
              // On the landward sides, turn the cliff ring into a grassy slope.
              near = sample(OW / 2 + ca * rTop, OH / 2 + sa * rTop, a);
              w = clamp((r - rTop) / Math.max(1, rFoot - rTop), 0, 1);
            }
            const [u, v] = [(ox + x) / TR, (oy + y) / TR];
            const keep = -3 + 3 * Math.sin(7 * u + 3 * v) * Math.sin(5 * v - 2 * u + 1.3);
            alpha = clamp(1 - (r - rFoot - keep) / 5, 0, 1);
          }
        }
        const o = 4 * (y * TW + x);
        for (let c = 0; c < 3; c++) out[o + c] = /** @type {number} */ (near[c]) * (1 - w) + /** @type {number} */ (far[c]) * w;
        out[o + 3] = Math.round(255 * alpha);

        // A faint hex line where the ridge crosses into another hill
        const angle = (Math.atan2(hy, hx) * 180) / Math.PI;
        const d = Math.round((((angle % 360) + 360) % 360) / 60) % 6;
        const [nx, ny] = /** @type {[number, number]} */ (EDGE_DIRS[d]);
        const toEdge = ((SQRT3 / 2) * TH) / 2 - (hx * nx + hy * ny);
        if (open[d] && !toRiver?.[d] && !offset && toEdge < 1.5 * scale) {
          for (let c = 0; c < 3; c++) out[o + c] = /** @type {number} */ (out[o + c]) * 0.55 + /** @type {number} */ (HEX_LINE[c]) * 0.45;
        }
      }
    }
    return out;
  };
}

/**
 * Blur an image a little (a Gaussian, edges repeated), as sharp's blur does for the script
 * @param {Pixels} image
 * @param {number} sigma
 * @returns {Pixels}
 */
export function blurPixels({ data, width, height, channels }, sigma) {
  const radius = Math.ceil(3 * sigma);
  const weights = Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const total = weights.reduce((t, w) => t + w, 0);
  /** @param {ArrayLike<number>} source @param {number} dx @param {number} dy */
  const pass = (source, dx, dy) => {
    const result = new Float32Array(width * height * channels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          let t = 0;
          for (let i = -radius; i <= radius; i++) {
            const sx = clamp(x + i * dx, 0, width - 1), sy = clamp(y + i * dy, 0, height - 1);
            t += /** @type {number} */ (source[(sy * width + sx) * channels + c]) * /** @type {number} */ (weights[i + radius]);
          }
          result[(y * width + x) * channels + c] = t / total;
        }
      }
    }
    return result;
  };
  return { data: Uint8Array.from(pass(pass(data, 1, 0), 0, 1), Math.round), width, height, channels };
}
