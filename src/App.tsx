import { useCallback, useState } from 'react';
import Board from './components/Board';

import BoardManager from './game-core/BoardManager';
import GameState from './game-core/gameState';

import './App.css';
import { Position } from './types/scenario';
import TurnState from './game-core/turnState';
import { GamePhase, TurnPhase } from './types/gameManager';
import CommandCard from './game-core/commandCard';
import Deck from './game-core/deck';
import commandCards from './data/commandCards';

const App = () => {
  const [selectedTile, setSelectedTile] = useState<Position | null>(null);//TODO: changed to selected unit hex position
  const [highlightedTiles, setHighlightedTiles] = useState<Position[]>([]);//TODO: change to possible positions + Add fireable positions
  const [boardManager] = useState<BoardManager>(() => new BoardManager("forest-blitz", "Axis"));//TODO: selected in main menu
  const [gameState, setGameState] = useState<GameState>(() => new GameState({
    board: boardManager,
    faction: "axis",
    initNumCommandCards: 3,
    commandCardsDeck: new Deck(commandCards),
    phase: GamePhase.PLAYING //TODO: start in setup/main menu
  }));//TODO: change initial state in main menu
  const [turnState, setTurnState] = useState<TurnState>(() => new TurnState());

  //handle click on card
  const handleCardClick = useCallback((card: CommandCard) => {
    console.log(`Card clicked: ${card.name}`);
    
    setTurnState(prevTurnState => {
      // Clone the previous state
      const newTurnState = prevTurnState.clone(); 
      /*NOTE: If you're using a class-based state management pattern, 
      make sure your state updates return new instances rather than mutating existing ones. 
      This is a fundamental React principle - state should be treated as immutable.*/
      newTurnState.setCommandCard(card);
      newTurnState.printTurnInfo();
      return newTurnState;
    });
  }, []); // No dependencies needed with the functional update

  // Main tile click handler - App.tsx is in complete control
  const handleTileClick = (position: Position) => {
    console.log(`Tile clicked: Row ${position.row}, Column ${position.col}`);
    
    const hex = boardManager.getHex(position);
    if (!hex) return;
    
    console.log(`Hex info:`, hex.getDescription());
    
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
        
        // Calculate all hexes within movement range
        const possibleMoves: Position[] = boardManager.calculatePossibleMoves(hex, unit);
        setHighlightedTiles(possibleMoves);
        
        console.log(`Selected unit: ${unit.unitType}`);
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
      
      // Check if the clicked hex is a valid move destination (a highlighted tile)
      if(highlightedTiles.some(pos => pos.row === position.row && pos.col === position.col))  {
        // Move the unit
        if (boardManager.moveUnit(selectedTile, position)) {

          //TODO: add order in turn state and add one to number order left. add max orders.
          console.log(`Moved ${selectedUnit.unitType} from (${selectedTile.row}, ${selectedTile.col}) to (${position.row}, ${position.col})`);
        } else {
          throw new Error(`Failed to move ${selectedUnit.unitType} to highlighted tile`);
        }
        
        // Clear selection and highlights
        setSelectedTile(null);
        setHighlightedTiles([]);
        
      } else {
        console.log("Invalid move - hex is out of range or blocked");
      }
    }
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

      {turnState.phase === TurnPhase.PICK_CARDS && (
        <div className="mb-4">
          <h3 className="font-bold mb-2">Choose a Card</h3>
          <div className="grid grid-cols-1 gap-2">
            {gameState.commandCardsPlayer.cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                className={` text-white p-2 rounded text-sm hover:opacity-80`}
              >
                {card.name} ({card.maxTotalOrders} actions)
              </button>
            ))}
          </div>
        </div>
      )}

      {turnState.phase === TurnPhase.ORDER_UNITS && (
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
      )}

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
        Terrain: {Object.entries(getBoardStats()).map(([type, count]) => `${type}: ${count}`).join(', ')} |
        Phase: {turnState.phase}
        {turnState.phase === TurnPhase.PICK_CARDS && <div className="text-red-600">Pick a card first</div>}
        {turnState.phase === TurnPhase.ORDER_UNITS && <div className="text-blue-600">Order your units</div>}
      </div>
    </div>
  );
};

export default App;