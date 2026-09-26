import type React from 'react';
import Hexagon from './Hexagon';
import './Board.css';
import { Position } from '../types/scenario';
import BoardManager from '../game-core/BoardManager';
import OrderComponent from './OrderComponent';
import Order from '../game-core/order';
import { createBoardGeometry } from './boardGeometry';

/** A hex to flash red; a new `id` restarts the animation on the same hex */
export interface HexFlash {
  position: Position;
  id: number;
}

interface BoardProps {
  onTileClick: (position: Position) => void;
  unitHexPosition: Position | null;
  possibleMovePositions: Position[];
  possibleMoveAndFirePositions: Position[];
  boardManager: BoardManager;
  orders: readonly Order[];
  /** Scenario artwork drawn under the hexes */
  backgroundImage?: string;
  invalidFlash?: HexFlash | null;
  /** Orders are committed: dim the board and stop showing it as clickable */
  locked?: boolean;
  boardWidth?: number;
  boardHeight?: number;
  hexSize?: number;
  faction?: string;
}

const includesPosition = (positions: Position[], row: number, col: number) =>
  positions.some((pos) => pos.row === row && pos.col === col);

function Board({
  onTileClick,
  unitHexPosition,
  possibleMovePositions,
  possibleMoveAndFirePositions,
  boardManager,
  orders,
  backgroundImage,
  invalidFlash = null,
  locked = false,
  boardWidth = 13,
  boardHeight = 9,
  hexSize = 50,
  faction = "Allies"
}: BoardProps) {
  const geometry = createBoardGeometry(boardWidth, boardHeight, hexSize);

  const renderOrders = () => {
    return orders.map((order, index) => (
      <OrderComponent
        key={index} //NOTE: key is for react internal list
        orderIndex={index} //TODO: in the future make order class have an index
        order={order}
        getHexCenter={geometry.hexCenter}
        hexSize={hexSize}
      />
    ));
  };

  const renderBoard = () => {
    const tiles = [];

    for (let row = 0; row < boardHeight; row++) {
      // Odd rows have one hex fewer
      const actualMaxWidth = boardWidth + (row % 2 === 1 ? -1 : 0);
      for (let col = 0; col < actualMaxWidth; col++) {
        const position: Position = { row, col };
        const { x, y } = geometry.hexCenter(position);

        const hexData = boardManager.getHex(position);
        if (!hexData) {
          throw new Error(`Hex not found at ${JSON.stringify(position)}`);
        }

        const flashesInvalid =
          invalidFlash?.position.row === row && invalidFlash.position.col === col;

        tiles.push(
          <Hexagon
            key={`${position.row}-${position.col}`}
            x={x}
            y={y}
            position={position}
            onClick={onTileClick}
            isSelectedUnit={unitHexPosition?.row === row && unitHexPosition?.col === col}
            isPossibleMove={includesPosition(possibleMovePositions, row, col)}
            isPossibleMoveFirePos={includesPosition(possibleMoveAndFirePositions, row, col)}
            invalidFlashId={flashesInvalid ? invalidFlash.id : null}
            hexSize={hexSize}
            hexData={hexData}
            faction={faction}
          />
        );
      }
    }
    return tiles;
  };

  const { width, height, imageMargin } = geometry;

  return (
    <div className="board">
      {/* viewBox + CSS width lets the board scale down to fit tablets */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ maxWidth: width, '--board-aspect': width / height } as React.CSSProperties}
        className={`board__svg${locked ? ' board__svg--locked' : ''}`}
      >

        {/* Layer 1: Scenario image */}
        {backgroundImage && (
          <image
            href={backgroundImage}
            x={imageMargin}
            y={imageMargin}
            width={width - 2 * imageMargin}
            height={height - 2 * imageMargin}
            preserveAspectRatio="xMidYMid meet"
            transform={
              faction === "Axis"
                ? `rotate(180 ${(width / 2)} ${(height / 2)})`
                : undefined
            }
          />
        )}

        {/* Layer 2: Hexagon tiles*/}
        {renderBoard()}

        {/* Layer 3: Orders (top layer) */}
        {renderOrders()}
      </svg>
    </div>
  );
};

export default Board;
