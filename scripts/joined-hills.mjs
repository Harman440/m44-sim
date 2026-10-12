// Hills that join the hills next to them into a ridge, made from a painted hill tile.
// The plateau's outline runs out through every edge shared with another hill, as a lake's shore
// does (shoreCurves in terrain-tiles.mjs), wide enough there to read as one ridge. The tile's
// cliff ring, measured at every angle, is unrolled along that outline, so the cliffs are the
// tile's own strokes. The plateau and the grass at the foot of the cliffs are textures laid
// across the whole board, so they carry on over the hex lines. The tile's bevel stays on the
// edges that don't join a hill; where one does, a faint hex line crosses the ridge.
import sharp from "sharp";
import { R, edgeDir, rng, shoreCurves } from "./terrain-tiles.mjs";

const SQRT3 = Math.sqrt(3);
// How far from the middle of a shared edge towards its corners the plateau crosses it
const NECK = 0.68;
// The board's hex line, drawn faintly where the ridge crosses one
const HEX_LINE = [0x6f, 0x7a, 0x48];

/**
 * Reads the hill tile and the grass texture (both at the tiles' scale) and returns a function
 * that draws one hill hex `tileWidth` × `tileHeight`: `(open, seed, center)` with `open` the six
 * edges (0 = east, clockwise) shared with another hill and `center` the hex's centre on the board.
 */
export async function joinedHills(tileFile, grassFile, tileWidth, tileHeight) {
  // The tile, read at twice its size
  const meta = await sharp(tileFile).metadata();
  const OW = meta.width * 2, OH = meta.height * 2, OR = OH / 2;
  const tile = await sharp(tileFile).resize(OW, OH).ensureAlpha().raw().toBuffer();
  const sample = (x, y, out) => {
    x = Math.max(0, Math.min(OW - 1.001, x));
    y = Math.max(0, Math.min(OH - 1.001, y));
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = 4 * (y0 * OW + x0);
    for (let c = 0; c < 3; c++) {
      const top = tile[i + c] * (1 - fx) + tile[i + 4 + c] * fx;
      const bottom = tile[i + 4 * OW + c] * (1 - fx) + tile[i + 4 * OW + 4 + c] * fx;
      out[c] = top * (1 - fy) + bottom * fy;
    }
    return out;
  };
  const tmp = [0, 0, 0];
  const lum = (x, y) => { const c = sample(x, y, tmp); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; };

  // The cliff ring at each degree, from its top (rIn) to its foot (rOut): the darkest stretch of
  // the ray between 0.4 and 0.92 R, out to where it turns half-way back to the plateau's colour
  const rIn = new Float32Array(360), rOut = new Float32Array(360);
  for (let a = 0; a < 360; a++) {
    const ca = Math.cos((a * Math.PI) / 180), sa = Math.sin((a * Math.PI) / 180);
    const ray = [];
    for (let r = 0.1 * OR; r < 0.96 * OR; r += 0.5) ray.push([r, lum(OW / 2 + ca * r, OH / 2 + sa * r)]);
    const smooth = ray.map(([r], i) => {
      const near = ray.slice(Math.max(0, i - 16), i + 17);
      return [r, near.reduce((t, [, l]) => t + l, 0) / near.length];
    });
    let low = -1;
    smooth.forEach(([r, l], i) => { if (r > 0.4 * OR && r < 0.92 * OR && (low < 0 || l < smooth[low][1])) low = i; });
    const middle = smooth.filter(([r]) => r < 0.3 * OR);
    const plateau = middle.reduce((t, [, l]) => t + l, 0) / middle.length;
    const half = (smooth[low][1] + plateau) / 2;
    let i0 = low, i1 = low;
    while (i0 > 0 && smooth[i0 - 1][1] < half) i0--;
    while (i1 < smooth.length - 1 && smooth[i1 + 1][1] < half) i1++;
    rIn[a] = smooth[i0][0];
    rOut[a] = smooth[i1][0];
  }
  const around = (arr, k) => arr.map((_, i) => { let t = 0; for (let j = -k; j <= k; j++) t += arr[(i + j + 360) % 360]; return t / (2 * k + 1); });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const top = around(around(rIn, 15).map((v) => clamp(v, 0.45 * OR, 0.62 * OR)), 8);
  const foot = around(rOut.map((v, i) => clamp(v, top[i] + 0.16 * OR, 0.84 * OR)), 8);
  const at = (arr, deg) => { const a = ((deg % 360) + 360) % 360, i = Math.floor(a), f = a - i; return arr[i] * (1 - f) + arr[(i + 1) % 360] * f; };

  // The plateau texture: the middle of the tile's plateau, slightly blurred and its contrast
  // softened so its mirrored repeats don't show. The grass at the cliffs' foot: the grass texture, at twice its size too
  const crop = { left: Math.round(OW / 2 - 0.28 * OR), top: Math.round(OH / 2 - 0.28 * OR), width: Math.round(0.56 * OR), height: Math.round(0.56 * OR) };
  const plateau = await sharp(await sharp(tileFile).resize(OW, OH).extract(crop).png().toBuffer()).removeAlpha().blur(1.2).raw().toBuffer();
  const mean = [0, 1, 2].map((c) => { let t = 0; for (let i = c; i < plateau.length; i += 3) t += plateau[i]; return (3 * t) / plateau.length; });
  // Dark specks would repeat as mirrored pairs: lift them towards the plateau's colour
  const meanLum = 0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2];
  for (let i = 0; i < plateau.length; i += 3) {
    const l = 0.299 * plateau[i] + 0.587 * plateau[i + 1] + 0.114 * plateau[i + 2];
    const t = clamp((meanLum - 12 - l) / 20, 0, 0.85);
    for (let c = 0; c < 3; c++) plateau[i + c] = plateau[i + c] * (1 - t) + mean[c] * t;
  }
  const g = await sharp(grassFile).metadata();
  const grass = await sharp(grassFile).resize(g.width * 2, g.height * 2).removeAlpha().raw().toBuffer();
  // Built at twice the board's size; k turns those pixels into the tile's
  const TW = 2 * tileWidth, TH = 2 * tileHeight, TR = TH / 2, k = OR / TR;
  // A texture repeated over the board, mirrored so it has no seams
  const mirrored = (data, w, h, bx, by, out, contrast = 1, base = mean) => {
    let u = (bx * k) % (2 * w), v = (by * k) % (2 * h);
    if (u >= w) u = 2 * w - 1 - u;
    if (v >= h) v = 2 * h - 1 - v;
    const i = 3 * ((v | 0) * w + (u | 0));
    for (let c = 0; c < 3; c++) out[c] = base[c] + (data[i + c] - base[c]) * contrast;
    return out;
  };
  const fullTile = await sharp(tileFile).resize(TW, TH).ensureAlpha().raw().toBuffer();

  return async (open, seed, center) => {
    const rand = rng(seed);
    // The plateau's outline, as points at the build's scale, with the distance along it
    const pts = [];
    for (const [p0, p1, p2, p3] of shoreCurves(open, rand, { neck: NECK, wobble: true })) {
      for (let j = 0; j < 60; j++) {
        const t = j / 60, u = 1 - t;
        const [x, y] = [0, 1].map((c) => u ** 3 * p0[c] + 3 * u * u * t * p1[c] + 3 * u * t * t * p2[c] + t ** 3 * p3[c]);
        pts.push([(x * TR) / R, (y * TR) / R]);
      }
    }
    const n = pts.length;
    const along = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) along[i] = along[i - 1] + Math.hypot(pts[i % n][0] - pts[i - 1][0], pts[i % n][1] - pts[i - 1][1]);
    // The ring goes round the outline about as many times as it fits, from a random start
    const laps = Math.max(1, Math.round(along[n] / (2 * Math.PI * 0.7 * TR)));
    const start = rand() * 360;
    const inside = (x, y) => {
      let w = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) w = !w;
      }
      return w;
    };

    const ox = 2 * center.x - TW / 2, oy = 2 * center.y - TH / 2;
    const px = Buffer.alloc(TW * TH * 4);
    const a = [0, 0, 0], b = [0, 0, 0];
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const hx = x - TW / 2 + 0.5, hy = y - TH / 2 + 0.5;
        let best = Infinity, bi = 0;
        for (let i = 0; i < n; i++) {
          const dx = pts[i][0] - hx, dy = pts[i][1] - hy, d = dx * dx + dy * dy;
          if (d < best) { best = d; bi = i; }
        }
        const dist = Math.sqrt(best);
        const deg = start + (360 * laps * along[bi]) / along[n];
        const ca = Math.cos((deg * Math.PI) / 180), sa = Math.sin((deg * Math.PI) / 180);
        const rTop = at(top, deg), rFoot = at(foot, deg);
        let w, near, far;
        if (inside(hx, hy)) {
          // The plateau: the tile's own lip near the cliff, the board-wide texture further in
          const r = Math.max(0.1 * OR, rTop - dist * k);
          near = sample(OW / 2 + ca * r, OH / 2 + sa * r, a);
          far = mirrored(plateau, crop.width, crop.height, ox + x, oy + y, b, 0.45);
          w = Math.min(1, dist / (0.16 * TR));
        } else {
          // Down the cliff, then out over the grass at its foot
          const r = rTop + dist * k;
          const rc = Math.min(r, rFoot + 3);
          near = sample(OW / 2 + ca * rc, OH / 2 + sa * rc, a);
          far = mirrored(grass, g.width * 2, g.height * 2, ox + x, oy + y, b, 1, [0, 0, 0]);
          w = clamp((r - rFoot) / 6, 0, 1);
        }
        const o = 4 * (y * TW + x);
        for (let c = 0; c < 3; c++) px[o + c] = near[c] * (1 - w) + far[c] * w;
        px[o + 3] = 255;

        // Along each edge: the tile's bevel where no hill joins, a faint hex line where one does
        const angle = (Math.atan2(hy, hx) * 180) / Math.PI;
        const d = Math.round((((angle % 360) + 360) % 360) / 60) % 6;
        const [nx, ny] = edgeDir(d);
        const toEdge = ((SQRT3 / 2) * TH) / 2 - (hx * nx + hy * ny);
        if (!open[d] && toEdge < 0.07 * TR) {
          const t = Math.min(1, (0.07 * TR - toEdge) / (0.03 * TR));
          for (let c = 0; c < 3; c++) px[o + c] = px[o + c] * (1 - t) + fullTile[o + c] * t;
        } else if (open[d] && toEdge < 3) {
          for (let c = 0; c < 3; c++) px[o + c] = px[o + c] * 0.55 + HEX_LINE[c] * 0.45;
        }
      }
    }
    return sharp(px, { raw: { width: TW, height: TH, channels: 4 } }).resize(tileWidth, tileHeight).png().toBuffer();
  };
}
