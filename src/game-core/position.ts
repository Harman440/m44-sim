// game-core/position.ts
import { Position } from "../types/scenario";

export const samePosition = (a: Position, b: Position): boolean =>
  a.row === b.row && a.col === b.col;

/** Map key for a position: "row-col" */
export const positionKey = ({ row, col }: Position): string => `${row}-${col}`;

export const includesPosition = (positions: readonly Position[], position: Position): boolean =>
  positions.some((p) => samePosition(p, position));

/** The position a "row-col" key names */
export const fromKey = (key: string): Position => {
  const [row, col] = key.split("-").map(Number);
  return { row: row!, col: col! };
};
