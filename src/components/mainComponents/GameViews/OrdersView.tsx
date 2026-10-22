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
  List,
  ListItemButton,
  ListItemText,
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
import GameSession, { ActionOption, GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import type { UnitAction } from "../../../game-core/unitAction";
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
    hold: "Quedarse en su casilla (no dispara)",
    holdAndFire: "Quedarse en su casilla y disparar",
    holdAndFireTimes: (n: number) => `Quedarse en su casilla y disparar ${n} veces`,
    promptPickAction: "Elige una acción",
    actions: "Acciones",
    currentAction: (name: string) => `Orden: ${name}`,
    otherAction: "Otra acción",
    promptMark: (n: number) => `Marca en el mapa: faltan ${n}`,
    tapHighlightedHex: "Toca una casilla resaltada",
    tapNextHex: "Toca la siguiente casilla del camino",
    goHere: "Ir hasta aquí",
    stepBack: "Atrás",
    helpPath:
      "Toca casilla a casilla el camino de la unidad: cada una junto a la anterior. Toca otra vez la última, o «Ir hasta aquí», para que acabe ahí; «Atrás» quita la última.",
    promptMarkCard: (card: string) => `Marca las casillas de ${card}`,
    promptConfirm: "Todas tus unidades tienen orden: confirma",
    promptTapUnit: "Toca una unidad para darle una orden",
    helpMark: (rule: string, n: number) => `${rule} Faltan ${n}.`,
    helpMarkCard: (card: string) => `Marca en el mapa las casillas de ${card} para poder confirmar.`,
    helpConfirm: "Todas tus unidades tienen orden: confirma las órdenes o deshaz la última.",
    helpPickAction:
      "Elige la acción de la unidad. Cada una cuesta energía, combustible o equipo, que se paga al confirmar las órdenes; las que no puede pagar salen en gris.",
    helpSelected: "Toca una casilla resaltada para mover la unidad, quédate en su casilla, o elige otra acción.",
    helpTapUnit:
      "Toca una unidad para darle una acción; si se mueve, después la casilla adonde va. Las unidades sin orden descansan y recuperan más energía: confirma cuando quieras.",
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
      "Las casillas resaltadas son adonde puede ir la unidad con esa acción; la leyenda dice en cuáles aún podrá disparar. Tocar otra vez la unidad la deselecciona. A una unidad que se queda en su casilla se le puede cambiar la acción tocándola; «Volver» deshace la última orden.",
    updateMap: "Actualizar mapa",
    leftSandbags: "La unidad deja sus sacos terreros: quítalos de la mesa al moverla.",
    leftSandbagsShared: "La unidad deja sus sacos terreros al moverse.",
    confirmFixTitle: "¿Actualizar el mapa?",
    confirmFixText:
      "Solo si el mapa no coincide con la mesa: por ejemplo, si se cambió una tirada o falta una retirada del turno anterior. Se puede hacer mientras no hayas dado ninguna orden.",
  },
  en: {
    hold: "Stay in its hex (doesn't fire)",
    holdAndFire: "Stay in its hex and fire",
    holdAndFireTimes: (n: number) => `Stay in its hex and fire ${n} times`,
    promptPickAction: "Pick an action",
    actions: "Actions",
    currentAction: (name: string) => `Order: ${name}`,
    otherAction: "Another action",
    promptMark: (n: number) => `Mark on the map: ${n} left`,
    tapHighlightedHex: "Tap a highlighted hex",
    tapNextHex: "Tap the next hex of its path",
    goHere: "Go here",
    stepBack: "Back",
    helpPath:
      "Tap the unit's path hex by hex, each next to the last. Tap the last one again, or “Go here”, to end the move there; “Back” takes off the last one.",
    promptMarkCard: (card: string) => `Mark the hexes for ${card}`,
    promptConfirm: "All your units have orders: confirm",
    promptTapUnit: "Tap a unit to give it an order",
    helpMark: (rule: string, n: number) => `${rule} ${n} left.`,
    helpMarkCard: (card: string) => `Mark the hexes for ${card} on the map to be able to confirm.`,
    helpConfirm: "All your units have orders: confirm the orders or undo the last one.",
    helpPickAction:
      "Pick the unit's action. Each costs energy, fuel or equipment, paid when the orders are confirmed; the ones it can't pay for are greyed out.",
    helpSelected: "Tap a highlighted hex to move the unit, stay in its hex, or pick another action.",
    helpTapUnit:
      "Tap a unit to give it an action; if it moves, then the hex it goes to. Units without an order rest and get more energy back: confirm whenever you like.",
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
      "The highlighted hexes are where the unit can go with that action; the legend says from which ones it can still fire. Tapping the unit again deselects it. A unit that stays in its hex can be given another action by tapping it; “Back” undoes the last order.",
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

  // Selected unit, its actions, the one picked and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [chosen, setChosen] = useState<UnitAction | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);
  /** Pass and play: the path picked so far, hex by hex, from the unit's hex */
  const [path, setPath] = useState<Position[] | null>(null);
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
    setActions([]);
    setChosen(null);
    setMoveOptions(null);
    setPath(null);
  };

  const order = (from: Position, action: UnitAction, to: Position, route?: readonly Position[]) => {
    const hadSandbags = !samePosition(from, to) && !!boardManager.getHex(from)?.sandbags;
    if (session.giveAction(from, action.id, to, route)) {
      clearSelection();
      setLeftSandbags(hadSandbags);
    }
  };

  /** An action that doesn't move is given at once; one that moves shows its hexes on the map */
  const pickAction = (action: UnitAction) => {
    if (!unitHexPosition) return;
    const options = session.getMoveOptions(unitHexPosition, action.id);
    if (!options) return;
    if (options.limits.maxMove === 0) {
      order(unitHexPosition, action, unitHexPosition);
      return;
    }
    setChosen(action);
    setMoveOptions(options);
    // Pass and play: the path decides collisions, so the player picks it hex by hex
    setPath(shared ? [unitHexPosition] : null);
  };

  const otherAction = () => {
    setChosen(null);
    setMoveOptions(null);
    setPath(null);
  };

  /** The next hexes of the path being picked (pass and play) */
  const steps = unitHexPosition && chosen && path ? session.getNextSteps(unitHexPosition, chosen.id, path) : null;
  const pathEnd = path && path.length > 1 ? path[path.length - 1]! : null;

  /** The path goes on to `position`; with nowhere further to go, the move ends there */
  const step = (position: Position) => {
    if (!unitHexPosition || !chosen || !path) return;
    const longer = [...path, position];
    const next = session.getNextSteps(unitHexPosition, chosen.id, longer);
    if (next && next.moves.length > 0) setPath(longer);
    else order(unitHexPosition, chosen, position, longer);
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
      // Pass and play: a highlighted hex is the path's next step; its last hex again ends the move there
      if (chosen && path) {
        if (pathEnd && samePosition(pathEnd, position)) {
          order(unitHexPosition, chosen, position, path);
          return;
        }
        if (steps?.moves.some((p) => samePosition(p, position))) {
          step(position);
          return;
        }
      }
      // Tapping a highlighted hex moves the selected unit there
      if (chosen && !path && moveOptions?.moves.some((p) => samePosition(p, position))) {
        order(unitHexPosition, chosen, position);
        return;
      }
    }

    // Select a unit, or switch to another one: its actions are listed
    const unitActions = session.getActions(position);
    if (unitActions) {
      setUnitHexPosition(position);
      setActions(unitActions);
      setChosen(null);
      setMoveOptions(null);
      return;
    }

    // A unit that can't be ordered, or a hex the selected unit can't reach
    if (unitHexPosition || boardManager.getHex(position)?.hasUnit()) {
      flashInvalid(position);
    }
  };

  const handleHold = () => {
    if (unitHexPosition && chosen) order(unitHexPosition, chosen, unitHexPosition);
  };

  const selectedHex = unitHexPosition ? boardManager.getHex(unitHexPosition) : null;
  const selectedSupplies = unitHexPosition && game.supplies.find((each) => samePosition(each.position, unitHexPosition))?.supplies;
  const currentOrder = selectedHex?.unit && orders.find((each) => each.unit === selectedHex.unit);
  const currentAction = currentOrder && actions.find((each) => each.action.id === currentOrder.action)?.action;

  /** What to do now, in a few words: always in sight */
  const prompt = () => {
    if (marking && markerRule) return t.promptMark(markersLeft);
    if (selectedHex) return chosen ? (path ? t.tapNextHex : t.tapHighlightedHex) : t.promptPickAction;
    if (game.marking) return t.promptMarkCard(tr(game.marking.card.name));
    if (game.orderable.length === 0) return t.promptConfirm;
    return t.promptTapUnit;
  };

  /** The same, explained: behind "Instrucciones" */
  const instructions = () => {
    if (marking && markerRule) return t.helpMark(labels.describeMarkerRule(markerRule), markersLeft);
    if (selectedHex) return chosen ? (path ? t.helpPath : t.helpSelected) : t.helpPickAction;
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
          possibleMovePositions={(steps ?? moveOptions)?.moves ?? []}
          possibleMoveAndFirePositions={(steps ?? moveOptions)?.moveAndFire ?? []}
          pathPreview={path}
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
                {chosen ? `${labels.describeHex(selectedHex)} · ${tr(chosen.name)}` : labels.describeHex(selectedHex)}
              </Typography>
              <InfoButton title={t.selectedUnit}>
                <Stack sx={{ gap: 1 }}>
                  <Typography variant="body1">{labels.describeHex(selectedHex)}.</Typography>
                  {chosen && moveOptions && (
                    <>
                      <Typography variant="body1">{tr(chosen.description)}</Typography>
                      <Typography variant="body1">
                        {labels.describeMovement(moveOptions.limits)}
                        {selectedHex.getTerrain().leaveOneHex && moveOptions.limits.maxMove > 1 && !chosen.ignoresTerrain && t.hedgerowExit}
                        .
                      </Typography>
                    </>
                  )}
                </Stack>
              </InfoButton>
            </Stack>
            {selectedSupplies && (
              <Typography variant="body2" color="text.secondary" data-testid="unit-supplies">
                {labels.describeSupplies(selectedSupplies)}
              </Typography>
            )}
            {currentAction && !chosen && (
              <Typography variant="body2" color="primary">
                {t.currentAction(tr(currentAction.name))}
              </Typography>
            )}
            {selectedHex.sandbags && (moveOptions?.moves.length ?? 0) > 0 && (
              <Alert severity="warning" icon={<SandbagsIcon size={26} />} sx={{ mt: 1, py: 0 }} data-testid="sandbags-warning">
                {t.hasSandbags}
              </Alert>
            )}
            {chosen ? (
              <>
                {/* Legend for the highlighted hexes (no hover on tablets) */}
                <Stack sx={{ gap: 0.5, my: 1 }}>
                  {(moveOptions?.moveAndFire.length ?? 0) > 0 && (
                    <LegendItem color="var(--m44-move-fire)" label={t.moveAndFire} />
                  )}
                  <LegendItem color="var(--m44-move-only)" label={t.moveOnly} />
                </Stack>
                <Stack sx={{ gap: 1 }}>
                  {pathEnd && unitHexPosition ? (
                    // Pass and play, a path on its way: end it here, or take off its last hex
                    <>
                      <Button onClick={() => order(unitHexPosition, chosen, pathEnd, path!)} startIcon={<GameIcon name="confirm" />}>
                        {t.goHere}
                      </Button>
                      <Button variant="outlined" onClick={() => setPath(path!.slice(0, -1))} startIcon={<GameIcon name="undo" />}>
                        {t.stepBack}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleHold} startIcon={<GameIcon name={moveOptions?.limits.holdShots ? "fire" : "confirm"} />}>
                        {holdLabel(moveOptions?.limits.holdShots ?? 0, t)}
                      </Button>
                      <Button variant="outlined" onClick={otherAction} startIcon={<GameIcon name="undo" />}>
                        {t.otherAction}
                      </Button>
                    </>
                  )}
                </Stack>
              </>
            ) : (
              <List dense aria-label={t.actions} sx={{ my: 0.5 }}>
                {actions.map(({ action, refusal }) => (
                  <ListItemButton
                    key={action.id}
                    disabled={refusal !== null}
                    selected={action.id === currentAction?.id}
                    onClick={() => pickAction(action)}
                    sx={{ minHeight: 48, borderRadius: 1 }}
                  >
                    <ListItemText
                      primary={tr(action.name)}
                      secondary={refusal === null ? labels.describeCost(action.cost) : labels.actionRefusals[refusal]}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
            <Button variant="outlined" onClick={clearSelection} startIcon={<GameIcon name="cancel" />} sx={{ mt: 1, width: "100%" }}>
              {t.cancel}
            </Button>
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
