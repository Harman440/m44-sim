import React, { useState } from 'react';
import Board from './components/Board.js';

import BoardManager from './game-core/BoardManager.js';
import GameState from './game-core/gameState.js';

import './App.css';

const App = () => {
  const [selectedTile, setSelectedTile] = useState(null);
  const [highlightedTiles, setHighlightedTiles] = useState([]);
  const [boardManager] = useState(() => new BoardManager("forest-blitz", "Axis"));//TODO: selected in main menu
  const [gameState, setGameState] = useState(() => new GameState({
    faction: "axis",
    initNumCommandCards: 3
  }));//TODO: change initial state in main menu

  // Main tile click handler - App.js is in complete control
  const handleTileClick = (row, col) => {
    console.log(`Tile clicked: Row ${row}, Column ${col}`);
    
    const hex = boardManager.getHex(row, col);
    if (!hex) return;
    
    console.log(`Hex info:`, hex.getDescription());
    console.log(`Can enter: ${hex.canEnter()}, Must stop: ${hex.mustStop()}`);
    
    // If no tile is currently selected
    if (!selectedTile) {
      // Check if clicked hex has a unit
      if (!hex.hasUnit()) {
        console.log("No unit on clicked hex");
        return;
      }
      
      // Select this hex and highlight possible moves
      setSelectedTile({ row, col });
      
      // Get the unit and calculate possible moves
      const unit = hex.getUnit();
      const maxMovement = unit.maxMove;
      
      // Calculate all hexes within movement range
      const possibleMoves = calculatePossibleMoves(row, col, maxMovement);
      setHighlightedTiles(possibleMoves); // You'll need this state variable
      
      console.log(`Selected unit: ${unit.unitType}, Max movement: ${maxMovement}`);
      
    } else {
      // A tile is already selected - this is a potential move destination
      const selectedHex = boardManager.getHex(selectedTile.row, selectedTile.col);
      const selectedUnit = selectedHex.getUnit();
      
      // Check if clicking the same tile (deselect)
      if (selectedTile.row === row && selectedTile.col === col) {
        setSelectedTile(null);
        setHighlightedTiles([]); // Clear highlights
        return;
      }
      
      // Check if the clicked hex is a valid move destination
      if (isValidMove(selectedTile.row, selectedTile.col, row, col, selectedUnit)) {
        // Move the unit
        const fromHex = boardManager.getHex(selectedTile.row, selectedTile.col);
        const toHex = boardManager.getHex(row, col);
        
        if (fromHex && toHex && toHex.canEnter(selectedUnit)) {
          // Remove unit from old hex and place on new hex
          fromHex.removeUnit();
          toHex.placeUnit(selectedUnit);
          
          // Update unit position
          selectedUnit.row = row;
          selectedUnit.col = col;
          
          console.log(`Moved ${selectedUnit.unitType} from (${selectedTile.row}, ${selectedTile.col}) to (${row}, ${col})`);
          
          // Check movement restrictions at destination
          if (hex.mustStop()) {
            console.log(`Unit must stop on ${hex.name} - cannot move further this turn`);
          }
        }
        
        // Clear selection and highlights
        setSelectedTile(null);
        setHighlightedTiles([]);
        
      } else {
        console.log("Invalid move - hex is out of range or blocked");
      }
    }
  };

  // Helper function to calculate possible moves using your Hex distance method
  const calculatePossibleMoves = (startRow, startCol, maxMovement) => {
    const possibleMoves = [];
    const startHex = boardManager.getHex(startRow, startCol);
    const unit = startHex.getUnit();
    
    // Check all hexes on the board for valid moves
    // You might want to optimize this by limiting the search area
    const boardSize = boardManager.getBoardSize ? boardManager.getBoardSize() : { rows: 20, cols: 20 }; // Adjust as needed
    
    for (let r = 0; r < boardSize.rows; r++) {
      for (let c = 0; c < boardSize.cols; c++) {
        if (r === startRow && c === startCol) continue; // Skip starting position
        
        const targetHex = boardManager.getHex(r, c);
        if (!targetHex) continue;
        
        const distance = startHex.getDistance(targetHex);
        
        // Check if hex is within movement range and can be entered
        if (distance <= maxMovement && targetHex.canEnter(unit) && !targetHex.hasUnit()) {
          possibleMoves.push({ row: r, col: c });
        }
      }
    }
    
    return possibleMoves;
  };

  // Helper function to check if a move is valid using your Hex methods
  const isValidMove = (fromRow, fromCol, toRow, toCol, unit) => {
    const fromHex = boardManager.getHex(fromRow, fromCol);
    const toHex = boardManager.getHex(toRow, toCol);
    
    if (!fromHex || !toHex) return false;
    
    const distance = fromHex.getDistance(toHex);
    const maxMovement = unit.maxMove;
    
    return distance <= maxMovement && toHex.canEnter(unit) && !toHex.hasUnit();
  };

  // Get hex data for selected tile
  const getSelectedHexInfo = () => {
    if (!selectedTile) return null;
    return boardManager.getHex(selectedTile.row, selectedTile.col);
  };

  // Get board statistics
  const getBoardStats = () => {
    return boardManager.getStats();
  };

  return (
    <div className="app">

      <Board 
        onTileClick={handleTileClick}
        selectedTile={selectedTile}
        boardManager={boardManager}
        boardWidth={13}
        boardHeight={9}
        hexSize={50}
        showCoordinates={true}
      />
      
      {selectedTile && (
        <div className="app__selected-info">
          {(() => {
            const hexInfo = getSelectedHexInfo();
            return hexInfo ? (
              <div>
                <div>Selected: {hexInfo.getDescription()}</div>
                <div>Terrain: {hexInfo.name} | Movement Rule: {hexInfo.movementRule}</div>
              </div>
            ) : (
              <div>Selected Tile: Row {selectedTile.row}, Column {selectedTile.col}</div>
            );
          })()}
        </div>
      )}
      
      <div className="app__instructions">
        Click on any hexagon to select it | 
        Turn: {gameState.currentTurn} |
        Terrain: {Object.entries(getBoardStats()).map(([type, count]) => `${type}: ${count}`).join(', ')}
      </div>
    </div>
  );
};

export default App;