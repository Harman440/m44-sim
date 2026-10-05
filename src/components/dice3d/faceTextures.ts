import { CanvasTexture, SRGBColorSpace, Texture } from "three";
import { DieFace, DieKind, SIDES_OF } from "../../game-core/dice";
import { UnitType } from "../../game-core/unit";
import { Faction } from "../../types/faction";
import { unitSprite } from "../UnitComponent";
import { iconUrl } from "../GameIcon";
import { DieSideLayout, dieShape } from "./dieGeometry";

/** A wood: the colour of its light wood and of its grain lines, as RGB */
interface Wood {
  light: [number, number, number];
  dark: [number, number, number];
}

/** Beech for the battle and attack dice, a paler ash for the long-range die */
const WOODS: Record<DieKind, Wood> = {
  battle: { light: [226, 196, 150], dark: [176, 128, 78] },
  attack: { light: [226, 196, 150], dark: [176, 128, 78] },
  longRange: { light: [240, 226, 196], dark: [198, 172, 128] },
};

const TEXTURE_SIZE = 256;
/** The black line round each side, in CSS pixels where two sides meet (each side draws half of it) */
const CONTOUR_WIDTH = 1.5;
/** The supply crate's colour, as on the 2D die */
const SUPPLY_COLOR = "#8d5a2b";

interface FaceArt {
  infantry: HTMLImageElement;
  tank: HTMLImageElement;
  supply: HTMLCanvasElement;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Can't load ${url}`));
    image.src = url;
  });
}

/** The supply crate icon filled with its colour (the icon is a mask) */
function tintedIcon(icon: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(icon, 0, 0, 128, 128);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

async function loadArt(faction: Faction): Promise<FaceArt> {
  const [infantry, tank, supply] = await Promise.all([
    loadImage(unitSprite(faction, UnitType.INFANTRY)),
    loadImage(unitSprite(faction, UnitType.TANK)),
    loadImage(iconUrl("coins")),
  ]);
  return { infantry, tank, supply: tintedIcon(supply, SUPPLY_COLOR) };
}

/** A face's symbol, drawn in the 2D die's 48-unit box (see `DieFaceIcon`) */
function drawSymbol(ctx: CanvasRenderingContext2D, face: DieFace, art: FaceArt) {
  switch (face) {
    case DieFace.INFANTRY:
      ctx.drawImage(art.infantry, 8, 6, 32, 36);
      break;
    case DieFace.TANK:
      ctx.drawImage(art.tank, 6, 6, 36, 36);
      break;
    case DieFace.GRENADE:
      ctx.fillStyle = "#4b5320";
      ctx.beginPath();
      ctx.ellipse(24, 29, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.roundRect(20, 12, 8, 6, 1);
      ctx.fill();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      ctx.stroke(new Path2D("M28 14 q9 -3 6 9"));
      break;
    case DieFace.SUPPLY:
      ctx.drawImage(art.supply, 9, 9, 30, 30);
      break;
    case DieFace.FLAG:
      ctx.fillStyle = "#333";
      ctx.fillRect(14, 8, 3, 32);
      ctx.fillStyle = "#c62828";
      ctx.fill(new Path2D("M17 9 L38 15 L17 22 Z"));
      break;
  }
}

/** A value in [0, 1) that looks random, fixed for each grid point and seed */
function hash(i: number, j: number, seed: number): number {
  const x = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth value noise in [0, 1) */
function noise(x: number, y: number, seed: number): number {
  const [i, j] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - i, y - j];
  const [sx, sy] = [fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)];
  const top = hash(i, j, seed) * (1 - sx) + hash(i + 1, j, seed) * sx;
  const bottom = hash(i, j + 1, seed) * (1 - sx) + hash(i + 1, j + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * Wood grain: growth rings cut at a slant, so they run as wavy lines across
 * the side, with fine fibres along them. Each side gets its own cut (`seed`).
 * Returns the coloured wood and its grain in grey, for the bump map.
 */
function drawWood(wood: Wood, seed: number): { color: HTMLCanvasElement; grain: HTMLCanvasElement } {
  const size = TEXTURE_SIZE;
  const color = document.createElement("canvas");
  const grain = document.createElement("canvas");
  color.width = color.height = grain.width = grain.height = size;
  const colorData = new ImageData(size, size);
  const grainData = new ImageData(size, size);

  const angle = (hash(seed, 1, 3) - 0.5) * 0.8;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const ringCentre = 1.5 + hash(seed, 2, 5) * 2;
  const rings = 7 + hash(seed, 3, 7) * 5;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const [x0, y0] = [px / size - 0.5, py / size - 0.5];
      // Along the grain (u) and across it (v)
      const u = x0 * cos - y0 * sin;
      const v = x0 * sin + y0 * cos;
      const warp = (noise(u * 3, v * 6, seed) - 0.5) * 0.18;
      const distance = Math.hypot(u * 0.25, v + ringCentre) + warp;
      const ring = (distance * rings) % 1;
      // Late wood: a thin dark band in each ring, soft on one side
      const band = Math.pow(Math.max(0, Math.sin(ring * Math.PI * 2)), 6);
      const fibre = (noise(u * 6, v * 90, seed + 11) - 0.5) * 0.35;
      const t = Math.min(1, Math.max(0, band * 0.6 + fibre * 0.5 + 0.12));
      const k = (py * size + px) * 4;
      for (let c = 0; c < 3; c++) colorData.data[k + c] = wood.light[c]! + (wood.dark[c]! - wood.light[c]!) * t;
      colorData.data[k + 3] = 255;
      grainData.data[k] = grainData.data[k + 1] = grainData.data[k + 2] = 255 * (1 - t);
      grainData.data[k + 3] = 255;
    }
  }
  color.getContext("2d")!.putImageData(colorData, 0, 0);
  grain.getContext("2d")!.putImageData(grainData, 0, 0);
  return { color, grain };
}

function texture(canvas: HTMLCanvasElement, srgb: boolean): Texture {
  const result = new CanvasTexture(canvas);
  if (srgb) result.colorSpace = SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

/** A side's textures: the wood with its symbol stamped on, and the wood's grain as a bump map */
export interface SideTextures {
  map: Texture;
  bump: Texture;
}

const woodCache = new Map<string, { color: HTMLCanvasElement; grain: HTMLCanvasElement }>();

/** A side's wood, drawn once (it's the slow part) and shared by both factions and the dice cut from the same wood */
function cachedWood(wood: Wood, seed: number) {
  const key = `${wood.light}|${wood.dark}|${seed}`;
  let drawn = woodCache.get(key);
  if (!drawn) {
    drawn = drawWood(wood, seed);
    woodCache.set(key, drawn);
  }
  return drawn;
}

/** Draws every die's wood ahead, one die at a time when the browser is idle, so the first throw doesn't wait for it */
export function prepareWood() {
  const idle = (work: () => void) =>
    typeof requestIdleCallback === "function" ? requestIdleCallback(work) : setTimeout(work, 50);
  const dice = Object.keys(WOODS) as DieKind[];
  const next = () => {
    const die = dice.shift();
    if (!die) return;
    SIDES_OF[die].forEach((_, i) => cachedWood(WOODS[die], i + 1));
    idle(next);
  };
  idle(next);
}

/** A side's textures; with no `art` the side is left blank (a die not rolled yet) */
function drawSide(face: DieFace, side: DieSideLayout, wood: Wood, seed: number, art: FaceArt | null): SideTextures {
  const size = TEXTURE_SIZE;
  const cached = cachedWood(wood, seed);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(cached.color, 0, 0);

  // A thin black contour on the side's edges. The line is centred on the edge, so each side shows half
  // of it, and the halves of two sides meet in one line along the rounded edge between them
  ctx.beginPath();
  side.uvs.forEach(([u, v], i) => (i === 0 ? ctx.moveTo(u * size, (1 - v) * size) : ctx.lineTo(u * size, (1 - v) * size)));
  ctx.closePath();
  ctx.strokeStyle = "rgba(20, 14, 8, 0.9)";
  ctx.lineWidth = (CONTOUR_WIDTH * size) / side.textureSpan;
  ctx.lineJoin = "round";
  ctx.stroke();

  if (!art) return { map: texture(canvas, true), bump: texture(cached.grain, false) };

  // Stamped in ink, so the grain shows through the symbol
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.translate(size / 2, size / 2);
  const scale = (side.symbolScale * size) / 48;
  ctx.scale(scale, scale);
  ctx.translate(-24, -24);
  drawSymbol(ctx, face, art);
  ctx.restore();
  ctx.restore();

  return { map: texture(canvas, true), bump: texture(cached.grain, false) };
}

const artCache = new Map<Faction, Promise<FaceArt>>();
const textureCache = new Map<string, Promise<SideTextures[]>>();

/**
 * The textures of each side of the die, in the order of `SIDES_OF`; drawn
 * once per die and faction. `blank`: the wood and contours only, no symbols
 * (the dice a shot will roll, before it's rolled).
 */
export function sideTextures(die: DieKind, faction: Faction, blank = false): Promise<SideTextures[]> {
  const key = blank ? `${die}|blank` : `${die}|${faction}`;
  let textures = textureCache.get(key);
  if (!textures) {
    let art: Promise<FaceArt | null> | undefined = blank ? Promise.resolve(null) : artCache.get(faction);
    if (!art) {
      const loading = loadArt(faction);
      artCache.set(faction, loading);
      loading.catch(() => artCache.delete(faction));
      art = loading;
    }
    const { sides } = dieShape(die);
    textures = art.then((loaded) =>
      SIDES_OF[die].map((face, i) => drawSide(face, sides[i]!, WOODS[die], i + 1, loaded))
    );
    textureCache.set(key, textures);
    textures.catch(() => textureCache.delete(key));
  }
  return textures;
}
