import { describe, expect, it } from 'vitest';
import { isOnBoard, STANDARD_BOARD } from '../game-core/boardSize';
import { positionKey } from '../game-core/position';
import { surroundPositions } from './BoardSurround';

describe('surroundPositions', () => {
  it('rings the board without touching a hex of it', () => {
    const ring = surroundPositions(STANDARD_BOARD);
    expect(ring.every((p) => !isOnBoard(p, STANDARD_BOARD))).toBe(true);
    const keys = new Set(ring.map(positionKey));
    // Above and below every column, beside every row, and the missing hex at the end of the short rows
    for (let col = 0; col < STANDARD_BOARD.cols; col++) expect(keys.has(`-1-${col}`) && keys.has(`${STANDARD_BOARD.rows}-${col}`)).toBe(true);
    for (let row = 0; row < STANDARD_BOARD.rows; row++) expect(keys.has(`${row}--1`)).toBe(true);
    expect(keys.has(`1-${STANDARD_BOARD.cols - 1}`)).toBe(true);
  });
});
