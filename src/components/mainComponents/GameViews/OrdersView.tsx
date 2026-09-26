import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { describeHex, describeMovement } from "../../../labels";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import "./PhaseLayout.css";

interface OrdersViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
}


function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: color, flexShrink: 0 }} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

function OrdersView({ faction, session, game }: OrdersViewProps) {
  const boardManager = session.board;
  const { orders, ordersLeft, ordersCommitted } = game;
  const canGiveOrders = !ordersCommitted && ordersLeft > 0;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);

  const { flash: invalidFlash, flashInvalid } = useHexFlash();

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
    <div className="phase-layout">
      <div className="phase-layout__board">
        <Board
          onTileClick={handleTileClick}
          unitHexPosition={unitHexPosition}
          possibleMovePositions={moveOptions?.moves ?? []}
          possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
          boardManager={boardManager}
          orders={orders}
          backgroundImage={session.scenario.image}
          invalidFlash={invalidFlash}
          locked={ordersCommitted}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
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
            <Typography variant="body2">Seleccionado: {describeHex(selectedHex)}</Typography>
            {selectedHex.unit && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {describeMovement(selectedHex.unit)}
              </Typography>
            )}
            {/* Legend for the highlighted hexes (no hover on tablets) */}
            <Stack sx={{ gap: 0.5, mb: 1.5 }}>
              <LegendItem color="rgba(67, 160, 71, 0.8)" label="Mover y disparar" />
              <LegendItem color="rgba(255, 179, 0, 0.8)" label="Solo mover (no podrá disparar)" />
            </Stack>
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
