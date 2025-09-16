import { useState } from "react";
import { Position } from "../../../types/scenario";
import BoardManager from "../../../game-core/BoardManager";
import CommandCard from "../../../game-core/commandCard";
import { TurnPhase } from "../../../types/gameManager";
import Board from "../../Board";

interface OrdersViewProps {
  boardSide: string;
  boardManager: BoardManager;
  chosenCommandCard: CommandCard;
  setTurnPhase: (turnPhase: TurnPhase) => void;
}

function OrdersView({
  boardSide,
  boardManager,
  chosenCommandCard,
  setTurnPhase,
}: OrdersViewProps) {
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [possibleMovePositions, setPossibleMovePosistions] = useState<Position[]>([]);
  const [possibleMoveAndFirePositions, setPossibleMoveAndFiresPositions] = useState<Position[]>([]);

  const [numOrdersLeft, setNumOrdersLeft] = useState<number>(
    chosenCommandCard.maxTotalOrders
  );
  const [OrdersAreCommited, setOrdersAreCommited] = useState<boolean>(false); //NOTE: this is set to false each time this is rendered??

  // Main tile click handler - App.tsx is in complete control
  const handleTileClick = (position: Position) => {
    console.log(`Tile clicked: Row ${position.row}, Column ${position.col}`);

    const hex = boardManager.getHex(position);
    if (!hex) return;

    console.log(`Hex info:`, hex.getDescription());

    // If no tile is currently selected
    if (!unitHexPosition) {
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
      if (unit.hasOrder) {
        //TODO: add if unit not of correct type or not in correct side of the map
        console.log("Unit is not orderable");
        //TODO: highlight hex red for a second and deselect hex
        return;
      }

      // Select this hex
      setUnitHexPosition(position);

      //Calculate all fireable hexes
      const possibleMoveAndFires: Position[] = boardManager.calculatePossibleMoves(
        hex,
        unit.moveAndFire
      );
      setPossibleMoveAndFiresPositions(possibleMoveAndFires);

      // Calculate all hexes within movement range
      const possibleMoves: Position[] = boardManager.calculatePossibleMoves(
        hex,
        unit.maxMove
      );
      setPossibleMovePosistions(possibleMoves);

      console.log(`Selected unit: ${unit.unitType}`);
    } else {
      // A tile is already selected - this is a potential move destination
      const selectedHex = boardManager.getHex(unitHexPosition);
      if (!selectedHex) {
        throw new Error("Selected hex not found");
      }
      const selectedUnit = selectedHex.getUnit();
      if (!selectedUnit) {
        throw new Error("Selected unit not found");
      }

      // Check if clicking the same tile (deselect)
      if (
        unitHexPosition.row === position.row &&
        unitHexPosition.col === position.col
      ) {
        setUnitHexPosition(null);
        setPossibleMovePosistions([]); // Clear highlights
        setPossibleMoveAndFiresPositions([]);
        return;
      }

      // Check if the clicked hex is a valid move destination (a highlighted tile) or a valid move and fire destination
      if (
        possibleMoveAndFirePositions.some(
          (pos) => pos.row === position.row && pos.col === position.col
        )
      ) {
        // Move the unit and Mark as Possible Fire
        if (boardManager.moveUnit(unitHexPosition, position, true)) {
          setNumOrdersLeft(numOrdersLeft - 1);
          console.log(
            `Moved ${selectedUnit.unitType} from (${unitHexPosition.row}, ${unitHexPosition.col}) to (${position.row}, ${position.col})`
          );
        } else {
          throw new Error(
            `Failed to move ${selectedUnit.unitType} to highlighted tile`
          );
        }

        // Clear selection and highlights
        setUnitHexPosition(null);
        setPossibleMovePosistions([]);
        setPossibleMoveAndFiresPositions([]);
      } else if (
        possibleMovePositions.some(
          (pos) => pos.row === position.row && pos.col === position.col
        )
      ) {
        // Move the unit
        if (boardManager.moveUnit(unitHexPosition, position)) {
          setNumOrdersLeft(numOrdersLeft - 1);
          console.log(
            `Moved ${selectedUnit.unitType} from (${unitHexPosition.row}, ${unitHexPosition.col}) to (${position.row}, ${position.col})`
          );
        } else {
          throw new Error(
            `Failed to move ${selectedUnit.unitType} to highlighted tile`
          );
        }

        // Clear selection and highlights
        setUnitHexPosition(null);
        setPossibleMovePosistions([]);
        setPossibleMoveAndFiresPositions([]);
      } else {
        console.log("Invalid move - hex is out of range or blocked");
      }
    }
  };

  // Get hex data for selected tile
  const getSelectedHexInfo = () => {
    if (!unitHexPosition) return null;
    return boardManager.getHex(unitHexPosition);
  };

  //Handle Commit Orders
  const handleCommitOrders = () => {
    setOrdersAreCommited(true);
    //TODO: If orders commited, clicking on a tile should do nothing, dont show go back button, show moved units (should be done already) and show used cards
    //TODO: add something visual aswell to show nothing can be done
  };

  //Handle Start Battle
  const handleStartBattle = () => {
    setTurnPhase(TurnPhase.BATTLE);
  };

  return (
    <div>
      <Board
        onTileClick={handleTileClick}
        unitHexPosition={unitHexPosition}
        possibleMovePositions={possibleMovePositions}
        possibleMoveAndFirePositions={possibleMoveAndFirePositions}
        boardManager={boardManager}
        boardWidth={13}
        boardHeight={9}
        hexSize={50}
        showCoordinates={true}
        faction={boardSide}
      />

      {unitHexPosition && (
        <div className="game__selected-info">
          {(() => {
            const hexInfo = getSelectedHexInfo();
            return hexInfo ? (
              <div>
                <div>Selected: {hexInfo.getDescription()}</div>
                <div>
                  Terrain: {hexInfo.name} | Movement Rule:{" "}
                  {hexInfo.movementRule}
                </div>
              </div>
            ) : (
              <div>
                Selected Tile: Row {unitHexPosition.row}, Column {unitHexPosition.col}
              </div>
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
  );
}

export default OrdersView;
