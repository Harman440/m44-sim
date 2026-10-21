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
import { CombatCard } from "../../../game-core/combatCard";
import InfoButton from "../../InfoButton";
import EndOfTurnMap from "./EndOfTurnMap";
import SandbagsIcon from "../../SandbagsIcon";
import PlayedCards, { PLAY_LAYOUT_PREFIX } from "../../PlayedCards";
import LeavingHand from "./LeavingHand";
import "./PhaseLayout.css";

const TEXT = defineMessages({
  es: {
    extraOrderCoins: (coins: string) => `Orden extra (${coins})`,
    coinRange: (min: number, max: number) => `${min}–${max} suministros`,
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
    helpExtra: (costs: string) =>
      `Orden extra (suministros: ${costs}): toca cualquier unidad sin orden. No tiene las ventajas de la carta.`,
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
    promptGive: (card: string) => `Toca la unidad que recibe ${card}`,
    promptGiveCard: (card: string) => `Da ${card} a una unidad`,
    helpGive: (card: string, units: string) => `${card}: toca en el mapa la unidad que la recibe (${units}).`,
    helpGiveCard: (card: string) => `Da ${card} a una unidad para poder confirmar.`,
    giveTo: (units: string) => `Se da a: ${units}`,
    givenTo: (unit: string) => `Para: ${unit}`,
    giveToUnit: "Dar a una unidad",
    stopGiving: "Dejar de elegir",
    changeUnit: "Cambiar unidad",
    orderUnitFirst: (units: string) => `Primero da una orden a ${units}.`,
    noUnitFor: (units: string) => `No tienes ${units} para ella.`,
    needsOrderedWarning: (units: string) => `No hace nada si no das una orden a ${units}.`,
    withOrder: (units: string) => `${units} con orden`,
    or: " o ",
    stopMarking: "Dejar de marcar",
    markOnMap: "Marcar en el mapa",
    eraseLastMark: "Borrar última marca",
    remove: "Quitar",
    cardOrdersLeft: (n: number) => `Órdenes de la carta: ${n}`,
    ordersLeft: (n: number) => `Órdenes restantes: ${n}`,
    selectedUnit: "Unidad seleccionada",
    hedgerowExit: ". Al salir de un seto solo avanza 1 casilla",
    extraOrderHelp: (coins: string) => `Orden extra: cuesta ${coins} y no tiene las ventajas de la carta.`,
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
    nextSection: (section: string) => `Siguiente: ${section}`,
    nextSectionHelp: (section: string) => `Con estas órdenes confirmadas, eliges la carta del ${section}.`,
    howToOrder: "Cómo dar órdenes",
    instructions: "Instrucciones",
    howToOrderText:
      "Las casillas resaltadas son adonde puede ir la unidad; la leyenda dice en cuáles aún podrá disparar. Tocar otra vez la unidad la deselecciona. «Volver» deshace la última orden.",
    extraOrderRule: (costs: string) =>
      `Una orden extra cuesta suministros según la unidad (${costs}) y no tiene las ventajas de la carta.`,
    updateMap: "Actualizar mapa",
    leftSandbags: "La unidad deja sus sacos terreros: quítalos de la mesa al moverla.",
    leftSandbagsShared: "La unidad deja sus sacos terreros al moverse.",
    confirmFixTitle: "¿Actualizar el mapa?",
    confirmFixText:
      "Solo si el mapa no coincide con la mesa: por ejemplo, si se cambió una tirada o falta una retirada del turno anterior. Se puede hacer mientras no hayas dado ninguna orden.",
  },
  en: {
    extraOrderCoins: (coins: string) => `Extra order (${coins})`,
    coinRange: (min: number, max: number) => `${min}–${max} supplies`,
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
    helpExtra: (costs: string) =>
      `Extra order (supplies: ${costs}): tap any unit without an order. It doesn't get the card's advantages.`,
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
    promptGive: (card: string) => `Tap the unit that gets ${card}`,
    promptGiveCard: (card: string) => `Give ${card} to a unit`,
    helpGive: (card: string, units: string) => `${card}: tap the unit that gets it on the map (${units}).`,
    helpGiveCard: (card: string) => `Give ${card} to a unit to be able to confirm.`,
    giveTo: (units: string) => `Given to: ${units}`,
    givenTo: (unit: string) => `To: ${unit}`,
    giveToUnit: "Give to a unit",
    stopGiving: "Stop choosing",
    changeUnit: "Change unit",
    orderUnitFirst: (units: string) => `First give an order to ${units}.`,
    noUnitFor: (units: string) => `You have no ${units} for it.`,
    needsOrderedWarning: (units: string) => `It does nothing unless you give an order to ${units}.`,
    withOrder: (units: string) => `${units} with an order`,
    or: " or ",
    stopMarking: "Stop marking",
    markOnMap: "Mark on the map",
    eraseLastMark: "Erase last mark",
    remove: "Remove",
    cardOrdersLeft: (n: number) => `Card orders: ${n}`,
    ordersLeft: (n: number) => `Orders left: ${n}`,
    selectedUnit: "Selected unit",
    hedgerowExit: ". Leaving a hedgerow it only moves 1 hex",
    extraOrderHelp: (coins: string) => `Extra order: costs ${coins} and doesn't get the card's advantages.`,
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
    nextSection: (section: string) => `Next: ${section}`,
    nextSectionHelp: (section: string) => `Once these orders are confirmed, you pick the card for the ${section}.`,
    howToOrder: "How to give orders",
    instructions: "Instructions",
    howToOrderText:
      "The highlighted hexes are where the unit can go; the legend says from which ones it can still fire. Tapping the unit again deselects it. “Back” undoes the last order.",
    extraOrderRule: (costs: string) =>
      `An extra order costs supplies by the unit (${costs}) and doesn't get the card's advantages.`,
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
  /** The cards were just played: the rest of the hand slides off the screen */
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

/** What an order slot means, for picking one; `unitType`: the unit taking it */
const slotLabel = (slot: OrderSlot, unitType: UnitType, t: Text, labels: Labels) => {
  if (slot.extra) return t.extraOrderCoins(labels.coins(EXTRA_ORDER_COST[unitType]));
  if (slot.onTheMove) return t.onTheMove;
  return slot.section ? t.sectionOrder(labels.sections[slot.section]) : t.cardOrder;
};

const slotKey = (slot: OrderSlot) => `${slot.section ?? "card"}-${slot.onTheMove}-${!!slot.extra}`;

/** "infantería 1, tanque 2, artillería 2": what each order costs, by unit type */
const describeCosts = (costOf: (type: UnitType) => number, labels: Labels) =>
  Object.values(UnitType)
    .filter((type) => costOf(type) > 0)
    .map((type) => `${labels.units[type].toLowerCase()} ${costOf(type)}`)
    .join(", ");

const describeCoinCost = (card: CommandCard, labels: Labels) => describeCosts((type) => card.coinCostOf(type), labels);

const describeExtraCosts = (labels: Labels) => describeCosts((type) => EXTRA_ORDER_COST[type], labels);

const EXTRA_COSTS = Object.values(EXTRA_ORDER_COST);

/** The extra order's button: its cost, or the range of costs */
const extraOrderButton = (t: Text, labels: Labels) => {
  const min = Math.min(...EXTRA_COSTS);
  const max = Math.max(...EXTRA_COSTS);
  return t.extraOrderCoins(min === max ? labels.coins(min) : t.coinRange(min, max));
};

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

function OrdersView({ faction, session, game, handLeaving = false, onHandGone = () => {} }: OrdersViewProps) {
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
  /** The selected unit uses a combat card's movement (Motorized…): the card's id */
  const [boost, setBoost] = useState<string | false>(false);
  const boostsLeft = (card: CombatCard) =>
    card.effect?.kind === "move" ? card.effect.units - orders.filter((o) => o.boostCard === card.id).length : 0;
  /** The next unit tapped takes an extra order bought with coins */
  const [extraMode, setExtraMode] = useState(false);
  const canBuyExtra = game.extraOrderable.length > 0;
  /** The card whose hexes are marked next, and how many of all the cards' marks are left */
  const markerRule = game.marking?.rule ?? null;
  const markingLeft = game.marking ? game.marking.rule.count - game.marking.marked : 0;
  const markersLeft = game.combatCardsPlayed.reduce((sum, card) => sum + (card.marker?.count ?? 0), 0) - game.markers.length;
  /** Taps mark hexes for the combat card instead of ordering units */
  const [markMode, setMarkMode] = useState(false);
  const marking = markMode && game.marking !== null;
  /** Taps give the next card to a unit instead of ordering units */
  const [giveMode, setGiveMode] = useState(false);
  const giving = giveMode && game.assigning !== null && game.assigning.positions.length > 0;
  /** A card still waits for a unit that can take it: the orders can't be confirmed yet */
  const assignDue = !!game.assigning && game.assigning.positions.length > 0;
  const unitList = (types: readonly UnitType[]) => types.map((type) => labels.units[type].toLowerCase()).join(t.or);

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
    setSlot(null);
    setSlotHint(false);
    setBoost(false);
  };

  const toggleBoost = (card: string) => {
    if (!unitHexPosition) return;
    const next = boost === card ? false : card;
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
    setGiveMode(false);
    setExtraMode((on) => !on);
  };

  const toggleMarkMode = () => {
    clearSelection();
    setExtraMode(false);
    setGiveMode(false);
    setMarkMode((on) => !on);
  };

  const toggleGiveMode = () => {
    clearSelection();
    setExtraMode(false);
    setMarkMode(false);
    setGiveMode((on) => !on);
  };

  const pickSlot = (key: string | null) => {
    const picked = moveOptions?.slots.find((s) => slotKey(s) === key);
    if (!picked || !unitHexPosition) return;
    setSlot(picked);
    setSlotHint(false);
    // The card's movement may not apply to this slot (Rattenkrieg on the move): drop it
    const boosted = boost ? session.getMoveOptions(unitHexPosition, picked, boost) : null;
    if (boost && !boosted) setBoost(false);
    setMoveOptions(boosted ?? session.getMoveOptions(unitHexPosition, picked, false));
  };

  // One tap per action so it works the same with a mouse or on a tablet
  const handleTileClick = (position: Position) => {
    if (marking) {
      const card = game.marking?.card;
      if (!session.markHex(position)) {
        flashInvalid(position);
        return;
      }
      // A card's hexes all marked: the next card's are marked from its own button
      const next = session.getSnapshot().marking?.card;
      if (next && next !== card) setMarkMode(false);
      return;
    }
    if (giving) {
      if (session.assignCard(position)) setGiveMode(false);
      else flashInvalid(position);
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
    if (marking && markerRule) return t.promptMark(markingLeft);
    if (giving) return t.promptGive(tr(game.assigning!.card.name));
    if (extraMode) return selectedHex ? t.tapHighlightedHex : t.promptExtra;
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0 ? t.promptPaid : t.promptCantAfford;
    }
    if (game.activeCard?.closeAssaultOnly) return t.promptNoOrders;
    if (ordersLeft <= 0 && markersLeft > 0 && game.marking) return t.promptMarkCard(tr(game.marking.card.name));
    if (ordersLeft <= 0 && assignDue) return t.promptGiveCard(tr(game.assigning!.card.name));
    if (ordersLeft <= 0) return t.promptConfirm;
    if (selectedHex) return t.tapHighlightedHex;
    return t.promptTapUnit;
  };

  /** The same, explained: behind "Instrucciones" */
  const instructions = () => {
    if (marking && markerRule) {
      return t.helpMark(labels.describeMarkerRule(markerRule), markingLeft);
    }
    if (giving) {
      const rule = game.assigning!.card.assign!;
      const units = unitList(rule.unitTypes);
      return t.helpGive(tr(game.assigning!.card.name), rule.ordered ? t.withOrder(units) : units);
    }
    if (extraMode) {
      return selectedHex ? t.helpExtraSelected : t.helpExtra(describeExtraCosts(labels));
    }
    if (paidCard && game.cardOrdersLeft > 0 && ordersLeft <= 0 && !selectedHex) {
      return game.orderable.length > 0 ? t.helpPaid(describeCoinCost(game.activeCard!, labels)) : t.helpCantAfford;
    }
    if (game.activeCard?.closeAssaultOnly) {
      return t.helpNoOrders;
    }
    if (ordersLeft <= 0 && markersLeft > 0 && game.marking) {
      return t.helpMarkCard(tr(game.marking.card.name));
    }
    if (ordersLeft <= 0 && assignDue) {
      return t.helpGiveCard(tr(game.assigning!.card.name));
    }
    if (ordersLeft <= 0) {
      return game.nextPlaySection ? t.nextSectionHelp(labels.sections[game.nextPlaySection]) : t.helpConfirm;
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
          zoomable
          onTileClick={handleTileClick}
          unitHexPosition={unitHexPosition}
          possibleMovePositions={moveOptions?.moves ?? []}
          possibleMoveAndFirePositions={moveOptions?.moveAndFire ?? []}
          boardManager={boardManager}
          orders={orders}
          backgroundImage={session.scenario.image}
          invalidFlash={invalidFlash}
          orderablePositions={marking || giving ? [] : extraMode ? game.extraOrderable : game.orderable}
          markers={game.markers}
          markerKind={game.markerKinds}
          markablePositions={marking ? game.markable : giving ? game.assigning!.positions : []}
          cardBadges={game.assignments}
          camouflaged={game.camouflaged}
          faction={faction}
        />
      </div>

      {/* While the cards fly in, the column doesn't clip them (it scrolls the rest of the time) */}
      <div className={`phase-layout__controls${handLeaving ? " phase-layout__controls--arriving" : ""}`}>
        {/* The cards played, flown here from the Command Zone's tray; tapping one shows its text */}
        {game.chosenCard && (
          <PlayedCards
            className="played-cards--orders"
            faction={faction}
            command={game.chosenCard}
            section={game.chosenSection}
            plays={game.plays}
            combat={game.combatCardsPlayed}
            layoutPrefix={PLAY_LAYOUT_PREFIX}
          />
        )}
        {/* A unit-type card with none of its units left gives 1 order of any unit instead: its rules by name */}
        {game.activeCard && game.activeCard !== game.chosenCard && (
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
        {game.combatCardsPlayed.map((card) => {
          // Each card's marks come after the marks of the cards before it
          const start = game.combatCardsPlayed
            .slice(0, game.combatCardsPlayed.indexOf(card))
            .reduce((sum, c) => sum + (c.marker?.count ?? 0), 0);
          const marked = card.marker ? Math.max(0, Math.min(card.marker.count, game.markers.length - start)) : 0;
          const ownsLastMark = !!card.marker && game.markers.length > start && game.markers.length <= start + card.marker.count;
          const isMarking = game.marking?.card === card;
          const given = game.assignments.find((a) => a.card === card);
          const isGiving = game.assigning?.card === card;
          const assignUnits = card.assign ? unitList(card.assign.unitTypes) : "";
          return (
            <Paper key={card.id} variant="outlined" sx={{ p: 1.5, width: "100%" }} data-testid="order-combat-card">
              <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                <GameIcon name="cards" />
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
                  {tr(card.name)}
                </Typography>
                <InfoButton title={t.combatCardTitle(tr(card.name))}>
                  <Typography variant="body1">{tr(card.description)}</Typography>
                  {!card.marker && !card.assign && !card.effect && (
                    <Typography variant="body1" sx={{ mt: 1 }}>
                      {t.notePaper}
                    </Typography>
                  )}
                </InfoButton>
              </Stack>
              {card.marker && (
                <Typography variant="body2" color="text.secondary">
                  {labels.describeMarkerRule(card.marker)} ({marked}/{card.marker.count})
                </Typography>
              )}
              {card.assign && (
                <Typography variant="body2" color={given ? "text.primary" : "text.secondary"} data-testid="card-assignment">
                  {given
                    ? t.givenTo(labels.units[given.unitType])
                    : isGiving && game.assigning!.positions.length === 0
                      ? card.assign.ordered
                        ? t.orderUnitFirst(assignUnits)
                        : t.noUnitFor(assignUnits)
                      : t.giveTo(card.assign.ordered ? t.withOrder(assignUnits) : assignUnits)}
                </Typography>
              )}
              {card.needsOrdered && !session.hasOrderedUnitFor(card) && (
                <Typography variant="body2" color="warning.main">
                  {t.needsOrderedWarning(unitList(card.needsOrdered))}
                </Typography>
              )}
              <Stack sx={{ gap: 1, mt: 1 }}>
                {isMarking && (
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
                {ownsLastMark && (
                  <Button variant="text" color="inherit" onClick={() => session.undoMarker()} startIcon={<GameIcon name="undo" />}>
                    {t.eraseLastMark}
                  </Button>
                )}
                {isGiving && game.assigning!.positions.length > 0 && (
                  <Button
                    variant={giving ? "contained" : "outlined"}
                    color="warning"
                    onClick={toggleGiveMode}
                    startIcon={<GameIcon name={giving ? "cancel" : "cards"} />}
                    aria-pressed={giving}
                  >
                    {giving ? t.stopGiving : t.giveToUnit}
                  </Button>
                )}
                {given && (
                  <Button variant="text" color="inherit" onClick={() => session.unassignCard(card)} startIcon={<GameIcon name="undo" />}>
                    {t.changeUnit}
                  </Button>
                )}
                <Button variant="text" color="inherit" onClick={() => session.cancelCombatCard(card)} startIcon={<GameIcon name="cancel" />}>
                  {t.remove}
                </Button>
              </Stack>
            </Paper>
          );
        })}
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
                      {selectedHex.getTerrain().leaveOneHex && moveOptions.limits.maxMove > 1 && t.hedgerowExit}
                      .
                    </Typography>
                  )}
                  {slot?.extra && (
                    <Typography variant="body1">
                      {t.extraOrderHelp(labels.coins(EXTRA_ORDER_COST[selectedHex.unit!.getUnitType()]))}
                    </Typography>
                  )}
                </Stack>
              </InfoButton>
            </Stack>
            {slot?.extra && (
              <Typography variant="body2" color="warning.main">
                {t.extraOrderCost(labels.coins(EXTRA_ORDER_COST[selectedHex.unit!.getUnitType()]))}
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
            {moveOptions?.boosts.map((card) => (
              <ToggleButton
                key={card.id}
                value={card.id}
                selected={boost === card.id}
                onChange={() => toggleBoost(card.id)}
                color="warning"
                fullWidth
                sx={{ minHeight: 48, gap: 1, mb: 1 }}
              >
                <GameIcon name="cards" /> {t.useCard(tr(card.name), boostsLeft(card))}
              </ToggleButton>
            ))}
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
                      {slotLabel(s, selectedHex.unit!.getUnitType(), t, labels)}
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
              {extraMode ? t.cancelExtra : extraOrderButton(t, labels)}
            </Button>
          )}
          {game.canUndoOrder && !unitHexPosition && (
            <Button variant="outlined" onClick={() => session.undoLastOrder()} startIcon={<GameIcon name="undo" />}>
              {t.back}
            </Button>
          )}
          {ordersLeft <= 0 && markersLeft <= 0 && !assignDue && (
            <Button
              onClick={() => session.commitOrders() && play("stamp")}
              startIcon={<GameIcon name="confirm" />}
            >
              {game.nextPlaySection ? t.nextSection(labels.sections[game.nextPlaySection]) : t.confirmOrders}
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
                  {t.extraOrderRule(describeExtraCosts(labels))}
                </Typography>
              )}
            </Stack>
          </InfoButton>
          {/* Out of the way, and asked first: only when the map doesn't match the table */}
          {game.canEditMap && !shared && !unitHexPosition && !marking && !extraMode && (
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

      {handLeaving && (
        <LeavingHand
          faction={faction}
          hand={game.hand.filter((card) => card !== game.chosenCard)}
          combatHand={game.combatHand}
          onGone={onHandGone}
        />
      )}
    </div>
  );
}

export default OrdersView;
