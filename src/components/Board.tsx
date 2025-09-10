import Hexagon from './Hexagon';

import './Board.css';
import { Position } from '../types/scenario';
import BoardManager from '../game-core/BoardManager';

interface BoardProps {
  onTileClick: (position: Position) => void;
  selectedTile: Position | null;
  highlightedTiles: Position[];
  boardManager: BoardManager;
  boardWidth?: number;
  boardHeight?: number;
  hexSize?: number;
  showCoordinates?: boolean;
  faction?: string;
}

function Board({
  onTileClick,
  selectedTile,
  highlightedTiles,
  boardManager,
  boardWidth = 13,
  boardHeight = 9,
  hexSize = 50,
  showCoordinates = true,
  faction = "Allies"
}: BoardProps) {

  // For flat-top hexagons, the spacing calculations
  const hexWidth = hexSize * Math.sqrt(3); // Width of flat-top hexagon
  const hexHeight = hexSize * 2; // Height of flat-top hexagon

  const renderBoard = () => {
    const tiles = [];
    const offsetX = hexWidth; // Horizontal spacing between hex centers
    const offsetY = hexHeight * 0.75; // Vertical spacing between rows

    for (let row = 0; row < boardHeight; row++) {
      // Delete hexe if row is odd
      const actualMaxWidth = boardWidth + (row % 2 === 1 ? -1 : 0);
      for (let col = 0; col < actualMaxWidth; col++) {
        const position: Position = { row, col };
        
        // Calculate position for hexagonal grid with flat-top hexagons
        const x = 115 + col * offsetX + (row % 2) * (offsetX / 2);
        const y = 100 + row * offsetY;

        const isSelected = selectedTile?.row === row && selectedTile?.col === col;
        
        // Check if this tile is in the highlightedTiles array
        const isHighlighted = highlightedTiles.some(tile =>
          tile?.row === row && tile?.col === col
        );

        const hexData = boardManager.getHex(position);
        if (!hexData) {
          throw new Error(`Hex not found at ${JSON.stringify(position)}`);
        }

        tiles.push(
          <Hexagon
            key={`${position.row}-${position.col}`}
            x={x}
            y={y}
            position={position}
            onClick={onTileClick}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            hexSize={hexSize}
            showCoordinates={showCoordinates}
            hexData={hexData}
            faction={faction}
          />
        );
      }
    }
    return tiles;
  };

  // Calculate SVG dimensions for flat-top hexagons
  const svgWidth = boardWidth * hexWidth + hexWidth / 2 + 100;
  const svgHeight = boardHeight * hexHeight * 0.75 + hexHeight * 0.25 + 100;

  return (
    <div className="board">
      <svg 
        width={svgWidth} 
        height={svgHeight}
        className="board__svg"
      >
        {renderBoard()}
      </svg>
    </div>
  );
};

export default Board;