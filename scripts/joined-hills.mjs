// Hills joined into ridges for `npm run board`: the images read and written with sharp, the
// pixel work in src/boardArt/joinedHills.mjs, which the app uses too (drawBoard.ts).
import sharp from "sharp";
import { joinedHillMaker, plateauCrop } from "../src/boardArt/joinedHills.mjs";

/**
 * Reads the hill tile and the grass texture and returns a function that draws one hill hex
 * `tileWidth` × `tileHeight` as a PNG: `(open, seed, center)` with `open` the six edges (0 = east,
 * clockwise) shared with another hill and `center` the hex's centre on the board.
 */
export async function joinedHills(tileFile, grassFile, tileWidth, tileHeight) {
  const raw = async (image, width, height, channels) => ({ data: await image.raw().toBuffer(), width, height, channels });
  // The tile and the grass at twice their size, the plateau's middle blurred a little
  const meta = await sharp(tileFile).metadata();
  const [OW, OH] = [meta.width * 2, meta.height * 2];
  const crop = plateauCrop(OW, OH);
  const tile = await raw(sharp(tileFile).resize(OW, OH).ensureAlpha(), OW, OH, 4);
  const plateau = await raw(sharp(await sharp(tileFile).resize(OW, OH).extract(crop).png().toBuffer()).removeAlpha().blur(1.2), crop.width, crop.height, 3);
  const g = await sharp(grassFile).metadata();
  const grass = await raw(sharp(grassFile).resize(g.width * 2, g.height * 2).removeAlpha(), g.width * 2, g.height * 2, 3);
  // Built at twice the board's size
  const [TW, TH] = [2 * tileWidth, 2 * tileHeight];
  const fullTile = await raw(sharp(tileFile).resize(TW, TH).ensureAlpha(), TW, TH, 4);
  const make = joinedHillMaker({ tile, plateau, grass, fullTile }, tileWidth, tileHeight);

  return async (open, seed, center) =>
    sharp(Buffer.from(make(open, seed, center).buffer), { raw: { width: TW, height: TH, channels: 4 } }).resize(tileWidth, tileHeight).png().toBuffer();
}
