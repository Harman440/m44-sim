import React, { useState } from 'react';
import Board from './components/Board.js';
import './App.css';

const App = () => {
  const [selectedTile, setSelectedTile] = useState(null);
  const [gameState, setGameState] = useState({
    currentPlayer: 1,
    tiles: {}, // Store tile data here (pieces, colors, etc.)
    gamePhase: 'playing', // 'playing', 'paused', 'ended'
  });

  // Main tile click handler - App.js is in complete control
  const handleTileClick = (row, col) => {
    console.log(`Tile clicked: Row ${row}, Column ${col}`);
    
    // Toggle selection
    const newSelectedTile = selectedTile?.row === row && selectedTile?.col === col 
      ? null 
      : { row, col };
    
    setSelectedTile(newSelectedTile);

    // Game logic can be added here
    if (newSelectedTile) {
      // Example: Place a piece on the tile
      setGameState(prevState => ({
        ...prevState,
        tiles: {
          ...prevState.tiles,
          [`${row}-${col}`]: {
            player: prevState.currentPlayer,
            timestamp: Date.now(),
            // Add other tile properties as needed
          }
        }
      }));
    }
  };

  // Get tile data for a specific position
  const getTileData = (row, col) => {
    return gameState.tiles[`${row}-${col}`] || null;
  };

  // Check if a tile is occupied
  const isTileOccupied = (row, col) => {
    return getTileData(row, col) !== null;
  };

  return (
    <div className="app">

      <Board 
        onTileClick={handleTileClick}
        selectedTile={selectedTile}
        boardWidth={13}
        boardHeight={9}
        hexSize={75}
        showCoordinates={true}
      />
      
      {selectedTile && (
        <div className="app__selected-info">
          Selected Tile: Row {selectedTile.row}, Column {selectedTile.col}
          {isTileOccupied(selectedTile.row, selectedTile.col) && (
            <div>
              Occupied by Player {getTileData(selectedTile.row, selectedTile.col).player}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;