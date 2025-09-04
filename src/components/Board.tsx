import Hexagon from './Hexagon';

import './Board.css';
import { Position } from '../data/types/scenario';
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
}: BoardProps) {

  // For flat-top hexagons, the spacing calculations
  const hexWidth = hexSize * Math.sqrt(3); // Width of flat-top hexagon
  const hexHeight = hexSize * 2; // Height of flat-top hexagon

  const renderBoard = () => {
    const tiles = [];
    const offsetX = hexWidth; // Horizontal spacing between hex centers
    const offsetY = hexHeight * 0.75; // Vertical spacing between rows

    for (let row = 0; row < boardHeight; row++) {
      for (let col = 0; col < boardWidth; col++) {
        const position: Position = { row, col };
        
        // Calculate position for hexagonal grid with flat-top hexagons
        const x = 100 + col * offsetX + (row % 2) * (offsetX / 2);
        const y = 100 + row * offsetY;

        const isSelected = selectedTile?.row === row && selectedTile?.col === col;
        
        // Check if this tile is in the highlightedTiles array
        const isHighlighted = highlightedTiles.some(tile =>
          tile?.row === row && tile?.col === col
        );

        const hexData = boardManager ? boardManager.getHex(position) : null;

        tiles.push(
          <Hexagon
            x={x}
            y={y}
            position={position}
            onClick={onTileClick}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            hexSize={hexSize}
            showCoordinates={showCoordinates}
            hexData={hexData}
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