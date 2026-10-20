import { useId } from 'react';
import emptyBoardUrl from '../assets/board-art/empty-board.webp';
import { isOnBoard, sectionLines, STANDARD_BOARD, type BoardSize } from '../game-core/boardSize';
import { positionKey } from '../game-core/position';
import type { Position } from '../types/scenario';
import type { BoardGeometry } from './boardGeometry';

/** How far in from a hex's corners the printed hex line ends, as a part of its radius: cut off and the rest stretched over it */
const INSIDE_LINE = 0.94;

/** The hexes round the board: a ring outside it all the way round (two columns at the ends, where the odd rows lie half a hex in) */
export function surroundPositions({ cols, rows }: BoardSize): Position[] {
  const positions: Position[] = [];
  for (let row = -1; row <= rows; row++) {
    for (let col = -2; col <= cols + 1; col++) {
      if (!isOnBoard({ row, col }, { cols, rows })) positions.push({ row, col });
    }
  }
  return positions;
}

// The empty board's hexes away from its edges and from its printed section lines, to copy from
const SOURCES: Position[] = (() => {
  const { left, right } = sectionLines(STANDARD_BOARD.cols);
  const sources: Position[] = [];
  for (let row = 1; row < STANDARD_BOARD.rows - 1; row++) {
    for (let col = 1; col < STANDARD_BOARD.cols - 2; col++) {
      const x = col + (row % 2) / 2;
      if (Math.abs(x - left) >= 0.75 && Math.abs(x - right) >= 0.75) sources.push({ row, col });
    }
  }
  return sources;
})();

/** A hex of the empty board to copy, picked by the hex it's laid on, so a map always looks the same */
const sourceFor = ({ row, col }: Position): Position =>
  SOURCES[Math.abs(row * 7919 + col * 104729 + row * col * 31) % SOURCES.length] ?? { row: 1, col: 1 };

const hexPoints = (r: number) =>
  [...Array(6)]
    .map((_, i) => {
      const a = ((i * 60 + 30) * Math.PI) / 180;
      return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');

/**
 * Countryside hexes round the board, out past its edges, so the map seems to carry on: each a hex
 * of the empty board's countryside with its printed line cut off, a faint line of its own and a
 * light veil, since nothing can go there. Drawn over the board's art round its edges (the art's
 * frame) and never tapped
 */
export default function BoardSurround({ size, geometry }: { size: BoardSize; geometry: BoardGeometry }) {
  const { hexSize } = geometry;
  const clipId = `board-surround-${useId()}`;
  const hexWidth = hexSize * Math.sqrt(3);
  // The empty board's art is the standard board's grid: its hexes' centres in its own box
  const art = { width: STANDARD_BOARD.cols * hexWidth, height: (1.5 * STANDARD_BOARD.rows + 0.5) * hexSize };
  const artCenter = ({ row, col }: Position) => ({ x: hexWidth / 2 + col * hexWidth + (row % 2) * (hexWidth / 2), y: hexSize + row * 1.5 * hexSize });
  // Stretched a hair more than the line it cuts off, so the hexes meet with no gap
  const stretch = 1.005 / INSIDE_LINE;
  return (
    <g className="board__surround" data-testid="board-surround" pointerEvents="none" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <polygon points={hexPoints(INSIDE_LINE * hexSize)} />
        </clipPath>
      </defs>
      {surroundPositions(size).map((position) => {
        // Two rows down and back up, so a row above the board keeps its odd rows' shift
        const below = geometry.hexCenter({ row: position.row + 2, col: position.col });
        const [x, y] = [below.x, below.y - 3 * hexSize];
        const source = artCenter(sourceFor(position));
        return (
          <g key={positionKey(position)} data-surround-at={positionKey(position)} transform={`translate(${x} ${y})`}>
            <g transform={`scale(${stretch})`} clipPath={`url(#${clipId})`}>
              <image href={emptyBoardUrl} x={-source.x} y={-source.y} width={art.width} height={art.height} preserveAspectRatio="none" />
            </g>
            <polygon className="board__surround-veil" points={hexPoints(hexSize)} />
          </g>
        );
      })}
    </g>
  );
}
