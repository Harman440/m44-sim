// Make a card painting for the app from a large original PNG or JPEG (kept in /images, outside git):
// a small WebP in src/assets/cards/, named after the original in lower case.
// An image with no alpha channel (a JPEG never has one) is taken to have a transparent background drawn as the
// grey-and-white checkerboard: light neutral greys reached from the edges, and larger
// enclosed patches with both checker tones (between an arm and a body), become see-through.
// An image whose border is all white has a white background instead: the light pixels reached from the edges
// fade out as they near white, so its soft edges (grass, shadows) blend into the card. A border of one other flat
// colour (a mid grey) is taken out the same way, fading out as pixels near that colour.
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
/** On a background of another flat colour, nearer the painting's own colours: a narrower fade… */
const FLAT_FADE = 40;
/** …and wider for the JPEG noise in it */
const FLAT_CLEAR = 10;
/** How far a border pixel can be from the background colour and still count as background */
const FLAT_NOISE = 10;
/** A flat background other than white is darker than this: a lighter grey border is the checkerboard's */
const FLAT_MAX = 200;
/** On a flat colour other than white, the fade reaches only this many pixels into the painting from the background */
const FLAT_BAND = 3;

/** The lightest a checker pixel can be: below the darker checker tone, for the JPEG noise round it */
let checkerFloor = 218;
/** The lightest grey counted as the darker checker tone in an enclosed patch: above the tone, as some originals draw it lighter (about 242) */
let checkerDark = 238;

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
      else if (data[i * 3] <= checkerDark) dark++;
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

const WHITE = [255, 255, 255];

/** How far a pixel is from the background colour: its largest difference in any channel */
const fromColour = (data, i, bg) =>
  Math.max(Math.abs(data[i * 3] - bg[0]), Math.abs(data[i * 3 + 1] - bg[1]), Math.abs(data[i * 3 + 2] - bg[2]));

/**
 * The image's background colour when its border is (nearly) all one flat colour: white, or a darker grey;
 * null for the checkerboard (half white, half grey, or a light grey)
 */
function flatBackground(data, w, h) {
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const median = (c) => border.map((i) => data[i * 3 + c]).sort((a, b) => a - b)[border.length >> 1];
  const near = (bg) => border.filter((i) => fromColour(data, i, bg) < FLAT_NOISE).length >= border.length * 0.9;
  if (near(WHITE)) return WHITE;
  const bg = [median(0), median(1), median(2)];
  return Math.max(...bg) < FLAT_MAX && near(bg) ? bg : null;
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
 * The image's flat background see-through: the pixels near its colour reached from the edges, or
 * from a larger enclosed patch of it (seen under a truck, between the wheels), are made
 * partly see-through by how near the background they are (as GIMP's colour to alpha), with the colour
 * that, laid over the background, gives the pixel. The painting's outline stops the spread.
 * A grey is nearer the painting's own colours (olive cloth running off the image's edge has no outline),
 * so there only the background itself is reached, and the fade softens a thin band round it.
 */
function backgroundToAlpha(data, w, h, bg) {
  const white = bg === WHITE;
  const fade = white ? WHITE_FADE : FLAT_FADE;
  const clear = white ? WHITE_CLEAR : FLAT_CLEAR;
  const distance = (i) => fromColour(data, i, bg);
  const reach = white ? fade : FLAT_NOISE - 1;
  const reached = new Uint8Array(w * h);
  const spread = (stack) => {
    while (stack.length) {
      const i = stack.pop();
      if (reached[i] || distance(i) > reach) continue;
      reached[i] = 1;
      stack.push(...neighboursOf(i, w, h));
    }
  };
  const edges = [];
  for (let x = 0; x < w; x++) edges.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edges.push(y * w, y * w + w - 1);
  spread(edges);
  // Enclosed patches of the background, not just a highlight
  const seen = new Uint8Array(w * h);
  const isBackground = (i) => distance(i) < FLAT_NOISE;
  for (let start = 0; start < w * h; start++) {
    if (reached[start] || seen[start] || !isBackground(start)) continue;
    const patch = [start];
    seen[start] = 1;
    for (let k = 0; k < patch.length; k++) {
      for (const n of neighboursOf(patch[k], w, h)) {
        if (!seen[n] && !reached[n] && isBackground(n)) {
          seen[n] = 1;
          patch.push(n);
        }
      }
    }
    if (patch.length > MIN_HOLE) spread(patch);
  }
  if (!white) {
    let band = [];
    for (let i = 0; i < w * h; i++) if (reached[i]) band.push(i);
    for (let step = 0; step < FLAT_BAND; step++) {
      const next = [];
      for (const i of band) {
        for (const n of neighboursOf(i, w, h)) {
          if (!reached[n] && distance(n) <= fade) {
            reached[n] = 1;
            next.push(n);
          }
        }
      }
      band = next;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const alpha = reached[i] ? Math.min(1, Math.max(0, (distance(i) - clear) / (fade - clear))) : 1;
    for (let c = 0; c < 3; c++) {
      const v = data[i * 3 + c];
      rgba[i * 4 + c] = alpha > 0 ? Math.min(255, Math.max(0, Math.round(bg[c] + (v - bg[c]) / alpha))) : v;
    }
    rgba[i * 4 + 3] = Math.round(alpha * 255);
  }
  return rgba;
}

/** The image's checkerboard see-through, and the pixels along the cut half see-through to soften it */
function checkerToAlpha(data, w, h) {
  const tone = darkCheckerTone(data, w, h);
  checkerFloor = Math.min(checkerFloor, tone - 10);
  checkerDark = Math.max(checkerDark, tone + 3);
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

/** The image with its background see-through: a flat colour (white, grey) or the checkerboard */
async function cutOut(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bg = flatBackground(data, w, h);
  const rgba = bg ? backgroundToAlpha(data, w, h, bg) : checkerToAlpha(data, w, h);
  const removed = !bg ? "checkerboard" : bg === WHITE ? "white background" : `rgb(${bg.join(", ")}) background`;
  return { image: sharp(rgba, { raw: { width: w, height: h, channels: 4 } }), removed };
}

const { width, hasAlpha } = await sharp(file).metadata();
// Twice the largest card on screen (220px in the card dialog), for the tablet's 2× screen
const maxWidth = maxWidthArg ? Number(maxWidthArg) : 480;
const out = `src/assets/cards/${basename(file).replace(/\.(png|jpe?g)$/i, "").toLowerCase()}.webp`;
const { image, removed } = hasAlpha ? { image: sharp(file), removed: null } : await cutOut(file);

await image
  .resize({ width: Math.min(width, maxWidth), withoutEnlargement: true })
  .webp({ quality: 75, alphaQuality: 80, effort: 6 })
  .toFile(out);

const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${file} (${kb(file)} KB)${removed ? `, ${removed} removed,` : ""} -> ${out} (${kb(out)} KB)`);
