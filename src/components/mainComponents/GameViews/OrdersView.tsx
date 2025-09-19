import { useState } from "react";
import { Position } from "../../../types/scenario";
import BoardManager from "../../../game-core/BoardManager";
import CommandCard from "../../../game-core/commandCard";
import { TurnPhase } from "../../../types/gameManager";
import Board from "../../Board";
import Order from "../../../game-core/order";

interface OrdersViewProps {
  boardSide: string;
  boardManager: BoardManager;
  chosenCommandCard: CommandCard;
  setTurnPhase: React.Dispatch<React.SetStateAction<TurnPhase>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  orders: Order[];
}

function OrdersView({
  boardSide,
  boardManager,
  chosenCommandCard,
  setTurnPhase,
  setOrders,
  orders,
}: OrdersViewProps) {
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [possibleMovePositions, setPossibleMovePosistions] = useState<
    Position[]
  >([]);
  const [possibleMoveAndFirePositions, setPossibleMoveAndFiresPositions] =
    useState<Position[]>([]);

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
      if (unit.isOrdered()) {
        //TODO: add if unit not of correct type or not in correct side of the map
        //TODO: Add shadow to those units that are orderable, update once the card is selected and after a unit is ordered
        console.log("Unit is not orderable");
        //TODO: highlight hex red for a second and deselect hex
        return;
      }

      // Select this hex
      setUnitHexPosition(position);

      //Calculate all fireable hexes
      const possibleMoveAndFires: Position[] =
        boardManager.calculatePossibleMoves(hex, unit.getMoveAndFire(), true);
      setPossibleMoveAndFiresPositions(possibleMoveAndFires);

      // Calculate all hexes within movement range
      const possibleMoves: Position[] = boardManager.calculatePossibleMoves(
        hex,
        unit.getMaxMove()
      );
      setPossibleMovePosistions(possibleMoves);

      console.log(`Selected unit: ${unit.getUnitType()}`);
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

      // Check if clicking the same tile. order to fire and not move
      if (
        unitHexPosition.row === position.row &&
        unitHexPosition.col === position.col
      ) {
        const newOrder = new Order(
          selectedUnit,
          unitHexPosition,
          position,
          true
        );

        selectedUnit.giveOrder(true);

        newOrder.printOrder();

        setOrders((prevOrders) => [...prevOrders, newOrder]);
        setUnitHexPosition(null);
        setPossibleMovePosistions([]); // Clear highlights
        setPossibleMoveAndFiresPositions([]);
        return;
      }

      // Check if the clicked hex is a valid move destination (a highlighted tile) or a valid move and fire destination
      if (
        possibleMovePositions.some(
          (pos) => pos.row === position.row && pos.col === position.col
        )
      ) {
        const IsMoveAndFirePos = possibleMoveAndFirePositions.some(
          (pos) => pos.row === position.row && pos.col === position.col
        );
        // Move the unit
        if (
          boardManager.moveUnit(unitHexPosition, position)
        ) {

          selectedUnit.giveOrder(IsMoveAndFirePos);
          setNumOrdersLeft(numOrdersLeft - 1);

          // Get the full path to the clicked destination
          const fullPath: Position[] | null = boardManager.getPathToDestination(
            hex,
            unitHexPosition,
            selectedUnit.getMaxMove()
          );

          console.log("DEbug: Full path:", fullPath);

          const newOrder = new Order(
            hex.getUnit()!,
            unitHexPosition,
            position,
            IsMoveAndFirePos,
            fullPath
          );

          newOrder.printOrder();

          setOrders((prevOrders) => [...prevOrders, newOrder]);
        } else {
          throw new Error(
            `Failed to move ${selectedUnit.getUnitType()} to highlighted tile`
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

  const handleGoBack = () => {
    //TODO: dont show Volver if unit pick to order
    setOrders((prevOrders) => {
      if (prevOrders.length === 0) return prevOrders; // nothing to undo

      // Get the last order
      const lastOrder = prevOrders[prevOrders.length - 1];

      if (!lastOrder) return prevOrders;

      // Move the unit back to its original position
      boardManager.moveUnit(
        lastOrder.end,
        lastOrder.start,
      );

      // Remove the order from the unit
      lastOrder.unit.clearOrder();

      // Restore one order back to the counter
      setNumOrdersLeft((prev) => prev + 1);

      // Remove the last order
      return prevOrders.slice(0, -1);
    });
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
        orders={orders}
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
                Selected Tile: Row {unitHexPosition.row}, Column{" "}
                {unitHexPosition.col}
              </div>
            );
          })()}
        </div>
      )}

      <div className="mb-4">
        {orders.length > 0 && (
          <button
            onClick={() => handleGoBack()}
            className={` text-white p-2 rounded text-sm hover:opacity-80`}
          >
            VOLVER
          </button>
        )}
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
