import { useState } from "react";
import { Position, Scenario } from "../../../types/scenario";
import BoardManager from "../../../game-core/BoardManager";
import CommandCard from "../../../game-core/commandCard";
import { TurnPhase } from "../../../types/gameManager";
import Board from "../../Board";

interface OrdersViewProps {
    boardSide: string,
    scenario: Scenario,
    chosenCommandCard: CommandCard,
    setTurnPhase: (turnPhase: TurnPhase) => void
}

function OrdersView({
    boardSide,
    scenario,
    chosenCommandCard,
    setTurnPhase
}: OrdersViewProps) {
    const [selectedTile, setSelectedTile] = useState<Position | null>(null);//TODO: changed name to selected unit hex position
    const [highlightedTiles, setHighlightedTiles] = useState<Position[]>([]);//TODO: change name to possible positions + Add fireable positions
    const [boardManager] = useState<BoardManager>(() => new BoardManager(scenario, boardSide));//TODO: selected in main menu
    const [numOrdersLeft, setNumOrdersLeft] = useState<number>(chosenCommandCard.maxTotalOrders);
    const [OrdersAreCommited, setOrdersAreCommited] = useState<boolean>(false);

    // Main tile click handler - App.tsx is in complete control
    const handleTileClick = (position: Position) => {
        console.log(`Tile clicked: Row ${position.row}, Column ${position.col}`);
        
        const hex = boardManager.getHex(position);
        if (!hex) return;
        
        console.log(`Hex info:`, hex.getDescription());
        
        // If no tile is currently selected
        if (!selectedTile) {
        // Check if max orders has been reached
        if (numOrdersLeft <= 0) {
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

            setNumOrdersLeft(numOrdersLeft - 1);
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

    //Handle Commit Orders
    const handleCommitOrders = () => {
        setOrdersAreCommited(true);
        //TODO: If orders commited, clicking on a tile should do nothing, dont show go back button, show moved units (should be done already) and show used cards
        //TODO: add something visual aswell to show nothing can be done
        // setTurnState(prevTurnState => {
        // // Clone the previous state
        // const newTurnState = prevTurnState.clone(); 
        // /*NOTE: If you're using a class-based state management pattern, 
        // make sure your state updates return new instances rather than mutating existing ones. 
        // This is a fundamental React principle - state should be treated as immutable.*/
        // newTurnState.commitOrders();
        // return newTurnState;
        // });
    };

    //Handle Start Battle
    const handleStartBattle = () => {
        setTurnPhase(TurnPhase.BATTLE);
        // setTurnState(prevTurnState => {
        // // Clone the previous state
        // const newTurnState = prevTurnState.clone(); 
        // /*NOTE: If you're using a class-based state management pattern, 
        // make sure your state updates return new instances rather than mutating existing ones. 
        // This is a fundamental React principle - state should be treated as immutable.*/
        // newTurnState.startBattlePhase();
        // return newTurnState;
        // });
    };

    return (
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
                faction={boardSide}
            />

            {selectedTile && (
                <div className="game__selected-info">
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
                {numOrdersLeft <= 0 && !OrdersAreCommited && (
                <button
                    onClick={() => handleCommitOrders()}
                    className={` text-white p-2 rounded text-sm hover:opacity-80`}
                >
                    CONFIRMAR ORDENES
                </button>
                )}
                {OrdersAreCommited && (
                <button
                    onClick={() => handleStartBattle()}
                    className={` text-white p-2 rounded text-sm hover:opacity-80`}
                >
                    FASE BATALLA
                </button>
                )}
            </div>
        </div>
    )
}

export default OrdersView;