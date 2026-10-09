// Make a card painting for the app from a large original PNG or JPEG (kept in /images, outside git):
// a small WebP in src/assets/cards/, named after the original in lower case.
// An image with no alpha channel (a JPEG never has one) is taken to have a transparent background drawn as the
// grey-and-white checkerboard: light neutral greys reached from the edges, and larger
// enclosed patches with both checker tones (between an arm and a body), become see-through.
// Usage: npm run card-art -- <file.png|file.jpg> [maxWidth]
// Example: npm run card-art -- images/infantry-assault.png 480
import sharp from "sharp";
import { statSync } from "node:fs";
import { basename } from "node:path";

const [file, maxWidthArg] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run card-art -- <file.png|file.jpg> [maxWidth]");
  process.exit(1);
}

const MIN_HOLE = 150;
/** The width of the image's outer frame, where compression noise is cleared with the checkerboard */
const FRAME = 2;

/** The lightest a checker pixel can be: below the darker checker tone, for the JPEG noise round it */
let checkerFloor = 218;

const isNeutral = (data, i) => {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  return Math.max(r, g, b) - Math.min(r, g, b) <= 8;
};

const isChecker = (data, i) => isNeutral(data, i) && Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) >= checkerFloor;

/**
 * The darker checker tone, read off the image's border: the darkest light neutral grey (not white)
 * that's common there. Some originals draw it darker (about 217) than others (about 233), and
 * some shade it unevenly (about 214 along the top, 230 elsewhere)
 */
function darkCheckerTone(data, w, h) {
  const counts = new Map();
  let total = 0;
  const count = (x, y) => {
    const i = y * w + x;
    const v = data[i * 3];
    if (isNeutral(data, i) && v >= 190 && v < 245) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      total++;
    }
  };
  for (let d = 0; d < 6; d++) {
    for (let x = 0; x < w; x++) count(x, d), count(x, h - 1 - d);
    for (let y = 0; y < h; y++) count(d, y), count(w - 1 - d, y);
  }
  const common = [...counts].filter(([, n]) => n >= total * 0.02).map(([v]) => v);
  return common.length > 0 ? Math.min(...common) : 255;
}

/** The checkerboard pixels: those connected to the edges, and enclosed patches with both tones */
function checkerboard(data, w, h) {
  const bg = new Uint8Array(w * h);
  const neighbours = (i) => {
    const x = i % w, y = (i / w) | 0;
    return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1].filter((n) => n >= 0);
  };
  // The outermost pixels of a JPEG can come out darker than the checkerboard: any light grey there goes too
  const onFrame = (i) => {
    const x = i % w, y = (i / w) | 0;
    return x < FRAME || y < FRAME || x >= w - FRAME || y >= h - FRAME;
  };
  const isLightGrey = (i) => isNeutral(data, i) && Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) >= 190;
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !(isChecker(data, i) || (onFrame(i) && isLightGrey(i)))) continue;
    bg[i] = 1;
    stack.push(...neighbours(i));
  }
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (bg[start] || seen[start] || !isChecker(data, start)) continue;
    const region = [];
    let light = 0, dark = 0;
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const i = queue.pop();
      region.push(i);
      if (data[i * 3] >= 248) light++;
      else if (data[i * 3] <= 238) dark++;
      for (const n of neighbours(i)) {
        if (!seen[n] && !bg[n] && isChecker(data, n)) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    if (region.length > MIN_HOLE && light > region.length * 0.15 && dark > region.length * 0.15) region.forEach((i) => (bg[i] = 1));
  }
  return bg;
}

/** The image with its checkerboard see-through, and the pixels along the cut half see-through to soften it */
async function cutOut(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  checkerFloor = Math.min(checkerFloor, darkCheckerTone(data, w, h) - 10);
  const bg = checkerboard(data, w, h);
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let alpha = 255;
    if (bg[i]) alpha = 0;
    else {
      const x = i % w, y = (i / w) | 0;
      let near = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) near++;
        }
      }
      if (near) alpha = Math.max(60, 255 - near * 40);
    }
    rgba.set([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], alpha], i * 4);
  }
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
}

const { width, height, hasAlpha } = await sharp(file).metadata();
// About 3 times its size on the largest card (220px): landscape art fills the card's width, portrait art less
const maxWidth = maxWidthArg ? Number(maxWidthArg) : width > height ? 640 : 480;
const out = `src/assets/cards/${basename(file).replace(/\.(png|jpe?g)$/i, "").toLowerCase()}.webp`;
const image = hasAlpha ? sharp(file) : await cutOut(file);

await image
  .resize({ width: Math.min(width, maxWidth), withoutEnlargement: true })
  .webp({ quality: 75, alphaQuality: 80, effort: 6 })
  .toFile(out);

const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${file} (${kb(file)} KB)${hasAlpha ? "" : ", checkerboard removed,"} -> ${out} (${kb(out)} KB)`);
