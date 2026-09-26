import { useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { describeHex } from "../../../labels";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import "./PhaseLayout.css";

interface BattleMapProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  onShowSummary: () => void;
  onFinishTurn: () => void;
}


/**
 * Map view of the battle phase. The battle is fought on the physical table;
 * this lets the player mirror the result: remove destroyed units and move
 * units that retreated or took ground (to any empty hex; the table is the
 * source of truth).
 */
function BattleMap({ faction, session, game, onShowSummary, onFinishTurn }: BattleMapProps) {
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
  // Units that have used all their shots get a check badge on the map
  const firedUnits = new Set(
    game.orders.filter((_, i) => game.shots.filter((s) => s.orderIndex === i).length >= game.firesPerUnit).map((o) => o.unit)
  );

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
          firedUnits={firedUnits}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          Fase Batalla
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {selectedHex
            ? "Toca una casilla vacía para mover la unidad (retirada o avance), o elimínala"
            : "Refleja aquí las bajas y retiradas del tablero: toca una unidad"}
        </Typography>

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Seleccionado: {describeHex(selectedHex)}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button color="error" onClick={handleRemove} startIcon={<GameIcon name="cancel" />}>
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
            <Button variant="outlined" onClick={() => session.undoBattleEdit()} startIcon={<GameIcon name="undo" />}>
              Deshacer
            </Button>
          )}
          <Button variant="outlined" onClick={onShowSummary}>
            Volver al resumen
          </Button>
          <Button onClick={onFinishTurn} startIcon={<GameIcon name="endTurn" />}>
            Terminar Turno
          </Button>
        </Stack>
      </div>
    </div>
  );
}

export default BattleMap;
