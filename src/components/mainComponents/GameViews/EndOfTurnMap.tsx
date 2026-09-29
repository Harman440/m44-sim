import { useState } from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { UNIT_LABELS, describeHex } from "../../../labels";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import "./PhaseLayout.css";

interface EndOfTurnMapProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** The phase it is opened from: "Fase final", or "Órdenes" to fix the map before giving orders */
  title: string;
  /** What to do, before a unit is tapped */
  hint?: string;
  onDone: () => void;
}

/**
 * Map of the final phase. The battle is fought and the retreats are made on
 * the physical table; this lets the player mirror the result: remove destroyed
 * units and move units that retreated or took ground (to any empty hex; the
 * table is the source of truth). Also opened from Órdenes, before any order,
 * when the map turns out not to match the table.
 */
function EndOfTurnMap({
  faction,
  session,
  game,
  title,
  hint = "Refleja aquí las bajas, retiradas y terreno tomado de la mesa: toca una unidad",
  onDone,
}: EndOfTurnMapProps) {
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
      return;
    }
    if (game.reinforcementToPlace && !session.placeReinforcement(position)) flashInvalid(position);
  };

  const handleRemove = () => {
    if (selected && session.removeUnit(selected)) setSelected(null);
  };

  const selectedHex = selected ? boardManager.getHex(selected) : null;
  /** The Reinforcements card's cross, until its unit is on the map */
  const reinforcements = game.reinforcementDue || game.reinforcementToPlace !== null;

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
          markers={reinforcements ? game.markers : []}
          markerKind="cross"
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          {title}
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {selectedHex
            ? "Toca una casilla vacía para mover la unidad (retirada o avance), o elimínala"
            : game.reinforcementToPlace
              ? `Refuerzo (${UNIT_LABELS[game.reinforcementToPlace].toLowerCase()}): toca la casilla libre donde lo pones`
              : hint}
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
          {game.canUndoMapEdit && !selected && (
            <Button variant="outlined" onClick={() => session.undoBattleEdit()} startIcon={<GameIcon name="undo" />}>
              Deshacer
            </Button>
          )}
          <Button onClick={onDone} startIcon={<GameIcon name="confirm" />}>
            Listo
          </Button>
        </Stack>
      </div>
    </div>
  );
}

export default EndOfTurnMap;
