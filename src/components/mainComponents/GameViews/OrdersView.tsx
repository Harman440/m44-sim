import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import Board from "../../Board";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";

interface OrdersViewProps {
  boardSide: string;
  session: GameSession;
  game: GameSnapshot;
}

function OrdersView({ boardSide, session, game }: OrdersViewProps) {
  const boardManager = session.board;
  const { orders, ordersLeft, ordersCommitted } = game;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);

  const clearSelection = () => {
    setUnitHexPosition(null);
    setMoveOptions(null);
  };

  // Main tile click handler
  const handleTileClick = (position: Position) => {
    if (!unitHexPosition) {
      // Select a unit; the session returns null if it can't be ordered right now
      const options = session.getMoveOptions(position);
      if (!options) return; //TODO: highlight hex red for a second if not orderable
      setUnitHexPosition(position);
      setMoveOptions(options);
      return;
    }

    // Clicking the selected unit again orders it to hold and fire;
    // clicking a highlighted hex orders it to move there
    if (session.issueOrder(unitHexPosition, position)) {
      clearSelection();
    }
  };

  // Get hex data for selected tile
  const getSelectedHexInfo = () => {
    if (!unitHexPosition) return null;
    return boardManager.getHex(unitHexPosition);
  };

  return (
    <div>
      <Board
        onTileClick={handleTileClick}
        unitHexPosition={unitHexPosition}
        possibleMovePositions={moveOptions?.moves ?? []}
        possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
        boardManager={boardManager}
        orders={orders}
        boardWidth={13}
        boardHeight={9}
        hexSize={50}
        faction={boardSide}
      />

      {unitHexPosition && (
        <Box sx={{ mt: 1 }}>
          {(() => {
            const hexInfo = getSelectedHexInfo();
            return hexInfo ? (
              <>
                <Typography variant="body2">
                  Seleccionado: {hexInfo.getDescription()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Terreno: {hexInfo.getType()} | Regla de movimiento:{" "}
                  {hexInfo.getMovementRule()}
                </Typography>
              </>
            ) : (
              <Typography variant="body2">
                Casilla seleccionada: fila {unitHexPosition.row}, columna{" "}
                {unitHexPosition.col}
              </Typography>
            );
          })()}
        </Box>
      )}

      <Stack spacing={1} sx={{ alignItems: "center", my: 2 }}>
        <Stack direction="row" spacing={1}>
          {orders.length > 0 && !unitHexPosition && !ordersCommitted && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()}>
              Volver
            </Button>
          )}
          {ordersLeft <= 0 && !ordersCommitted && (
            <Button onClick={() => session.commitOrders()}>
              Confirmar Órdenes
            </Button>
          )}
          {ordersCommitted && (
            <Button onClick={() => session.startBattle()}>Fase Batalla</Button>
          )}
        </Stack>
        <Typography variant="body2" color="primary">
          Da órdenes a tus unidades, órdenes restantes: {ordersLeft} | Haz
          clic en un hexágono para seleccionarlo
        </Typography>
      </Stack>
    </div>
  );
}

export default OrdersView;
