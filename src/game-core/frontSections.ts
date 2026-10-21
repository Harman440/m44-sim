// game-core/frontSections.ts
// The sections variant (pass and play only): the board is split into as many sections as it has
// room for with at least 7 hexes each, counted along a long row; the hexes on the line between
// two sections are in both. Each turn a side plays a command card for each section, left to
// right (GameSession). The standard board (13 hexes across) has two sections of 7, sharing its
// middle column.
import { Side } from "../types/hex";
import { Section } from "./commandCard";

/** The fewest hexes a section has, along a long row */
export const MIN_SECTION_HEXES = 7;

export interface FrontLayout {
  /** The sections, left to right: one, left and right, or left, center and right */
  sections: readonly Section[];
  /**
   * Where two sections meet, in hexes from the long rows' first hex centre, left to right. A line
   * on a whole number runs through a long row's hexes, on a half through the short rows' ones:
   * the hexes it runs through are in both sections
   */
  lines: readonly number[];
  /** Each section's hexes along a long row, the ones on its lines included */
  hexes: Partial<Record<Section, number>>;
}

/** The long row's hexes from `from` to `to` (on them too), as x positions 0 … cols - 1 */
const hexesBetween = (from: number, to: number) => Math.floor(to) - Math.ceil(from) + 1;

const twoSections = (cols: number): FrontLayout => {
  const line = (cols - 1) / 2;
  const half = hexesBetween(0, line);
  return { sections: [Side.LEFT, Side.RIGHT], lines: [line], hexes: { [Side.LEFT]: half, [Side.RIGHT]: half } };
};

/** Three sections, the lines kept symmetric (so the sections are the same seen from either end), the smallest as big as it can be */
const threeSections = (cols: number): FrontLayout | null => {
  let best: FrontLayout | null = null;
  const sizes = (layout: FrontLayout) => Object.values(layout.hexes);
  for (let left = 0; left < (cols - 1) / 2; left += 0.5) {
    const right = cols - 1 - left;
    const outer = hexesBetween(0, left);
    const middle = hexesBetween(left, right);
    if (Math.min(outer, middle) < MIN_SECTION_HEXES) continue;
    const layout: FrontLayout = {
      sections: [Side.LEFT, Side.CENTER, Side.RIGHT],
      lines: [left, right],
      hexes: { [Side.LEFT]: outer, [Side.CENTER]: middle, [Side.RIGHT]: outer },
    };
    const better =
      !best ||
      Math.min(...sizes(layout)) > Math.min(...sizes(best)) ||
      (Math.min(...sizes(layout)) === Math.min(...sizes(best)) && Math.max(...sizes(layout)) < Math.max(...sizes(best)));
    if (better) best = layout;
  }
  return best;
};

/** How a board this many hexes across splits into sections: as many as fit with `MIN_SECTION_HEXES` each */
export function frontLayout(cols: number): FrontLayout {
  if (cols < 2 * MIN_SECTION_HEXES - 1) return { sections: [Side.CENTER], lines: [], hexes: { [Side.CENTER]: cols } };
  return threeSections(cols) ?? twoSections(cols);
}

/**
 * The side of a hex `x` hexes from the long rows' first hex centre. With two sections the hexes
 * on the line are `Side.CENTER`, in both; with three, the borders are the usual left-center and
 * right-center
 */
export function frontSide(x: number, layout: FrontLayout): Side {
  const [first, second] = layout.lines;
  if (first === undefined) return Side.CENTER;
  if (second === undefined) return x < first ? Side.LEFT : x === first ? Side.CENTER : Side.RIGHT;
  if (x < first) return Side.LEFT;
  if (x === first) return Side.LEFT_CENTER;
  if (x < second) return Side.CENTER;
  if (x === second) return Side.RIGHT_CENTER;
  return Side.RIGHT;
}

/** The sections a hex's side is in: a border hex is in both of its sections */
export function sectionsOfSide(side: Side, layout: FrontLayout | null = null): Section[] {
  if (layout?.sections.length === 1) return [Side.CENTER];
  if (layout?.sections.length === 2 && side === Side.CENTER) return [Side.LEFT, Side.RIGHT];
  switch (side) {
    case Side.LEFT_CENTER:
      return [Side.LEFT, Side.CENTER];
    case Side.RIGHT_CENTER:
      return [Side.CENTER, Side.RIGHT];
    default:
      return [side];
  }
}
