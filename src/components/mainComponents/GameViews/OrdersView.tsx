import { useContext, useState } from "react";
import { OpponentContext } from "../../OpponentContext";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import { useSound } from "../../../sound";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import SandbagsIcon from "../../SandbagsIcon";
import PlayedCards, { PLAY_LAYOUT_PREFIX, playedCardOf } from "../../PlayedCards";
import LeavingHand from "./LeavingHand";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    hold: "Mantener (no dispara)",
    holdAndFire: "Mantener y disparar",
    holdAndFireTimes: (n: number) => `Mantener y disparar ${n} veces`,
    promptMark: (n: number) => `Marca en el mapa: faltan ${n}`,
    tapHighlightedHex: "Toca una casilla resaltada",
    promptMarkCard: (card: string) => `Marca las casillas de ${card}`,
    promptConfirm: "Todas tus unidades tienen orden: confirma",
    promptTapUnit: "Toca una unidad para darle una orden",
    helpMark: (rule: string, n: number) => `${rule} Faltan ${n}.`,
    helpMarkCard: (card: string) => `Marca en el mapa las casillas de ${card} para poder confirmar.`,
    helpConfirm: "Todas tus unidades tienen orden: confirma las órdenes o deshaz la última.",
    helpSelected: "Toca una casilla resaltada para mover la unidad, o elige una acción: mantenerla en su casilla o cancelar.",
    helpTapUnit:
      "Toca una unidad para darle una orden; después, la casilla adonde se mueve. Las unidades sin orden descansan: confirma cuando quieras.",
    fixMapTitle: "Órdenes: actualizar mapa",
    fixMapHint: "Corrige el mapa para que coincida con la mesa: toca una unidad",
    changeCard: "Cambiar carta",
    stopMarking: "Dejar de marcar",
    markOnMap: "Marcar en el mapa",
    eraseLastMark: "Borrar última marca",
    resting: (n: number) => (n === 1 ? "1 unidad sin orden (descansa)" : `${n} unidades sin orden (descansan)`),
    selectedUnit: "Unidad seleccionada",
    hedgerowExit: ". Al salir de un seto solo avanza 1 casilla",
    hasSandbags: "Tiene sacos terreros: si se mueve, los pierde.",
    moveAndFire: "Mover y disparar",
    moveOnly: "Solo mover",
    cancel: "Cancelar",
    back: "Volver",
    confirmOrders: "Confirmar Órdenes",
    howToOrder: "Cómo dar órdenes",
    instructions: "Instrucciones",
    howToOrderText:
      "Las casillas resaltadas son adonde puede ir la unidad; la leyenda dice en cuáles aún podrá disparar. Tocar otra vez la unidad la deselecciona. «Volver» deshace la última orden.",
    updateMap: "Actualizar mapa",
    leftSandbags: "La unidad deja sus sacos terreros: quítalos de la mesa al moverla.",
    leftSandbagsShared: "La unidad deja sus sacos terreros al moverse.",
    confirmFixTitle: "¿Actualizar el mapa?",
    confirmFixText:
      "Solo si el mapa no coincide con la mesa: por ejemplo, si se cambió una tirada o falta una retirada del turno anterior. Se puede hacer mientras no hayas dado ninguna orden.",
  },
  en: {
    hold: "Hold (doesn't fire)",
    holdAndFire: "Hold and fire",
    holdAndFireTimes: (n: number) => `Hold and fire ${n} times`,
    promptMark: (n: number) => `Mark on the map: ${n} left`,
    tapHighlightedHex: "Tap a highlighted hex",
    promptMarkCard: (card: string) => `Mark the hexes for ${card}`,
    promptConfirm: "All your units have orders: confirm",
    promptTapUnit: "Tap a unit to give it an order",
    helpMark: (rule: string, n: number) => `${rule} ${n} left.`,
    helpMarkCard: (card: string) => `Mark the hexes for ${card} on the map to be able to confirm.`,
    helpConfirm: "All your units have orders: confirm the orders or undo the last one.",
    helpSelected: "Tap a highlighted hex to move the unit, or pick an action: hold it in its hex or cancel.",
    helpTapUnit: "Tap a unit to give it an order; then the hex it moves to. Units without an order rest: confirm whenever you like.",
    fixMapTitle: "Orders: update map",
    fixMapHint: "Fix the map so it matches the table: tap a unit",
    changeCard: "Change card",
    stopMarking: "Stop marking",
    markOnMap: "Mark on the map",
    eraseLastMark: "Erase last mark",
    resting: (n: number) => (n === 1 ? "1 unit without an order (rests)" : `${n} units without an order (they rest)`),
    selectedUnit: "Selected unit",
    hedgerowExit: ". Leaving a hedgerow it only moves 1 hex",
    hasSandbags: "It has sandbags: if it moves, it loses them.",
    moveAndFire: "Move and fire",
    moveOnly: "Move only",
    cancel: "Cancel",
    back: "Back",
    confirmOrders: "Confirm orders",
    howToOrder: "How to give orders",
    instructions: "Instructions",
    howToOrderText:
      "The highlighted hexes are where the unit can go; the legend says from which ones it can still fire. Tapping the unit again deselects it. “Back” undoes the last order.",
    updateMap: "Update map",
    leftSandbags: "The unit leaves its sandbags behind: take them off the table when you move it.",
    leftSandbagsShared: "The unit leaves its sandbags behind when it moves.",
    confirmFixTitle: "Update the map?",
    confirmFixText:
      "Only if the map doesn't match the table: for example, if a roll was changed or a retreat from the last turn is missing. It can be done as long as you haven't given any order.",
  },
});

type Text = (typeof TEXT)["es"];

interface OrdersViewProps {
  faction: Faction;
  session: GameSession;
  game: GameSnapshot;
  /** The card was just played: the rest of the hand slides off the screen */
  handLeaving?: boolean;
  onHandGone?: () => void;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      <Box sx={{ width: 18, height: 18, borderRadius: 0.5, bgcolor: color, flexShrink: 0, border: 1, borderColor: "divider" }} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

const holdLabel = (shots: number, t: Text) => {
  if (shots === 0) return t.hold;
  return shots === 1 ? t.holdAndFire : t.holdAndFireTimes(shots);
};

function OrdersView({ faction, session, game, handLeaving = false, onHandGone = () => {} }: OrdersViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const boardManager = session.board;
  const { orders } = game;
  const played = game.playedCard;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);
  /** The card's hexes marked so far, and how many are left */
  const markerRule = game.marking?.rule ?? null;
  const markersLeft = game.marking ? game.marking.rule.count - game.marking.marked : 0;
  /** Taps mark hexes for the card instead of ordering units */
  const [markMode, setMarkMode] = useState(false);
  const marking = markMode && game.marking !== null;

  const { flash: invalidFlash, flashInvalid } = useHexFlash();
  const play = useSound();
  /** Fixing the map before any order: asked first, then the map editor of the final phase */
  const [confirmMapFix, setConfirmMapFix] = useState(false);
  const [fixingMap, setFixingMap] = useState(false);
  /** The last order moved a unit off its sandbags: said for a moment */
  const [leftSandbags, setLeftSandbags] = useState(false);
  // Pass and play: there's no table, the app's map is the game
  const shared = useContext(OpponentContext) !== null;

  const clearSelection = () => {
    setUnitHexPosition(null);
    setMoveOptions(null);
  };

  const order = (from: Position, to: Position) => {
    const hadSandbags = !samePosition(from, to) && !!boardManager.getHex(from)?.sandbags;
    if (session.issueOrder(from, to)) {
      clearSelection();
      setLeftSandbags(hadSandbags);
    }
  };

  const toggleMarkMode = () => {
    clearSelection();
    setMarkMode((on) => !on);
  };

  // One tap per action so it works the same with a mouse or on a tablet
  const handleTileClick = (position: Position) => {
    if (marking) {
      if (!session.markHex(position)) {
        flashInvalid(position);
        return;
      }
      if (!session.getSnapshot().marking) setMarkMode(false);
      return;
    }

    if (unitHexPosition) {
      // Tapping the selected unit again deselects it
      if (samePosition(unitHexPosition, position)) {
        clearSelection();
        return;
      }
      // Tapping a highlighted hex moves the selected unit there
      if (moveOptions?.moves.some((p) => samePosition(p, position))) {
        order(unitHexPosition, position);
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

  const handleHold = () => {
    if (unitHexPosition) order(unitHexPosition, unitHexPosition);
  };

  const selectedHex = unitHexPosition ? boardManager.getHex(unitHexPosition) : null;

  /** What to do now, in a few words: always in sight */
  const prompt = () => {
    if (marking && markerRule) return t.promptMark(markersLeft);
    if (selectedHex) return t.tapHighlightedHex;
    if (game.marking) return t.promptMarkCard(tr(game.marking.card.name));
    if (game.orderable.length === 0) return t.promptConfirm;
    return t.promptTapUnit;
  };

  /** The same, explained: behind "Instrucciones" */
  const instructions = () => {
    if (marking && markerRule) return t.helpMark(labels.describeMarkerRule(markerRule), markersLeft);
    if (selectedHex) return t.helpSelected;
    if (game.marking) return t.helpMarkCard(tr(game.marking.card.name));
    if (game.orderable.length === 0) return t.helpConfirm;
    return t.helpTapUnit;
  };

  if (fixingMap && game.canEditMap) {
    return (
      <EndOfTurnMap
        faction={faction}
        session={session}
        game={game}
        title={t.fixMapTitle}
        hint={t.fixMapHint}
        onDone={() => setFixingMap(false)}
      />
    );
  }

  return (
    <div className="phase-layout">
      <div className="phase-layout__board">
        <Board
          zoomable
          onTileClick={handleTileClick}
          unitHexPosition={unitHexPosition}
          possibleMovePositions={moveOptions?.moves ?? []}
          possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
          boardManager={boardManager}
          orders={orders}
          backgroundImage={session.scenario.image}
          invalidFlash={invalidFlash}
          orderablePositions={marking ? [] : game.orderable}
          markers={game.markers}
          markerKind={game.markerKinds}
          markablePositions={marking ? game.markable : []}
          camouflaged={game.camouflaged}
          faction={faction}
        />
      </div>

      {/* While the card flies in, the column doesn't clip it (it scrolls the rest of the time) */}
      <div className={`phase-layout__controls${handLeaving ? " phase-layout__controls--arriving" : ""}`}>
        {/* The card played, flown here from the Command Zone's tray; tapping it shows its text */}
        <PlayedCards className="played-cards--orders" faction={faction} {...playedCardOf(game)} layoutPrefix={PLAY_LAYOUT_PREFIX} />
        {game.canUnpickCard && (
          <Button variant="outlined" onClick={() => session.unpickCard()} startIcon={<GameIcon name="undo" />}>
            {t.changeCard}
          </Button>
        )}
        {played?.marker && (
          <Paper variant="outlined" sx={{ p: 1.5, width: "100%" }} data-testid="order-card-marks">
            <Typography variant="body2" color="text.secondary">
              {labels.describeMarkerRule(played.marker)} ({game.markers.length}/{played.marker.count})
            </Typography>
            <Stack sx={{ gap: 1, mt: 1 }}>
              {game.marking && (
                <Button
                  variant={marking ? "contained" : "outlined"}
                  color="warning"
                  onClick={toggleMarkMode}
                  startIcon={<GameIcon name={marking ? "cancel" : "fire"} />}
                  aria-pressed={marking}
                >
                  {marking ? t.stopMarking : t.markOnMap}
                </Button>
              )}
              {game.markers.length > 0 && (
                <Button variant="text" color="inherit" onClick={() => session.undoMarker()} startIcon={<GameIcon name="undo" />}>
                  {t.eraseLastMark}
                </Button>
              )}
            </Stack>
          </Paper>
        )}
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body1" color="primary">
            {prompt()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t.resting(game.orderable.length)} · {labels.coins(game.coins)}
          </Typography>
        </Box>

        {selectedHex && (
          <Paper variant="outlined" sx={{ p: 1.5, width: "100%" }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
                {labels.describeHex(selectedHex)}
              </Typography>
              <InfoButton title={t.selectedUnit}>
                <Stack sx={{ gap: 1 }}>
                  <Typography variant="body1">{labels.describeHex(selectedHex)}.</Typography>
                  {moveOptions && (
                    <Typography variant="body1">
                      {labels.describeMovement(moveOptions.limits)}
                      {selectedHex.getTerrain().leaveOneHex && moveOptions.limits.maxMove > 1 && t.hedgerowExit}
                      .
                    </Typography>
                  )}
                </Stack>
              </InfoButton>
            </Stack>
            {selectedHex.sandbags && (moveOptions?.moves.length ?? 0) > 0 && (
              <Alert severity="warning" icon={<SandbagsIcon size={26} />} sx={{ mt: 1, py: 0 }} data-testid="sandbags-warning">
                {t.hasSandbags}
              </Alert>
            )}
            {/* Legend for the highlighted hexes (no hover on tablets) */}
            <Stack sx={{ gap: 0.5, my: 1 }}>
              {(moveOptions?.moveAndFire.length ?? 0) > 0 && (
                <LegendItem color="var(--m44-move-fire)" label={t.moveAndFire} />
              )}
              <LegendItem color="var(--m44-move-only)" label={t.moveOnly} />
            </Stack>
            <Stack sx={{ gap: 1 }}>
              <Button onClick={handleHold} startIcon={<GameIcon name={moveOptions?.limits.holdShots ? "fire" : "confirm"} />}>
                {holdLabel(moveOptions?.limits.holdShots ?? 1, t)}
              </Button>
              <Button variant="outlined" onClick={clearSelection} startIcon={<GameIcon name="cancel" />}>
                {t.cancel}
              </Button>
            </Stack>
          </Paper>
        )}

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
          {orders.length > 0 && !unitHexPosition && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()} startIcon={<GameIcon name="undo" />}>
              {t.back}
            </Button>
          )}
          {!game.marking && !unitHexPosition && (
            <Button onClick={() => session.commitOrders() && play("stamp")} startIcon={<GameIcon name="confirm" />}>
              {t.confirmOrders}
            </Button>
          )}
        </Stack>

        <Stack sx={{ mt: "auto", gap: 0.5 }}>
          <InfoButton title={t.howToOrder} label={t.instructions}>
            <Stack sx={{ gap: 1.5 }}>
              <Typography variant="body1" color="primary">
                {instructions()}
              </Typography>
              <Typography variant="body1">{t.howToOrderText}</Typography>
            </Stack>
          </InfoButton>
          {/* Out of the way, and asked first: only when the map doesn't match the table */}
          {game.canEditMap && !shared && !unitHexPosition && !marking && (
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={() => setConfirmMapFix(true)}
              startIcon={<GameIcon name="map" />}
              sx={{ color: "text.secondary" }}
            >
              {t.updateMap}
            </Button>
          )}
        </Stack>
      </div>

      <Snackbar
        open={leftSandbags}
        autoHideDuration={4000}
        onClose={() => setLeftSandbags(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" icon={<SandbagsIcon size={26} />} onClose={() => setLeftSandbags(false)} data-testid="sandbags-left">
          {shared ? t.leftSandbagsShared : t.leftSandbags}
        </Alert>
      </Snackbar>

      <Dialog open={confirmMapFix} onClose={() => setConfirmMapFix(false)}>
        <DialogTitle>{t.confirmFixTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body1">{t.confirmFixText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmMapFix(false)}>
            {t.cancel}
          </Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirmMapFix(false);
              setFixingMap(true);
            }}
            startIcon={<GameIcon name="map" />}
          >
            {t.updateMap}
          </Button>
        </DialogActions>
      </Dialog>

      {handLeaving && <LeavingHand cards={game.cards.filter((held) => held.card.id !== played?.id)} onGone={onHandGone} />}
    </div>
  );
}

export default OrdersView;
