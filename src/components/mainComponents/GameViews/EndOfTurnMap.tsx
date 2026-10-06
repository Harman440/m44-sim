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
import { BarbedWireIcon } from "../../BarbedWire";
import SandbagsIcon from "../../SandbagsIcon";
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
 * table is the source of truth), put Fortify's sandbags on a unit, and mirror
 * the enemy's sandbags and the wire it removed on empty hexes. Also opened
 * from Órdenes, before any order, when the map turns out not to match the table.
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
    if (selected && boardManager.getHex(selected)?.hasUnit()) {
      if (session.relocateUnit(selected, position)) setSelected(null);
      else flashInvalid(position);
      return;
    }
    if (game.reinforcementToPlace) {
      if (!session.placeReinforcement(position)) flashInvalid(position);
      return;
    }
    // An empty hex: select it to mirror the enemy's sandbags, or take off wire
    setSelected(hex.canEnter() ? position : null);
  };

  const handleRemoveWire = () => {
    if (selected) session.removeWireAt(selected);
  };

  /** Fortify's sandbags on the selected unit, or the enemy's on the selected empty hex */
  const handlePlaceSandbags = () => {
    if (selected && session.placeSandbagsAt(selected)) setSelected(null);
  };

  const handleRemoveSandbags = () => {
    if (selected) session.removeSandbagsAt(selected);
  };

  const handleRemove = () => {
    if (selected && session.removeUnit(selected)) setSelected(null);
  };

  const selectedHex = selected ? boardManager.getHex(selected) : null;
  /** Removing the selected artillery leaves its crew as infantry (experimental rule) */
  const leavesCrew = !!selected && session.leavesCrew(selected);
  /** The Reinforcements card's cross, until its unit is on the map */
  const reinforcements = game.reinforcementDue || game.reinforcementToPlace !== null;
  const canPlaceSandbags = !!selected && session.canPlaceSandbags(selected);
  const fortifying = game.fortifiable.length > 0;

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
          orderablePositions={selected ? [] : game.fortifiable}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          {title}
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {selectedHex && !selectedHex.hasUnit()
            ? "Casilla vacía: pon o quita los sacos terreros del rival, o quita la alambrada, como en la mesa"
            : selectedHex
            ? "Toca una casilla vacía para mover la unidad (retirada o avance), o elimínala"
            : game.reinforcementToPlace
              ? `Refuerzo (${UNIT_LABELS[game.reinforcementToPlace].toLowerCase()}): toca la casilla libre donde lo pones`
              : fortifying
                ? "Fortificar: toca la infantería o artillería resaltada que recibe los sacos terreros"
                : hint}
        </Typography>

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Seleccionado: {describeHex(selectedHex)}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {selectedHex.hasUnit() && (
                <Button color="error" onClick={handleRemove} startIcon={<GameIcon name="cancel" />}>
                  {leavesCrew ? "Eliminar: queda infantería" : "Eliminar unidad"}
                </Button>
              )}
              {canPlaceSandbags && (
                <Button color="warning" onClick={handlePlaceSandbags} startIcon={<SandbagsIcon size={28} />}>
                  {selectedHex.hasUnit() ? "Fortificar: poner sacos terreros" : "Poner sacos terreros del rival"}
                </Button>
              )}
              {selectedHex.sandbags && (
                <Button color="warning" onClick={handleRemoveSandbags} startIcon={<SandbagsIcon size={28} />}>
                  Quitar sacos terreros
                </Button>
              )}
              {selectedHex.wire && (
                <Button color="warning" onClick={handleRemoveWire} startIcon={<BarbedWireIcon size={28} />}>
                  Quitar alambrada
                </Button>
              )}
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
