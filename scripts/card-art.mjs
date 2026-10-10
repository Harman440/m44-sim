// Make a card painting for the app from a large original PNG or JPEG (kept in /images, outside git):
// a small WebP in src/assets/cards/, named after the original in lower case.
// An image with no alpha channel (a JPEG never has one) is taken to have a transparent background drawn as the
// grey-and-white checkerboard: light neutral greys reached from the edges, and larger
// enclosed patches with both checker tones (between an arm and a body), become see-through.
// An image whose border is all white has a white background instead: the light pixels reached from the edges
// fade out as they near white, so its soft edges (grass, shadows) blend into the card.
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

/** On a white background: pixels this far from white or less, reached from the edges, fade out… */
const WHITE_FADE = 64;
/** …and these, nearly white, go altogether */
const WHITE_CLEAR = 6;

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

/** How far a pixel is from white: how much its darkest channel is below 255 */
const fromWhite = (data, i) => 255 - Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);

/** The image's border is (nearly) all white: a painting on a white background, not on the checkerboard (half white) */
function hasWhiteBorder(data, w, h) {
  let white = 0, total = 0;
  const count = (x, y) => {
    total++;
    if (fromWhite(data, y * w + x) < 10) white++;
  };
  for (let x = 0; x < w; x++) count(x, 0), count(x, h - 1);
  for (let y = 0; y < h; y++) count(0, y), count(w - 1, y);
  return white >= total * 0.9;
}

/** The pixels next to pixel i, left, right, up and down */
function neighboursOf(i, w, h) {
  const x = i % w;
  const near = [];
  if (x > 0) near.push(i - 1);
  if (x < w - 1) near.push(i + 1);
  if (i >= w) near.push(i - w);
  if (i < w * (h - 1)) near.push(i + w);
  return near;
}

/**
 * The image's white background see-through: the light pixels reached from the edges, or
 * from a larger enclosed patch of white (seen under a truck, between the wheels), are made
 * partly see-through by how near white they are (as GIMP's colour to alpha), with the colour
 * that, laid over white, gives the pixel. The painting's outline stops the spread.
 */
function whiteToAlpha(data, w, h) {
  const reached = new Uint8Array(w * h);
  const spread = (stack) => {
    while (stack.length) {
      const i = stack.pop();
      if (reached[i] || fromWhite(data, i) > WHITE_FADE) continue;
      reached[i] = 1;
      stack.push(...neighboursOf(i, w, h));
    }
  };
  const edges = [];
  for (let x = 0; x < w; x++) edges.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edges.push(y * w, y * w + w - 1);
  spread(edges);
  // Enclosed patches of white, not just a highlight
  const seen = new Uint8Array(w * h);
  const isWhite = (i) => fromWhite(data, i) < 10;
  for (let start = 0; start < w * h; start++) {
    if (reached[start] || seen[start] || !isWhite(start)) continue;
    const patch = [start];
    seen[start] = 1;
    for (let k = 0; k < patch.length; k++) {
      for (const n of neighboursOf(patch[k], w, h)) {
        if (!seen[n] && !reached[n] && isWhite(n)) {
          seen[n] = 1;
          patch.push(n);
        }
      }
    }
    if (patch.length > MIN_HOLE) spread(patch);
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const alpha = reached[i] ? Math.min(1, Math.max(0, (fromWhite(data, i) - WHITE_CLEAR) / (WHITE_FADE - WHITE_CLEAR))) : 1;
    for (let c = 0; c < 3; c++) {
      const v = data[i * 3 + c];
      rgba[i * 4 + c] = alpha > 0 ? Math.max(0, Math.round(255 - (255 - v) / alpha)) : v;
    }
    rgba[i * 4 + 3] = Math.round(alpha * 255);
  }
  return rgba;
}

/** The image's checkerboard see-through, and the pixels along the cut half see-through to soften it */
function checkerToAlpha(data, w, h) {
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
  return rgba;
}

/** The image with its background see-through, white or checkerboard */
async function cutOut(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const white = hasWhiteBorder(data, w, h);
  const rgba = white ? whiteToAlpha(data, w, h) : checkerToAlpha(data, w, h);
  return { image: sharp(rgba, { raw: { width: w, height: h, channels: 4 } }), removed: white ? "white background" : "checkerboard" };
}

const { width, height, hasAlpha } = await sharp(file).metadata();
// About 3 times its size on the largest card (220px): landscape art fills the card's width, portrait art less
const maxWidth = maxWidthArg ? Number(maxWidthArg) : width > height ? 640 : 480;
const out = `src/assets/cards/${basename(file).replace(/\.(png|jpe?g)$/i, "").toLowerCase()}.webp`;
const { image, removed } = hasAlpha ? { image: sharp(file), removed: null } : await cutOut(file);

await image
  .resize({ width: Math.min(width, maxWidth), withoutEnlargement: true })
  .webp({ quality: 75, alphaQuality: 80, effort: 6 })
  .toFile(out);

const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${file} (${kb(file)} KB)${removed ? `, ${removed} removed,` : ""} -> ${out} (${kb(out)} KB)`);
