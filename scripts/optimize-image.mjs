// Convert an image to WebP next to the original, scaled down to at most `maxWidth` px.
// Usage: npm run optimize-image -- <file> [maxWidth]
// Example: npm run optimize-image -- src/assets/units/allies/tank.png 192
import sharp from "sharp";
import { statSync } from "node:fs";

const [file, maxWidthArg] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run optimize-image -- <file> [maxWidth]");
  process.exit(1);
}

const out = file.replace(/\.(png|jpe?g)$/i, ".webp");
const image = sharp(file);
const { width } = await image.metadata();
const maxWidth = maxWidthArg ? Number(maxWidthArg) : width;

await image
  .resize({ width: Math.min(width, maxWidth), withoutEnlargement: true })
  .webp({ quality: 85, alphaQuality: 90 })
  .toFile(out);

const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${file} (${kb(file)} KB) -> ${out} (${kb(out)} KB)`);
