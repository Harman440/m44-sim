import type React from 'react';
import Hexagon, { HexHighlight } from './Hexagon';
import './Board.css';
import { Position } from '../types/scenario';
import { Faction } from '../types/faction';
import { includesPosition, positionKey, samePosition } from '../game-core/position';
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
  hexSize?: number;
  faction: Faction;
}

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
  hexSize = 50,
  faction
}: BoardProps) {
  const { width: boardWidth, height: boardHeight } = boardManager;
  const geometry = createBoardGeometry(boardWidth, boardHeight, hexSize);
  const unitsReadyToFire = new Set(orders.filter((order) => order.canFire).map((order) => order.unit));

  const highlightAt = (position: Position): HexHighlight => {
    if (unitHexPosition && samePosition(unitHexPosition, position)) return 'selected';
    // Move-and-fire wins over move-only: every move-and-fire hex is also a move hex
    if (includesPosition(possibleMoveAndFirePositions, position)) return 'move-and-fire';
    if (includesPosition(possibleMovePositions, position)) return 'move';
    return null;
  };

  const renderOrders = () => {
    return orders.map((order, index) => (
      <OrderComponent
        key={index} // an order's index identifies it for the whole turn (see Order)
        orderIndex={index}
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

        const flashesInvalid = invalidFlash !== null && samePosition(invalidFlash.position, position);

        tiles.push(
          <Hexagon
            key={positionKey(position)}
            x={x}
            y={y}
            position={position}
            onClick={onTileClick}
            highlight={highlightAt(position)}
            unitReadyToFire={hexData.unit !== null && unitsReadyToFire.has(hexData.unit)}
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
  // Crop the view to the board image: the hexes all lie inside it, so the
  // dark margin around it would only waste screen space on tablets
  const viewWidth = width - 2 * imageMargin;
  const viewHeight = height - 2 * imageMargin;

  return (
    <div className="board">
      {/* viewBox + CSS width lets the board scale down to fit tablets */}
      <svg
        viewBox={`${imageMargin} ${imageMargin} ${viewWidth} ${viewHeight}`}
        style={{ maxWidth: width, '--board-aspect': viewWidth / viewHeight } as React.CSSProperties}
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
