// game-core/boardSize.ts
// How big a board is. The standard Memoir '44 board is 13 hexes across and 9 rows, odd rows one
// hex shorter and shifted half a hex right; the map editor grows a map at its edges (a column on
// the left or right, two rows at the top or bottom). Rows stay odd, so the board turned round
// for the Axis still has its long rows where the Allies have theirs.
import { Position } from "../types/scenario";

export interface BoardSize {
  /** Hexes in a long (even) row; odd rows have one fewer */
  cols: number;
  /** Rows, always odd */
  rows: number;
}

export const STANDARD_BOARD: Readonly<BoardSize> = { cols: 13, rows: 9 };

/**
 * The sizes a map can have: from the standard board up to about two and a half times as many hexes
 * as Overlord (26×9). The game screens zoom and pan, so a big board still taps well on a tablet;
 * the cap keeps its board art (about 4100×2750 px at the most) within a tablet's memory
 */
export const BOARD_LIMITS = { cols: { min: 13, max: 33 }, rows: { min: 9, max: 25 } } as const;

/** A scenario's board: the standard one unless it says otherwise */
export const boardSizeOf = (scenario: { board?: BoardSize }): BoardSize => scenario.board ?? STANDARD_BOARD;

export const isStandardBoard = ({ cols, rows }: BoardSize): boolean => cols === STANDARD_BOARD.cols && rows === STANDARD_BOARD.rows;

const inLimits = (value: number, { min, max }: { min: number; max: number }) => Number.isInteger(value) && value >= min && value <= max;

/** A size a map can have: within the limits, with an odd number of rows */
export const isBoardSize = ({ cols, rows }: BoardSize): boolean =>
  inLimits(cols, BOARD_LIMITS.cols) && inLimits(rows, BOARD_LIMITS.rows) && rows % 2 === 1;

/** Whether a hex is on a board of this size */
export const isOnBoard = ({ row, col }: Position, { cols, rows }: BoardSize): boolean =>
  Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < rows && col >= 0 && col < cols - (row % 2);

/** Every hex of a board, row by row */
export const boardPositions = ({ cols, rows }: BoardSize): Position[] =>
  [...Array(rows).keys()].flatMap((row) => [...Array(cols - (row % 2)).keys()].map((col) => ({ row, col })));
