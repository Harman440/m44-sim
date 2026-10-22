// Make a card painting from two others, side by side: each trimmed to its drawing (they have
// transparent backgrounds), fitted into its half of the card and standing on the bottom edge, the
// right one in front where they meet. For an action with no painting of its own, until the player
// has one (docs/ACTIONS_PLAN.md R12). The card is the size of the first painting.
// Usage: npm run mix-paintings -- <left> <right> <out>   (names in src/assets/cards, without .webp)
// Example: npm run mix-paintings -- explosives street-equipment explosives-mix
import sharp from "sharp";

const CARDS = "src/assets/cards";
/** The share of the card's width each painting may take; above a half, so they meet in the middle */
const SHARE = 0.58;

const [left, right, out] = process.argv.slice(2);
if (!left || !right || !out) {
  console.error("Usage: npm run mix-paintings -- <left> <right> <out>");
  process.exit(1);
}

const { width, height } = await sharp(`${CARDS}/${left}.webp`).metadata();
const fitted = async (name) => {
  const trimmed = await sharp(`${CARDS}/${name}.webp`).ensureAlpha().trim().png().toBuffer();
  return sharp(trimmed)
    .resize({ width: Math.round(SHARE * width), height, fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });
};
const [a, b] = await Promise.all([fitted(left), fitted(right)]);
await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: a.data, left: 0, top: height - a.info.height },
    { input: b.data, left: width - b.info.width, top: height - b.info.height },
  ])
  .webp({ quality: 75, alphaQuality: 80, effort: 6 })
  .toFile(`${CARDS}/${out}.webp`);
console.log(`${CARDS}/${out}.webp: ${width}×${height}, ${left} | ${right}`);
