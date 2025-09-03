import { useState } from 'react';
import Board from './components/Board';

import BoardManager from './game-core/BoardManager';
import GameState from './game-core/gameState';

import './App.css';
import { Position } from './data/types/scenario';
import Unit from './game-core/unit';
import Hex from './game-core/hex';

const App = () => {
  const [selectedTile, setSelectedTile] = useState<Position | null>(null);
  const [highlightedTiles, setHighlightedTiles] = useState<Position[]>([]);
  const [boardManager] = useState<BoardManager>(() => new BoardManager("forest-blitz", "Axis"));//TODO: selected in main menu
  const [gameState, setGameState] = useState<GameState>(() => new GameState({
    faction: "axis",
    initNumCommandCards: 3
  }));//TODO: change initial state in main menu

  // Main tile click handler - App.tsx is in complete control
  const handleTileClick = (position: Position) => {
    console.log(`Tile clicked: Row ${position.row}, Column ${position.col}`);
    
    const hex = boardManager.getHex(position);
    if (!hex) return;
    
    console.log(`Hex info:`, hex.getDescription());
    console.log(`Can enter: ${hex.canEnter()}, Must stop: ${hex.mustStop()}`);
    
    // If no tile is currently selected
    if (!selectedTile) {
      // Get the unit
      const unit = hex.getUnit();
      // Check if clicked hex has a unit
      if (!unit) {
        console.log("No unit found on clicked hex");
        return;
      }
        // Select this hex and highlight possible moves
        setSelectedTile(position);
        
        // calculate possible moves
        const maxMovement = unit.maxMove;
        
        // Calculate all hexes within movement range
        //TODO: Bug found not calculating possible hexes correctly, check if BoardManager functions work better
        const possibleMoves: Position[] = calculatePossibleMoves(hex, unit);
        setHighlightedTiles(possibleMoves); // You'll need this state variable
        
        console.log(`Selected unit: ${unit.unitType}, Max movement: ${maxMovement}`);
    } else {
      // A tile is already selected - this is a potential move destination
      const selectedHex = boardManager.getHex(selectedTile);
      if (!selectedHex) {
        throw new Error("Selected hex not found");
      }
      const selectedUnit = selectedHex.getUnit();
      if (!selectedUnit) {
        throw new Error("Selected unit not found");
      }
      
      // Check if clicking the same tile (deselect)
      if (selectedTile.row === position.row && selectedTile.col === position.col) {
        setSelectedTile(null);
        setHighlightedTiles([]); // Clear highlights
        return;
      }

      const fromHex = boardManager.getHex(selectedTile);
      const toHex = boardManager.getHex(position);
      
      // Check if the clicked hex is a valid move destination
      if (isValidMove(fromHex, toHex, selectedUnit)) {
        // Move the unit

        
        if (fromHex && toHex && toHex.canEnter(selectedUnit)) {
          // Remove unit from old hex and place on new hex
          fromHex.removeUnit();
          toHex.placeUnit(selectedUnit);
          
          //TODO: Update unit position
          // selectedUnit.row = row;
          // selectedUnit.col = col;
          
          console.log(`Moved ${selectedUnit.unitType} from (${selectedTile.row}, ${selectedTile.col}) to (${position.row}, ${position.col})`);
          
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
  const calculatePossibleMoves = (startHex: Hex, unit: Unit): Position[] => {
    const possibleMoves: Position[] = [];
    
    // Check all hexes on the board for valid moves
    const allHexes = boardManager.getAllHexes();
    
    for (const targetHex of allHexes) {
      // Skip the starting position
      if (targetHex === startHex) continue;
      
      const distance = startHex.getDistance(targetHex);
      
      // Check if hex is within movement range and can be entered
      if (distance <= unit.maxMove && targetHex.canEnter(unit) && !targetHex.hasUnit()) {
        possibleMoves.push(targetHex.position);
      }
    }
    
    console.log("DEBUG: Possible moves:", possibleMoves);
    return possibleMoves;
  };

  // Helper function to check if a move is valid using your Hex methods
  const isValidMove = (fromHex: Hex | null, toHex: Hex | null, unit: Unit | null): boolean => {
    if (!fromHex || !toHex || !unit) return false;
    
    const distance = fromHex.getDistance(toHex);
    const maxMovement = unit.maxMove;
    
    return distance <= maxMovement && toHex.canEnter(unit) && !toHex.hasUnit();
  };

  // Get hex data for selected tile
  const getSelectedHexInfo = () => {
    if (!selectedTile) return null;
    return boardManager.getHex(selectedTile);
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
        highlightedTiles={highlightedTiles}
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