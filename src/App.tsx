import { useCallback, useState } from 'react';
import Board from './components/Board';

import BoardManager from './game-core/BoardManager';
import GameState from './game-core/gameState';

import './App.css';
import { Position, Scenario } from './types/scenario';
import TurnState from './game-core/turnState';
import { GamePhase, TurnPhase } from './types/gameManager';
import CommandCard from './game-core/commandCard';
import Deck from './game-core/deck';
import commandCards from './data/commandCards';
import { scenarios } from './data/scenarios';
import CardsView from './components/mainComponents/CardsView';

const App = () => {
  const BoardSide: string = "Axis"; //TODO: change in main menu. NOTE: this is what is used to render the board
  const scenarioId: string = "forest-blitz";
  const scenario: Scenario | undefined = scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error(`Scenario '${scenarioId}' not found.`);
      throw new Error(`Scenario '${scenarioId}' not found.`);
    }

  const [selectedTile, setSelectedTile] = useState<Position | null>(null);//TODO: changed name to selected unit hex position
  const [highlightedTiles, setHighlightedTiles] = useState<Position[]>([]);//TODO: change name to possible positions + Add fireable positions
  const [boardManager] = useState<BoardManager>(() => new BoardManager(scenario, BoardSide));//TODO: selected in main menu
  const [gameState, setGameState] = useState<GameState>(() => new GameState({
    faction: "axis", //TODO: this has to be used to add new rules depending on the faction. check if not used anywhere else
    initNumCommandCards: 3,
    commandCardsDeck: new Deck(commandCards),
    phase: GamePhase.PLAYING //TODO: start in setup/main menu
  }));//TODO: change initial state in main menu
  const [turnState, setTurnState] = useState<TurnState>(() => new TurnState());//TODO: deprecating this. Turn state is used to save and update game State only

  const [turnPhase, setTurnPhase] = useState<TurnPhase>(() => TurnPhase.PICK_CARDS);//TODO this will be set to pickCards initially when the game is set up.
  const [chosenCommandCard, setChosenCommandCard] = useState<CommandCard | null>(null);

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
      // Check if max orders has been reached
      if (turnState.noOrdersLeft()) {
        console.log("Max orders reached");
        return;
      }
      // Get the unit
      const unit = hex.getUnit();
      // Check if clicked hex has a unit
      if (!unit) {
        console.log("No unit found on clicked hex");
        return;
      }

      // Check if the unit is orderable
      if (unit.hasOrder) { //TODO: add if unit not of correct type or not in correct side of the map
        console.log("Unit is not orderable");
        //TODO: highlight hex red for a second and deselect hex
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

          turnState.addOrder(selectedUnit, selectedTile, position, true);
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

  //Handle Commit Orders
  const handleCommitOrders = useCallback(() => {
    setTurnState(prevTurnState => {
      // Clone the previous state
      const newTurnState = prevTurnState.clone(); 
      /*NOTE: If you're using a class-based state management pattern, 
      make sure your state updates return new instances rather than mutating existing ones. 
      This is a fundamental React principle - state should be treated as immutable.*/
      newTurnState.commitOrders();
      return newTurnState;
    });
  }, []);

  //Handle Start Battle
  const handleStartBattle = useCallback(() => {
    setTurnState(prevTurnState => {
      // Clone the previous state
      const newTurnState = prevTurnState.clone(); 
      /*NOTE: If you're using a class-based state management pattern, 
      make sure your state updates return new instances rather than mutating existing ones. 
      This is a fundamental React principle - state should be treated as immutable.*/
      newTurnState.startBattlePhase();
      return newTurnState;
    });
  }, []);

  //Handle Finish Turn
  //TODO: improve this. update turn phase by phase and then show on app. lastly update game state with turn data
  const handleFinsihTurn = useCallback(() => {
    setTurnState(prevTurnState => {
      // Clone the previous state
      const newTurnState = prevTurnState.clone(); 
      /*NOTE: If you're using a class-based state management pattern, 
      make sure your state updates return new instances rather than mutating existing ones. 
      This is a fundamental React principle - state should be treated as immutable.*/
      newTurnState.startNewTurn();
      return newTurnState;
    });
    // Apply all turn changes to game state atomically
    setGameState(prevGameState => {
      const newGameState = prevGameState;

      newGameState.currentTurn = turnState.turnNumber;//TODO: turn is not updating correctly
      newGameState.commandCardsPlayer.remove(turnState.commandCard!); //TODO: remove correctly
      //TODO: set discard pile correctly if needed
      newGameState.commandCardsPlayer.add(newGameState.commandCardsDeck.draw(1)[0] ?? null);

      //TODO: units can be ordered again

      return newGameState;
    })
  }, []);

  // Get hex data for selected tile
  const getSelectedHexInfo = () => {
    if (!selectedTile) return null;
    return boardManager.getHex(selectedTile);
  };

  //TODO: React, rendering shoudnt depend on game state and turn state. I think
  return (
    <div className="app">

      {turnState.phase === TurnPhase.PICK_CARDS && (
        <CardsView
          commandCardsPlayer={gameState.commandCardsPlayer}
          onCardClick={handleCardClick}
        />
      )}

      {turnState.phase === TurnPhase.ORDER_UNITS && (
        <div>
          <Board 
            onTileClick={handleTileClick}
            selectedTile={selectedTile}
            highlightedTiles={highlightedTiles}
            boardManager={boardManager}
            boardWidth={13}
            boardHeight={9}
            hexSize={50}
            showCoordinates={true}
            faction={BoardSide}
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

          <div className="mb-4">
            {turnState.noOrdersLeft() && !turnState.ordersAreCommitted() && (
              <button
                onClick={() => handleCommitOrders()}
                className={` text-white p-2 rounded text-sm hover:opacity-80`}
              >
                CONFIRMAR ORDENES
              </button>
            )}
            {turnState.ordersAreCommitted() && (
              <button
                onClick={() => handleStartBattle()}
                className={` text-white p-2 rounded text-sm hover:opacity-80`}
              >
                FASE BATALLA
              </button>
            )}
          </div>
        </div>
      )}

      {turnState.phase === TurnPhase.BATTLE && (
        <div className="mb-4">
          <h3 className="font-bold mb-2">Fase Batalla</h3>
            <button
              onClick={() => handleFinsihTurn()}
              className={`text-white p-2 rounded text-sm hover:opacity-80`}
            >
              Terminar Turno
            </button>
            {/*TODO: Add delete units from board*/}
        </div>
      )}

      <div className="app__instructions">
        {turnState.phase === TurnPhase.PICK_CARDS && 
          <div className="text-red-600">
            Pick a card first
          </div>
        }
        {turnState.phase === TurnPhase.ORDER_UNITS && 
          <div className="text-blue-600">
            Order your units: {turnState.numOrdersLeft} | 
            Click on any hexagon to select it | 
          </div>
        }
      </div>

      <div className='app_info'>
        Turn: {gameState.currentTurn} |
        Phase: {turnState.phase}
      </div>
    </div>
  );
};

export default App;