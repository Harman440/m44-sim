import { useState } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Position } from "../../../types/scenario";
import { Faction } from "../../../types/faction";
import { samePosition } from "../../../game-core/position";
import Board from "../../Board";
import { useHexFlash } from "../../useHexFlash";
import type { Labels } from "../../../labels";
import { defineMessages, useLabels, useMessages, useTr } from "../../../i18n/useI18n";
import { EXTRA_SLOT, OrderSlot, sameSlot } from "../../../game-core/orderRules";
import { EXTRA_ORDER_COST } from "../../../data/coinRules";
import CommandCard from "../../../game-core/commandCard";
import { UnitType } from "../../../game-core/unit";
import GameSession, { GameSnapshot, MoveOptions } from "../../../game-core/gameSession";
import GameIcon from "../../GameIcon";
import { useSound } from "../../../sound";
import { HexType } from "../../../types/hex";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import SandbagsIcon from "../../SandbagsIcon";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    extraOrderCoins: (cost: number) => `Orden extra (${cost} suministros)`,
    onTheMove: "En movimiento (no dispara)",
    sectionOrder: (section: string) => `Orden del ${section}`,
    cardOrder: "Orden de la carta",
    hold: "Mantener (no dispara)",
    holdAndFire: "Mantener y disparar",
    holdAndFireTimes: (n: number) => `Mantener y disparar ${n} veces`,
    promptMark: (n: number) => `Marca en el mapa: faltan ${n}`,
    tapHighlightedHex: "Toca una casilla resaltada",
    promptExtra: "Orden extra: toca cualquier unidad sin orden",
    promptPaid: "Da las órdenes que quieras pagar y confirma",
    promptCantAfford: "No te llega para más órdenes de la carta",
    promptNoOrders: "Esta carta no da órdenes: confírmalas",
    promptMarkCard: (card: string) => `Marca las casillas de ${card}`,
    promptConfirm: "No quedan órdenes: confirma",
    promptTapUnit: "Toca una unidad resaltada",
    helpMark: (rule: string, n: number) => `${rule} Faltan ${n}.`,
    helpExtraSelected: "Orden extra: toca una casilla resaltada para mover la unidad, o elige una acción.",
    helpExtra: (cost: number) =>
      `Orden extra (${cost} suministros): toca cualquier unidad sin orden. No tiene las ventajas de la carta.`,
    helpPaid: (costs: string) =>
      `Cada orden de la carta cuesta suministros (${costs}): da las que quieras pagar y confirma.`,
    helpCantAfford: "No te llega para más órdenes de la carta: confirma las órdenes o deshaz la última.",
    helpNoOrders: "Esta carta no da órdenes: confírmalas. En la batalla marcarás las unidades en asalto cercano.",
    helpMarkCard: (card: string) => `Marca en el mapa las casillas de ${card} para poder confirmar.`,
    helpConfirm: "No quedan órdenes: confirma las órdenes o deshaz la última.",
    helpSelected: "Toca una casilla resaltada para mover la unidad, o elige una acción: mantenerla en su casilla o cancelar.",
    helpTapUnit: "Toca una unidad resaltada para darle una orden; después, la casilla adonde se mueve.",
    fixMapTitle: "Órdenes: actualizar mapa",
    fixMapHint: "Corrige el mapa para que coincida con la mesa: toca una unidad",
    changeCard: "Cambiar carta",
    combatCardTitle: (card: string) => `Carta de combate: ${card}`,
    notePaper: "Si hace falta, anota en papel sobre qué unidades la usas.",
    reinforcementsHere: "Refuerzos en este mapa:",
    stopMarking: "Dejar de marcar",
    markOnMap: "Marcar en el mapa",
    eraseLastMark: "Borrar última marca",
    remove: "Quitar",
    cardOrdersLeft: (n: number) => `Órdenes de la carta: ${n}`,
    ordersLeft: (n: number) => `Órdenes restantes: ${n}`,
    selectedUnit: "Unidad seleccionada",
    hedgerowExit: ". Al salir de un seto solo avanza 1 casilla",
    extraOrderHelp: (cost: number) => `Orden extra: cuesta ${cost} suministros y no tiene las ventajas de la carta.`,
    extraOrderCost: (coins: string) => `Orden extra: cuesta ${coins}`,
    hasSandbags: "Tiene sacos terreros: si se mueve, los pierde.",
    orderCosts: (coins: string) => `Esta orden cuesta ${coins}`,
    moveAndFire: "Mover y disparar",
    moveOnly: "Solo mover",
    useCard: (card: string, left: number) => `Usar ${card} (${left === 1 ? "queda 1" : `quedan ${left}`})`,
    whichOrder: "¿Qué orden usa esta unidad?",
    whichOrderLabel: "Orden que usa la unidad",
    cancel: "Cancelar",
    cancelExtra: "Cancelar orden extra",
    back: "Volver",
    confirmOrders: "Confirmar Órdenes",
    howToOrder: "Cómo dar órdenes",
    instructions: "Instrucciones",
    howToOrderText:
      "Las casillas resaltadas son adonde puede ir la unidad; la leyenda dice en cuáles aún podrá disparar. Tocar otra vez la unidad la deselecciona. «Volver» deshace la última orden.",
    extraOrderRule: (coins: string) => `Una orden extra cuesta ${coins} y no tiene las ventajas de la carta.`,
    updateMap: "Actualizar mapa",
    leftSandbags: "La unidad deja sus sacos terreros: quítalos de la mesa al moverla.",
    confirmFixTitle: "¿Actualizar el mapa?",
    confirmFixText:
      "Solo si el mapa no coincide con la mesa: por ejemplo, si se cambió una tirada o falta una retirada del turno anterior. Se puede hacer mientras no hayas dado ninguna orden.",
  },
  en: {
    extraOrderCoins: (cost: number) => `Extra order (${cost} supplies)`,
    onTheMove: "On the move (doesn't fire)",
    sectionOrder: (section: string) => `${section} order`,
    cardOrder: "The card's order",
    hold: "Hold (doesn't fire)",
    holdAndFire: "Hold and fire",
    holdAndFireTimes: (n: number) => `Hold and fire ${n} times`,
    promptMark: (n: number) => `Mark on the map: ${n} left`,
    tapHighlightedHex: "Tap a highlighted hex",
    promptExtra: "Extra order: tap any unit without an order",
    promptPaid: "Give the orders you want to pay for and confirm",
    promptCantAfford: "You can't afford more of the card's orders",
    promptNoOrders: "This card gives no orders: confirm them",
    promptMarkCard: (card: string) => `Mark the hexes for ${card}`,
    promptConfirm: "No orders left: confirm",
    promptTapUnit: "Tap a highlighted unit",
    helpMark: (rule: string, n: number) => `${rule} ${n} left.`,
    helpExtraSelected: "Extra order: tap a highlighted hex to move the unit, or pick an action.",
    helpExtra: (cost: number) =>
      `Extra order (${cost} supplies): tap any unit without an order. It doesn't get the card's advantages.`,
    helpPaid: (costs: string) =>
      `Each of the card's orders costs supplies (${costs}): give the ones you want to pay for and confirm.`,
    helpCantAfford: "You can't afford more of the card's orders: confirm the orders or undo the last one.",
    helpNoOrders: "This card gives no orders: confirm them. In the battle you'll mark the units in close assault.",
    helpMarkCard: (card: string) => `Mark the hexes for ${card} on the map to be able to confirm.`,
    helpConfirm: "No orders left: confirm the orders or undo the last one.",
    helpSelected: "Tap a highlighted hex to move the unit, or pick an action: hold it in its hex or cancel.",
    helpTapUnit: "Tap a highlighted unit to give it an order; then the hex it moves to.",
    fixMapTitle: "Orders: update map",
    fixMapHint: "Fix the map so it matches the table: tap a unit",
    changeCard: "Change card",
    combatCardTitle: (card: string) => `Combat card: ${card}`,
    notePaper: "If needed, note on paper which units you use it on.",
    reinforcementsHere: "Reinforcements on this map:",
    stopMarking: "Stop marking",
    markOnMap: "Mark on the map",
    eraseLastMark: "Erase last mark",
    remove: "Remove",
    cardOrdersLeft: (n: number) => `Card orders: ${n}`,
    ordersLeft: (n: number) => `Orders left: ${n}`,
    selectedUnit: "Selected unit",
    hedgerowExit: ". Leaving a hedgerow it only moves 1 hex",
    extraOrderHelp: (cost: number) => `Extra order: costs ${cost} supplies and doesn't get the card's advantages.`,
    extraOrderCost: (coins: string) => `Extra order: costs ${coins}`,
    hasSandbags: "It has sandbags: if it moves, it loses them.",
    orderCosts: (coins: string) => `This order costs ${coins}`,
    moveAndFire: "Move and fire",
    moveOnly: "Move only",
    useCard: (card: string, left: number) => `Use ${card} (${left} left)`,
    whichOrder: "Which order does this unit use?",
    whichOrderLabel: "Order the unit uses",
    cancel: "Cancel",
    cancelExtra: "Cancel extra order",
    back: "Back",
    confirmOrders: "Confirm orders",
    howToOrder: "How to give orders",
    instructions: "Instructions",
    howToOrderText:
      "The highlighted hexes are where the unit can go; the legend says from which ones it can still fire. Tapping the unit again deselects it. “Back” undoes the last order.",
    extraOrderRule: (coins: string) => `An extra order costs ${coins} and doesn't get the card's advantages.`,
    updateMap: "Update map",
    leftSandbags: "The unit leaves its sandbags behind: take them off the table when you move it.",
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
}


function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      <Box sx={{ width: 18, height: 18, borderRadius: 0.5, bgcolor: color, flexShrink: 0, border: 1, borderColor: "divider" }} />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

/** What an order slot means, for picking one */
const slotLabel = (slot: OrderSlot, t: Text, labels: Labels) => {
  if (slot.extra) return t.extraOrderCoins(EXTRA_ORDER_COST);
  if (slot.onTheMove) return t.onTheMove;
  return slot.section ? t.sectionOrder(labels.sections[slot.section]) : t.cardOrder;
};

const slotKey = (slot: OrderSlot) => `${slot.section ?? "card"}-${slot.onTheMove}-${!!slot.extra}`;

/** "infantería 1, tanque 2, artillería 2": what each of the card's orders costs */
const describeCoinCost = (card: CommandCard, labels: Labels) =>
  Object.values(UnitType)
    .filter((type) => card.coinCostOf(type) > 0)
    .map((type) => `${labels.units[type].toLowerCase()} ${card.coinCostOf(type)}`)
    .join(", ");

/** The slot used when the player doesn't pick: the card's only order, else on the move; null when they must pick */
function defaultSlot(slots: readonly OrderSlot[]): OrderSlot | null {
  const cardSlots = slots.filter((slot) => !slot.onTheMove);
  if (cardSlots.length > 1) return null;
  return cardSlots[0] ?? slots[0] ?? null;
}

const holdLabel = (shots: number, t: Text) => {
  if (shots === 0) return t.hold;
  return shots === 1 ? t.holdAndFire : t.holdAndFireTimes(shots);
};

function OrdersView({ faction, session, game }: OrdersViewProps) {
  const t = useMessages(TEXT);
  const labels = useLabels();
  const tr = useTr();
  const boardManager = session.board;
  const { orders, ordersLeft } = game;
  const paidCard = game.activeCard?.paidInCoins ?? false;

  // Selected unit and its highlighted destinations (UI state only)
  const [unitHexPosition, setUnitHexPosition] = useState<Position | null>(null);
  const [moveOptions, setMoveOptions] = useState<MoveOptions | null>(null);
  /** Which of the card's orders the selected unit takes, when it could take more than one */
  const [slot, setSlot] = useState<OrderSlot | null>(null);
  const [slotHint, setSlotHint] = useState(false);
  /** The selected unit uses the order combat card's movement (Frozen Ground…) */
  const [boost, setBoost] = useState(false);
  const moveEffect = game.orderCombatCard?.effect?.kind === "move" ? game.orderCombatCard.effect : null;
  const boostsLeft = moveEffect ? moveEffect.units - orders.filter((o) => o.boosted).length : 0;
  /** The next unit tapped takes an extra order bought with coins */
  const [extraMode, setExtraMode] = useState(false);
  const canBuyExtra = game.extraOrderable.length > 0;
  const markerRule = game.orderCombatCard?.marker ?? null;
  const markersLeft = markerRule ? markerRule.count - game.markers.length : 0;
  /** Taps mark hexes for the combat card instead of ordering units */
  const [markMode, setMarkMode] = useState(false);
  const marking = markMode && markersLeft > 0;

  const { flash: invalidFlash, flashInvalid } = useHexFlash();
  const play = useSound();
  /** Fixing the map before any order: asked first, then the map editor of the final phase */
  const [confirmMapFix, setConfirmMapFix] = useState(false);
  const [fixingMap, setFixingMap] = useState(false);
  /** The last order moved a unit off its sandbags: said for a moment */
  const [leftSandbags, setLeftSandbags] = useState(false);

  const clearSelection = () => {
    setUnitHexPosition(null);
    setMoveOptions(null);
    setSlot(null);
    setSlotHint(false);
    setBoost(false);
  };

  const toggleBoost = () => {
    if (!unitHexPosition) return;
    const next = !boost;
    const options = session.getMoveOptions(unitHexPosition, slot ?? undefined, next);
    if (!options) return;
    setBoost(next);
    setMoveOptions(options);
  };

  const choosingSlot = (moveOptions?.slots.length ?? 0) > 1;

  /** Give the order, once the player has picked the slot where there's a choice */
  const order = (from: Position, to: Position) => {
    if (choosingSlot && !slot) {
      setSlotHint(true);
      flashInvalid(to);
      return;
    }
    const hadSandbags = !samePosition(from, to) && !!boardManager.getHex(from)?.sandbags;
    if (session.issueOrder(from, to, slot ?? undefined, boost)) {
      clearSelection();
      setExtraMode(false);
      setLeftSandbags(hadSandbags);
    }
  };

  const toggleExtraMode = () => {
    clearSelection();
    setMarkMode(false);
    setExtraMode((on) => !on);
  };

  const toggleMarkMode = () => {
    clearSelection();
    setExtraMode(false);
    setMarkMode((on) => !on);
  };

  const pickSlot = (key: string | null) => {
    const picked = moveOptions?.slots.find((s) => slotKey(s) === key);
    if (!picked || !unitHexPosition) return;
    setSlot(picked);
    setSlotHint(false);
    // The card's movement may not apply to this slot (Rattenkrieg on the move): drop it
    const boosted = boost ? session.getMoveOptions(unitHexPosition, picked, true) : null;
    if (boost && !boosted) setBoost(false);
    setMoveOptions(boosted ?? session.getMoveOptions(unitHexPosition, picked, false));
  };

  // One tap per action so it works the same with a mouse or on a tablet
  const handleTileClick = (position: Position) => {
    if (marking) {
      if (!session.markHex(position)) flashInvalid(position);
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
    const options = session.getMoveOptions(position, extraMode ? EXTRA_SLOT : undefined);
    if (options) {
      setUnitHexPosition(position);
      setMoveOptions(options);
      setSlot(extraMode ? EXTRA_SLOT : defaultSlot(options.slots));
      setSlotHint(false);
      setBoost(false);
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
    if (extraMode) return selectedHex ? t.tapHighlightedHex : t.promptExtra;
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0 ? t.promptPaid : t.promptCantAfford;
    }
    if (game.activeCard?.closeAssaultOnly) return t.promptNoOrders;
    if (ordersLeft <= 0 && markersLeft > 0) return t.promptMarkCard(tr(game.orderCombatCard!.name));
    if (ordersLeft <= 0) return t.promptConfirm;
    if (selectedHex) return t.tapHighlightedHex;
    return t.promptTapUnit;
  };

  /** The same, explained: behind "Instrucciones" */
  const instructions = () => {
    if (marking && markerRule) {
      return t.helpMark(labels.describeMarkerRule(markerRule), markersLeft);
    }
    if (extraMode) {
      return selectedHex ? t.helpExtraSelected : t.helpExtra(EXTRA_ORDER_COST);
    }
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0 ? t.helpPaid(describeCoinCost(game.activeCard!, labels)) : t.helpCantAfford;
    }
    if (game.activeCard?.closeAssaultOnly) {
      return t.helpNoOrders;
    }
    if (ordersLeft <= 0 && markersLeft > 0) {
      return t.helpMarkCard(tr(game.orderCombatCard!.name));
    }
    if (ordersLeft <= 0) {
      return t.helpConfirm;
    }
    if (selectedHex) {
      return t.helpSelected;
    }
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
          onTileClick={handleTileClick}
          unitHexPosition={unitHexPosition}
          possibleMovePositions={moveOptions?.moves ?? []}
          possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
          boardManager={boardManager}
          orders={orders}
          backgroundImage={session.scenario.image}
          invalidFlash={invalidFlash}
          orderablePositions={marking ? [] : extraMode ? game.extraOrderable : game.orderable}
          markers={game.markers}
          markerKind={markerRule?.kind}
          markablePositions={marking ? game.markable : []}
          faction={faction}
        />
      </div>

      <div className="phase-layout__controls">
        {game.activeCard && (
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
            <Typography variant="subtitle1" component="h2" sx={{ flex: 1, fontWeight: 700, lineHeight: 1.25 }}>
              {tr(game.activeCard.name)}
            </Typography>
            <InfoButton title={tr(game.activeCard.name)}>
              <Typography variant="body1">{tr(game.activeCard.description)}</Typography>
            </InfoButton>
          </Stack>
        )}
        {game.canUnpickCard && (
          <Button variant="outlined" onClick={() => session.unpickCard()} startIcon={<GameIcon name="undo" />}>
            {t.changeCard}
          </Button>
        )}
        {game.orderCombatCard && (
          <Paper variant="outlined" sx={{ p: 1.5, width: "100%" }} data-testid="order-combat-card">
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <GameIcon name="cards" />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
                {tr(game.orderCombatCard.name)}
              </Typography>
              <InfoButton title={t.combatCardTitle(tr(game.orderCombatCard.name))}>
                <Typography variant="body1">{tr(game.orderCombatCard.description)}</Typography>
                {!markerRule && (
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {t.notePaper}
                  </Typography>
                )}
                {game.orderCombatCard.effect?.kind === "reinforcements" && session.scenario.reinforcements && (
                  <Typography variant="body1" sx={{ mt: 1 }} data-testid="reinforcements-table">
                    <strong>{t.reinforcementsHere}</strong> {labels.describeReinforcements(session.scenario.reinforcements)}
                  </Typography>
                )}
              </InfoButton>
            </Stack>
            {markerRule && (
              <Typography variant="body2" color="text.secondary">
                {labels.describeMarkerRule(markerRule)} ({game.markers.length}/{markerRule.count})
              </Typography>
            )}
            <Stack sx={{ gap: 1, mt: 1 }}>
              {markerRule && (markersLeft > 0 || marking) && (
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
              {markerRule && game.markers.length > 0 && (
                <Button variant="text" color="inherit" onClick={() => session.undoMarker()} startIcon={<GameIcon name="undo" />}>
                  {t.eraseLastMark}
                </Button>
              )}
              <Button variant="text" color="inherit" onClick={() => session.cancelOrderCombatCard()} startIcon={<GameIcon name="cancel" />}>
                {t.remove}
              </Button>
            </Stack>
          </Paper>
        )}
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="body1" color="primary">
            {prompt()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {paidCard ? t.cardOrdersLeft(game.cardOrdersLeft) : t.ordersLeft(ordersLeft)} ·{" "}
            {labels.coins(game.coins)}
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
                      {selectedHex.getType() === HexType.HEDGEROW && moveOptions.limits.maxMove > 1 && t.hedgerowExit}
                      .
                    </Typography>
                  )}
                  {slot?.extra && (
                    <Typography variant="body1">
                      {t.extraOrderHelp(EXTRA_ORDER_COST)}
                    </Typography>
                  )}
                </Stack>
              </InfoButton>
            </Stack>
            {slot?.extra && (
              <Typography variant="body2" color="warning.main">
                {t.extraOrderCost(labels.coins(EXTRA_ORDER_COST))}
              </Typography>
            )}
            {selectedHex.sandbags && (moveOptions?.moves.length ?? 0) > 0 && (
              <Alert severity="warning" icon={<SandbagsIcon size={26} />} sx={{ mt: 1, py: 0 }} data-testid="sandbags-warning">
                {t.hasSandbags}
              </Alert>
            )}
            {paidCard && !slot?.extra && !slot?.onTheMove && game.activeCard && selectedHex.unit && (
              <Typography variant="body2" color="warning.main">
                {t.orderCosts(labels.coins(game.activeCard.coinCostOf(selectedHex.unit.getUnitType())))}
              </Typography>
            )}
            {/* Legend for the highlighted hexes (no hover on tablets) */}
            <Stack sx={{ gap: 0.5, my: 1 }}>
              {(moveOptions?.moveAndFire.length ?? 0) > 0 && (
                <LegendItem color="var(--m44-move-fire)" label={t.moveAndFire} />
              )}
              <LegendItem color="var(--m44-move-only)" label={t.moveOnly} />
            </Stack>
            {game.orderCombatCard && moveEffect && (moveOptions?.canBoost || boost) && (
              <ToggleButton
                value="boost"
                selected={boost}
                onChange={toggleBoost}
                color="warning"
                fullWidth
                sx={{ minHeight: 48, gap: 1, mb: 1 }}
              >
                <GameIcon name="cards" /> {t.useCard(tr(game.orderCombatCard.name), boostsLeft)}
              </ToggleButton>
            )}
            {choosingSlot && moveOptions && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color={slotHint ? "error" : "text.primary"} sx={{ mb: 0.5 }}>
                  {t.whichOrder}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  orientation="vertical"
                  fullWidth
                  value={slot ? slotKey(slot) : null}
                  onChange={(_, key: string | null) => pickSlot(key)}
                  aria-label={t.whichOrderLabel}
                >
                  {moveOptions.slots.map((s) => (
                    <ToggleButton key={slotKey(s)} value={slotKey(s)} sx={{ minHeight: 48 }}>
                      {slotLabel(s, t, labels)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}
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
          {!marking && !game.extraTurn && (canBuyExtra || extraMode) && (
            <Button
              variant={extraMode ? "contained" : "outlined"}
              color="warning"
              onClick={toggleExtraMode}
              startIcon={<GameIcon name={extraMode ? "cancel" : "coins"} />}
              aria-pressed={extraMode}
            >
              {extraMode ? t.cancelExtra : t.extraOrderCoins(EXTRA_ORDER_COST)}
            </Button>
          )}
          {orders.length > 0 && !unitHexPosition && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()} startIcon={<GameIcon name="undo" />}>
              {t.back}
            </Button>
          )}
          {ordersLeft <= 0 && markersLeft <= 0 && (
            <Button
              onClick={() => session.commitOrders() && play("stamp")}
              startIcon={<GameIcon name="confirm" />}
            >
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
              <Typography variant="body1">
                {t.howToOrderText}
              </Typography>
              {!game.extraTurn && (
                <Typography variant="body1">
                  {t.extraOrderRule(labels.coins(EXTRA_ORDER_COST))}
                </Typography>
              )}
            </Stack>
          </InfoButton>
          {/* Out of the way, and asked first: only when the map doesn't match the table */}
          {game.canEditMap && !unitHexPosition && !marking && !extraMode && (
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
          {t.leftSandbags}
        </Alert>
      </Snackbar>

      <Dialog open={confirmMapFix} onClose={() => setConfirmMapFix(false)}>
        <DialogTitle>{t.confirmFixTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {t.confirmFixText}
          </Typography>
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
    </div>
  );
}

export default OrdersView;
