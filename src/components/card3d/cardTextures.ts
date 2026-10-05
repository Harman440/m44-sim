import { CanvasTexture, SRGBColorSpace, Texture } from "three";
import { getFontEmbedCSS, toCanvas } from "html-to-image";

/** A card's face is laid out at 180×252 (CommandCard.css); its picture is drawn at 3× that */
export const FACE_WIDTH = 180;
export const FACE_HEIGHT = 252;
const PIXEL_RATIO = 3;

/** The look's fonts as CSS, worked out once (it reads every stylesheet and fetches the fonts) */
let fontCss: Promise<string> | null = null;

function texture(canvas: HTMLCanvasElement): Texture {
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

/** What the card art's CSS sets on its SVG shapes (CardArt.css) */
const SVG_STYLES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "paint-order",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "display",
  "visibility",
];

/**
 * html-to-image copies an <svg> as it is, without the stylesheet's rules
 * (the card art is coloured from the look's variables, so it would come out
 * black): writes each shape's computed style on it while the picture is
 * taken. Returns how to put the shapes back as they were.
 */
function inlineSvgStyles(root: HTMLElement): () => void {
  const shapes = [...root.querySelectorAll<SVGElement>("svg *")];
  const before = shapes.map((shape) => shape.getAttribute("style"));
  shapes.forEach((shape) => {
    const computed = getComputedStyle(shape);
    for (const name of SVG_STYLES) shape.style.setProperty(name, computed.getPropertyValue(name));
  });
  return () =>
    shapes.forEach((shape, i) => {
      const style = before[i];
      if (style === null || style === undefined) shape.removeAttribute("style");
      else shape.setAttribute("style", style);
    });
}

/**
 * A picture of a card on the page (`.game-card`) for the 3D card: its face,
 * drawn unscaled at its own 180px layout, whatever size it has on the page.
 */
export async function faceTexture(card: HTMLElement): Promise<Texture> {
  const face = card.querySelector<HTMLElement>(".game-card__face") ?? card;
  fontCss ??= getFontEmbedCSS(face).catch(() => "");
  const fontEmbedCSS = await fontCss;
  const restore = inlineSvgStyles(face);
  try {
    const canvas = await toCanvas(face, {
      width: FACE_WIDTH,
      height: FACE_HEIGHT,
      pixelRatio: PIXEL_RATIO,
      fontEmbedCSS,
      // The face is scaled to the card's size on the page; drawn at its own size here. No shadow: the 3D card casts its own
      style: { transform: "none", boxShadow: "none" },
    });
    return texture(canvas);
  } finally {
    restore();
  }
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** The back of a card, as on the deck pile (CardFlip.css), in the look's colours */
export function backTexture(): Texture {
  const width = FACE_WIDTH * PIXEL_RATIO;
  const height = FACE_HEIGHT * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = cssVar("--m44-primary", "#c8a24a");
  ctx.fillRect(0, 0, width, height);

  // Diagonal stripes, 10px wide at the card's 180px layout
  const stripe = 10 * PIXEL_RATIO;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  const reach = Math.hypot(width, height);
  for (let x = -reach; x < reach; x += 2 * stripe) ctx.fillRect(x, -reach, stripe, 2 * reach);
  ctx.restore();

  const border = 3 * PIXEL_RATIO;
  ctx.strokeStyle = cssVar("--m44-border", "#333");
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, width - border, height - border);

  ctx.fillStyle = cssVar("--m44-on-primary", "#222");
  ctx.font = `${26 * PIXEL_RATIO}px ${cssVar("--m44-font-display", "sans-serif")}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("M'44", width / 2, height / 2);

  return texture(canvas);
}

/** A soft round shadow, to lay under the card on the table */
export function shadowTexture(): Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}
