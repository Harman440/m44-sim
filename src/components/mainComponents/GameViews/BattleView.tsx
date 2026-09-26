import { useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import "./PhaseLayout.css";

interface BattleViewProps {
  boardSide: string;
  session: GameSession;
  game: GameSnapshot;
  onFinishTurn: () => void;
}

const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

/**
 * The battle is fought on the physical table. This screen lets the player
 * mirror the result: remove destroyed units and move units that retreated or
 * took ground (to any empty hex; the table is the source of truth).
 */
function BattleView({ boardSide, session, game, onFinishTurn }: BattleViewProps) {
  const boardManager = session.board;
  const [selected, setSelected] = useState<Position | null>(null);
  const { flash, flashInvalid } = useHexFlash();

  const handleTileClick = (position: Position) => {
    const hex = boardManager.getHex(position);
    if (!hex) return;

    if (selected && samePosition(selected, position)) {
      setSelected(null);
      return;
    }
    if (hex.hasUnit()) {
      setSelected(position);
      return;
    }
    if (selected) {
      if (session.relocateUnit(selected, position)) setSelected(null);
      else flashInvalid(position);
    }
  };

  const handleRemove = () => {
    if (selected && session.removeUnit(selected)) setSelected(null);
  };

  const selectedHex = selected ? boardManager.getHex(selected) : null;

  return (
    <div className="phase-layout">
      <div className="phase-layout__board">
        <Board
          onTileClick={handleTileClick}
          unitHexPosition={selected}
          possibleMovePositions={[]}
          possibleMoveAndFirePositions={[]}
          boardManager={boardManager}
          orders={game.orders}
          backgroundImage={session.scenario.image}
          invalidFlash={flash}
          boardWidth={13}
          boardHeight={9}
          hexSize={50}
          faction={boardSide}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          Fase Batalla
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {selectedHex
            ? "Toca una casilla vacía para mover la unidad (retirada o avance), o elimínala"
            : "Resuelve la batalla en el tablero y refleja aquí las bajas y retiradas: toca una unidad"}
        </Typography>

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Seleccionado: {selectedHex.getDescription()}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button color="error" onClick={handleRemove}>
                Eliminar unidad
              </Button>
              <Button variant="outlined" onClick={() => setSelected(null)}>
                Cancelar
              </Button>
            </Stack>
          </Paper>
        )}

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {game.battleEdits > 0 && !selected && (
            <Button variant="outlined" onClick={() => session.undoBattleEdit()}>
              Deshacer
            </Button>
          )}
          <Button onClick={onFinishTurn}>Terminar Turno</Button>
        </Stack>
      </div>
    </div>
  );
}

export default BattleView;
