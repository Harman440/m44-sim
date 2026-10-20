import { useContext, useState } from "react";
import { OpponentContext } from "../../OpponentContext";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { defineMessages, useLabels, useMessages } from "../../../i18n/useI18n";
import GameSession, { GameSnapshot } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import { BarbedWireIcon } from "../../BarbedWire";
import SandbagsIcon from "../../SandbagsIcon";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    hint: "Refleja aquí las bajas, retiradas y terreno tomado de la mesa: toca una unidad",
    hintShared: "Para lo que diga una carta: toca una unidad",
    wireSelected: "Alambrada: quítala si ya no está en la mesa",
    unitSelected: "Toca una casilla vacía para mover la unidad (retirada o avance), o elimínala",
    placeReinforcement: (unit: string) => `Refuerzo (${unit.toLowerCase()}): toca la casilla libre donde lo pones`,
    repositioning: "Reposicionamiento: toca la casilla resaltada a la que va tu artillería, hasta 2 casillas",
    behindLines: "Tras las líneas enemigas: toca la casilla resaltada a la que va tu infantería, hasta 3 casillas",
    selected: (hex: string) => `Seleccionado: ${hex}`,
    removeLeavesCrew: "Eliminar: queda infantería",
    remove: "Eliminar unidad",
    removeSandbags: "Quitar sacos terreros",
    removeWire: "Quitar alambrada",
    cancel: "Cancelar",
    undo: "Deshacer",
    done: "Listo",
  },
  en: {
    hint: "Mirror the casualties, retreats and ground taken on the table: tap a unit",
    hintShared: "For what a card says: tap a unit",
    wireSelected: "Barbed wire: remove it if it's no longer on the table",
    unitSelected: "Tap an empty hex to move the unit (retreat or advance), or remove it",
    placeReinforcement: (unit: string) => `Reinforcement (${unit.toLowerCase()}): tap the free hex where you put it`,
    repositioning: "Reposition: tap the highlighted hex your artillery moves to, up to 2 hexes away",
    behindLines: "Behind Enemy Lines: tap the highlighted hex your infantry moves to, up to 3 hexes away",
    selected: (hex: string) => `Selected: ${hex}`,
    removeLeavesCrew: "Remove: infantry stays",
    remove: "Remove unit",
    removeSandbags: "Remove sandbags",
    removeWire: "Remove barbed wire",
    cancel: "Cancel",
    undo: "Undo",
    done: "Done",
  },
});

interface EndOfTurnMapProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** The phase it is opened from: the final phase, or the orders to fix the map before giving orders */
  title: string;
  /** What to do, before a unit is tapped */
  hint?: string;
  onDone: () => void;
}

/**
 * Map of the final phase. The battle is fought and the retreats are made on
 * the physical table; this lets the player mirror the result: remove destroyed
 * units and move units that retreated or took ground (to any empty hex; the
 * table is the source of truth). In pass and play it places a reinforcement and
 * moves the artillery given Reposition. Also opened from Órdenes, before any
 * order, when the map turns out not to match the table.
 */
function EndOfTurnMap({
  faction,
  session,
  game,
  title,
  hint,
  onDone,
}: EndOfTurnMapProps) {
  const t = useMessages(TEXT);
  // Pass and play: there's no table, the app's map is the game
  const shared = useContext(OpponentContext) !== null;
  const labels = useLabels();
  const boardManager = session.board;
  const [selected, setSelected] = useState<Position | null>(null);
  const { flash, flashInvalid } = useHexFlash();
  /** Pass and play: the unit a card moves after the battle, still to move (a reinforcement goes first) */
  const finalMove = game.reinforcementToPlace ? null : game.finalMove;

  const handleTileClick = (position: Position) => {
    const hex = boardManager.getHex(position);
    if (!hex) return;

    // Pass and play's card moves: Reposition's artillery, Behind Enemy Lines' infantry
    if (finalMove) {
      if (!session.makeFinalMove(position)) flashInvalid(position);
      return;
    }
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
    // An empty hex with barbed wire: select it to take the wire off
    setSelected(hex.wire ? position : null);
  };

  const handleRemoveWire = () => {
    if (selected && session.removeWireAt(selected) && !boardManager.getHex(selected)?.hasUnit()) setSelected(null);
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
  const reinforcements = game.reinforcementToPlace !== null;

  return (
    <div className="phase-layout">
      <div className="phase-layout__board">
        <Board
          onTileClick={handleTileClick}
          unitHexPosition={finalMove ? finalMove.from : selected}
          possibleMovePositions={finalMove ? [...finalMove.options] : []}
          possibleMoveAndFirePositions={[]}
          boardManager={boardManager}
          orders={game.orders}
          backgroundImage={session.scenario.image}
          camouflaged={game.camouflaged}
          invalidFlash={flash}
          markers={reinforcements ? game.markers.filter((_, i) => game.markerKinds[i] === "cross") : []}
          markerKind="cross"
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        <Typography variant="h6" sx={{ textAlign: "center" }}>
          {title}
        </Typography>
        <Typography variant="body1" color="primary" sx={{ textAlign: "center" }}>
          {selectedHex && !selectedHex.hasUnit()
            ? t.wireSelected
            : selectedHex
            ? t.unitSelected
            : game.reinforcementToPlace
              ? t.placeReinforcement(labels.units[game.reinforcementToPlace])
              : finalMove
                ? finalMove.card.effect?.kind === "reposition"
                  ? t.repositioning
                  : t.behindLines
                : (hint ?? (shared ? t.hintShared : t.hint))}
        </Typography>

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 2, width: "100%" }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {t.selected(labels.describeHex(selectedHex))}
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {selectedHex.hasUnit() && (
                <Button color="error" onClick={handleRemove} startIcon={<GameIcon name="cancel" />}>
                  {leavesCrew ? t.removeLeavesCrew : t.remove}
                </Button>
              )}
              {selectedHex.sandbags && (
                <Button color="warning" onClick={handleRemoveSandbags} startIcon={<SandbagsIcon size={28} />}>
                  {t.removeSandbags}
                </Button>
              )}
              {selectedHex.wire && (
                <Button color="warning" onClick={handleRemoveWire} startIcon={<BarbedWireIcon size={28} />}>
                  {t.removeWire}
                </Button>
              )}
              <Button variant="outlined" onClick={() => setSelected(null)}>
                {t.cancel}
              </Button>
            </Stack>
          </Paper>
        )}

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {game.canUndoMapEdit && !selected && (
            <Button variant="outlined" onClick={() => session.undoBattleEdit()} startIcon={<GameIcon name="undo" />}>
              {t.undo}
            </Button>
          )}
          <Button onClick={onDone} startIcon={<GameIcon name="confirm" />}>
            {t.done}
          </Button>
        </Stack>
      </div>
    </div>
  );
}

export default EndOfTurnMap;
