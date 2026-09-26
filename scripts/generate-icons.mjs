// Renders public/icons/icon.svg into the PNG sizes the PWA manifest and browsers need.
// Run with `npm run icons` after changing the SVG.
import sharp from "sharp";

const source = "public/icons/icon.svg";
const sizes = [
  ["public/icons/pwa-192.png", 192],
  ["public/icons/pwa-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
  ["public/icons/favicon-32.png", 32],
];

for (const [file, size] of sizes) {
  await sharp(source, { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`${file} (${size}px)`);
}
