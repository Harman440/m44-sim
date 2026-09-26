// components/boardGeometry.ts
import { Position } from "../types/scenario";

// Where hex (0,0) is centred and how much margin the SVG has; tuned so the
// hex grid lines up with the scenario board image
const ORIGIN_X = 115;
const ORIGIN_Y = 100;
const IMAGE_MARGIN = 50;

export interface BoardGeometry {
  hexSize: number;
  /** SVG user-space size of the whole board */
  width: number;
  height: number;
  /** Margin around the scenario image inside the SVG */
  imageMargin: number;
  hexCenter: (position: Position) => { x: number; y: number };
}

/**
 * Pixel layout for the board: pointy-top hexes with odd rows shifted right by
 * half a hex. Used for both the hex tiles and the order arrows so they agree.
 */
export function createBoardGeometry(cols: number, rows: number, hexSize: number): BoardGeometry {
  const hexWidth = hexSize * Math.sqrt(3); // horizontal distance between hex centres
  const rowSpacing = hexSize * 2 * 0.75; // vertical distance between rows

  return {
    hexSize,
    width: cols * hexWidth + hexWidth / 2 + 2 * IMAGE_MARGIN,
    height: rows * rowSpacing + hexSize * 0.5 + 2 * IMAGE_MARGIN,
    imageMargin: IMAGE_MARGIN,
    hexCenter: ({ row, col }) => ({
      x: ORIGIN_X + col * hexWidth + (row % 2) * (hexWidth / 2),
      y: ORIGIN_Y + row * rowSpacing,
    }),
  };
}
