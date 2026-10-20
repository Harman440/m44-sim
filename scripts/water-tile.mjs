// Make a river or lake tile for the library that blends into the countryside: its water kept,
// with a narrow bank round it, and its grass faded out, so the board's own countryside shows
// through and the hex is no greener than the hexes round it. The bank's green is turned toward
// the board's grass too.
// Usage: npm run water-tile -- <tile image> <library tile .webp>
// The tile is one hex filling its image's width, pointy-top, as the library's tiles are.
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: npm run water-tile -- <tile image> <library tile .webp>");
  process.exit(1);
}

// The empty board's grass, on average (src/assets/board-art/empty-board.webp)
const BOARD_GRASS = [189, 198, 158];
// The bank kept round the water, and the fade beyond it, as parts of the tile's width
const BANK = 0.045;
const FADE = 0.07;

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const at = (x, y) => 4 * (y * W + x);

// Water: blue, and the white foam on it (light, with blue water near it)
const blue = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const [r, g, b, a] = [data[4 * p], data[4 * p + 1], data[4 * p + 2], data[4 * p + 3]];
  if (a > 200 && b > r + 25 && b > g + 5) blue[p] = 1;
}
/** Grow (or shrink) a mask by a square of `k` pixels */
const morph = (mask, k, grow) => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let dy = -k; dy <= k && v === (grow ? 0 : 1); dy++) {
        for (let dx = -k; dx <= k; dx++) {
          const [xx, yy] = [x + dx, y + dy];
          const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? (grow ? 0 : 1) : mask[yy * W + xx];
          if (grow ? s : !s) {
            v = grow ? 1 : 0;
            break;
          }
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
};
// Closed, so the foam between the blue is water too
const k = Math.max(1, Math.round(W / 60));
const water = morph(morph(blue, k, true), k, false);

// How far each pixel is from the water, in pixels (8-way steps, close enough for a soft edge)
const dist = new Float32Array(W * H).fill(Infinity);
let frontier = [];
for (let p = 0; p < W * H; p++) if (water[p]) (dist[p] = 0), frontier.push(p);
while (frontier.length) {
  const next = [];
  for (const p of frontier) {
    const [x, y] = [p % W, (p / W) | 0];
    for (const [dx, dy, step] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) {
      const [xx, yy] = [x + dx, y + dy];
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = yy * W + xx;
      if (dist[p] + step < dist[q]) {
        dist[q] = dist[p] + step;
        next.push(q);
      }
    }
  }
  frontier = next;
}

// The tile's own grass, on average (well away from the water), to turn the bank's toward the board's
let [sr, sg, sb, n] = [0, 0, 0, 0];
for (let p = 0; p < W * H; p++) {
  if (dist[p] < (BANK + FADE) * W || data[4 * p + 3] < 250) continue;
  sr += data[4 * p];
  sg += data[4 * p + 1];
  sb += data[4 * p + 2];
  n++;
}
const grass = n ? [sr / n, sg / n, sb / n] : BOARD_GRASS;
const shift = BOARD_GRASS.map((c, i) => c - grass[i]);

const out = Buffer.from(data);
const smooth = (t) => t * t * (3 - 2 * t);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    const i = at(x, y);
    if (water[p]) continue;
    const d = dist[p] / W;
    // Faded out beyond the bank; the bank's green turned toward the board's, more so further out
    const alpha = d <= BANK ? 1 : d >= BANK + FADE ? 0 : 1 - smooth((d - BANK) / FADE);
    const toward = 0.55 + 0.45 * Math.min(1, d / (BANK + FADE));
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, data[i + c] + shift[c] * toward));
    out[i + 3] = Math.round(data[i + 3] * alpha);
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 90 }).toFile(output);
console.log(`${output}: ${W}×${H}, grass ${grass.map(Math.round).join(",")} turned toward ${BOARD_GRASS.join(",")}`);
