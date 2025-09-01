import React, { useState } from 'react';
import Board from './components/Board';

import BoardManager from './game-core/BoardManager';
import GameState from './game-core/gameState';

import './App.css';

const App = () => {
  const [selectedTile, setSelectedTile] = useState(null);
  const [boardManager] = useState(() => new BoardManager("forest-blitz", "Axis"));//TODO: selected in main menu
  const [gameState, setGameState] = useState(() => new GameState({
    faction: "axis",
    initNumCommandCards: 3
  }));//TODO: change initial state in main menu

  // Main tile click handler - App.tsx is in complete control
  const handleTileClick = (row, col) => {
    console.log(`Tile clicked: Row ${row}, Column ${col}`);
    
    const hex = boardManager.getHex(row, col);
    if (!hex) return;
    
    console.log(`Hex info:`, hex.getDescription());
    console.log(`Can enter: ${hex.canEnter()}, Must stop: ${hex.mustStop()}`);
    
    // Toggle selection
    const newSelectedTile = selectedTile?.row === row && selectedTile?.col === col 
      ? null 
      : { row, col };
    
    setSelectedTile(newSelectedTile);

    // Example game logic: Place a unit on empty hex
    //TODO: when clicked show how much unit can move and then click on a hex to move
    if (newSelectedTile && !hex.hasUnit() && hex.canEnter()) {
      const unit = {
        id: `unit-${Date.now()}`,
        name: `Player ${gameState.faction} Unit`,
        player: gameState.faction,
      };
      
      if (boardManager.placeUnit(row, col, unit)) {
        console.log(`Placed unit on ${hex.name} at (${row}, ${col})`);
        
        // Check movement restrictions
        if (hex.mustStop()) {
          console.log(`Unit must stop on ${hex.name} - cannot move further this turn`);
        }
      }
    }
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