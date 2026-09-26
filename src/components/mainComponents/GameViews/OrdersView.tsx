import { useEffect, useRef, useState } from "react";
import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import Board, { HexFlash } from "../../Board";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import "./OrdersView.css";

// Must be at least the hexagon-flash-invalid animation in Hexagon.css
export const INVALID_FLASH_MS = 450;

interface OrdersViewProps {
  boardSide: string;
  session: GameSession;
  game: GameSnapshot;
}

const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

function OrdersView({ boardSide, session, game }: OrdersViewProps) {
  const boardManager = session.board;
  const { orders, ordersLeft, ordersCommitted } = game;
  const canGiveOrders = !ordersCommitted && ordersLeft > 0;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);

  const [invalidFlash, setInvalidFlash] = useState<HexFlash | null>(null);
  const flashCounter = useRef(0);

  useEffect(() => {
    if (!invalidFlash) return;
    const timer = setTimeout(() => setInvalidFlash(null), INVALID_FLASH_MS);
    return () => clearTimeout(timer);
  }, [invalidFlash]);

  const flashInvalid = (position: Position) => {
    flashCounter.current += 1;
    setInvalidFlash({ position, id: flashCounter.current });
  };

  const clearSelection = () => {
    setUnitHexPosition(null);
    setMoveOptions(null);
  };

  // One tap per action so it works the same with a mouse or on a tablet
  const handleTileClick = (position: Position) => {
    if (!canGiveOrders) return;

    if (unitHexPosition) {
      // Tapping the selected unit again deselects it
      if (samePosition(unitHexPosition, position)) {
        clearSelection();
        return;
      }
      // Tapping a highlighted hex moves the selected unit there
      if (moveOptions?.moves.some((p) => samePosition(p, position))) {
        if (session.issueOrder(unitHexPosition, position)) clearSelection();
        return;
      }
    }

    // Select a unit, or switch to another one
    const options = session.getMoveOptions(position);
    if (options) {
      setUnitHexPosition(position);
      setMoveOptions(options);
      return;
    }

    // A unit that can't be ordered, or a hex the selected unit can't reach
    if (unitHexPosition || boardManager.getHex(position)?.hasUnit()) {
      flashInvalid(position);
    }
  };

  const handleHoldAndFire = () => {
    if (unitHexPosition && session.issueOrder(unitHexPosition, unitHexPosition)) {
      clearSelection();
    }
  };

  const selectedHex = unitHexPosition ? boardManager.getHex(unitHexPosition) : null;

  const instructions = () => {
    if (ordersCommitted) return null;
    if (ordersLeft <= 0) {
      return "No quedan órdenes: confirma las órdenes o deshaz la última";
    }
    if (selectedHex) {
      return "Toca una casilla resaltada para mover la unidad, o elige una acción";
    }
    return "Toca una unidad resaltada para darle una orden";
  };

  return (
    <div className="orders-layout">
      <div className="orders-layout__board">
        <Board
          onTileClick={handleTileClick}
          unitHexPosition={unitHexPosition}
          possibleMovePositions={moveOptions?.moves ?? []}
          possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
          boardManager={boardManager}
          orders={orders}
          invalidFlash={invalidFlash}
          locked={ordersCommitted}
          boardWidth={13}
          boardHeight={9}
          hexSize={50}
          faction={boardSide}
        />
      </div>

      <div className="orders-layout__controls">
        {ordersCommitted ? (
          <Alert severity="success" sx={{ width: "100%" }}>
            Órdenes confirmadas. Ya no se pueden cambiar.
          </Alert>
        ) : (
          <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
            {instructions()} · órdenes restantes: {ordersLeft}
          </Typography>
        )}

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
            <Typography variant="body2">Seleccionado: {selectedHex.getDescription()}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Terreno: {selectedHex.getType()} | Regla de movimiento:{" "}
              {selectedHex.getMovementRule()}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button onClick={handleHoldAndFire}>Mantener y disparar</Button>
              <Button variant="outlined" onClick={clearSelection}>
                Cancelar
              </Button>
            </Stack>
          </Paper>
        )}

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {!ordersCommitted && orders.length > 0 && !unitHexPosition && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()}>
              Volver
            </Button>
          )}
          {!ordersCommitted && ordersLeft <= 0 && (
            <Button onClick={() => session.commitOrders()}>Confirmar Órdenes</Button>
          )}
          {ordersCommitted && (
            <Button onClick={() => session.startBattle()}>Fase Batalla</Button>
          )}
        </Stack>
      </div>
    </div>
  );
}

export default OrdersView;
