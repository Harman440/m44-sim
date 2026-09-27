// game-core/saveGame.ts
// A GameSession as plain JSON, so the game survives a page reload or the
// tablet dropping the tab. Cards are saved by id, units by their index in
// `units`, so orders and battle edits keep pointing at the same objects.
import BoardManager from "./BoardManager";
import CommandCard, { Section, isSection } from "./commandCard";
import Order from "./order";
import Unit, { UnitType, isUnitType } from "./unit";
import { DieFace } from "./dice";
import { positionKey } from "./position";
import { TurnPhase } from "../types/gameManager";
import { Faction } from "../types/faction";
import { Position } from "../types/scenario";
import type { BattleEdit, Shot } from "./gameSession";
import type { TurnRecord } from "./turnLog";
import { RewardChoice, isRewardChoice } from "./coins";
import type { CombatCard } from "./combatCard";

/** Bump when SavedGame changes shape; older saves are dropped instead of misread */
export const SAVE_VERSION = 11;

interface SavedUnit {
  type: UnitType;
  /** null for a unit removed in this turn's battle (an undo can bring it back) */
  position: Position | null;
}

export interface SavedGame {
  version: typeof SAVE_VERSION;
  scenarioId: string;
  faction: Faction;
  turn: number;
  phase: TurnPhase;
  drawPile: string[];
  discardPile: string[];
  hand: string[];
  chosenCard: string | null;
  chosenSection: Section | null;
  drawnCard: string | null;
  drawOptions: string[];
  drewAgain: boolean;
  units: SavedUnit[];
  orders: {
    unit: number;
    start: Position;
    end: Position;
    path: Position[] | null;
    shots: number;
    section: Section | null;
    onTheMove: boolean;
    extra: boolean;
    cost: number;
    closeAssaultOnly: boolean;
  }[];
  ordersCommitted: boolean;
  unmovedFireSkipped: boolean;
  battleEdits: (
    | { kind: "remove"; position: Position; unit: number }
    | { kind: "move"; from: Position; to: Position }
  )[];
  shots: Shot[];
  log: TurnRecord[];
  startCoins: number;
  coinAdjustments: number[];
  rewardChoice: RewardChoice | null;
  combatDrawPile: string[];
  combatDiscardPile: string[];
  combatHand: string[];
  orderCombatCard: string | null;
  markers: Position[];
  battleCombatCard: string | null;
  drawnCombatCard: string | null;
}

/** Everything a GameSession keeps between actions, apart from the board's units */
export interface SessionState {
  turn: number;
  phase: TurnPhase;
  drawPile: readonly CommandCard[];
  discardPile: readonly CommandCard[];
  hand: CommandCard[];
  chosenCard: CommandCard | null;
  chosenSection: Section | null;
  drawnCard: CommandCard | null;
  drawOptions: CommandCard[];
  drewAgain: boolean;
  orders: Order[];
  ordersCommitted: boolean;
  unmovedFireSkipped: boolean;
  battleEdits: BattleEdit[];
  shots: Shot[];
  log: TurnRecord[];
  /** Coins at the start of this turn */
  startCoins: number;
  coinAdjustments: number[];
  rewardChoice: RewardChoice | null;
  combatDrawPile: readonly CombatCard[];
  combatDiscardPile: readonly CombatCard[];
  combatHand: CombatCard[];
  orderCombatCard: CombatCard | null;
  /** Hexes marked for the order combat card */
  markers: Position[];
  battleCombatCard: CombatCard | null;
  /** Drawn in the final phase (it is already in the hand, unless discarded) */
  drawnCombatCard: CombatCard | null;
}

const isPosition = (value: unknown): value is Position =>
  typeof value === "object" &&
  value !== null &&
  Number.isInteger((value as Position).row) &&
  Number.isInteger((value as Position).col);

function readMarkers(markers: unknown): Position[] {
  if (!Array.isArray(markers) || !markers.every(isPosition)) throw new Error("Markers are not a list of hexes");
  return markers.map(({ row, col }) => ({ row, col }));
}

export function writeSave(scenarioId: string, faction: Faction, board: BoardManager, state: SessionState): SavedGame {
  const units: Unit[] = [];
  const savedUnits: SavedUnit[] = [];
  const addUnit = (unit: Unit, position: Position | null) => {
    units.push(unit);
    savedUnits.push({ type: unit.getUnitType(), position });
  };
  const unitIndex = (unit: Unit) => {
    if (!units.includes(unit)) addUnit(unit, null);
    return units.indexOf(unit);
  };
  board.getAllHexes().forEach((hex) => {
    if (hex.unit) addUnit(hex.unit, hex.getPosition());
  });

  const ids = (cards: readonly { id: string }[]) => cards.map((card) => card.id);
  return {
    version: SAVE_VERSION,
    scenarioId,
    faction,
    turn: state.turn,
    phase: state.phase,
    drawPile: ids(state.drawPile),
    discardPile: ids(state.discardPile),
    hand: ids(state.hand),
    chosenCard: state.chosenCard?.id ?? null,
    chosenSection: state.chosenSection,
    drawnCard: state.drawnCard?.id ?? null,
    drawOptions: ids(state.drawOptions),
    drewAgain: state.drewAgain,
    // Orders and edits first, so units they reference get indexes; the list is read after
    orders: state.orders.map((order) => ({
      unit: unitIndex(order.unit),
      start: order.start,
      end: order.end,
      path: order.path ?? null,
      shots: order.shots,
      section: order.section,
      onTheMove: order.onTheMove,
      extra: order.extra,
      cost: order.cost,
      closeAssaultOnly: order.closeAssaultOnly,
    })),
    battleEdits: state.battleEdits.map((edit) =>
      edit.kind === "remove" ? { kind: "remove", position: edit.position, unit: unitIndex(edit.unit) } : edit
    ),
    ordersCommitted: state.ordersCommitted,
    unmovedFireSkipped: state.unmovedFireSkipped,
    shots: state.shots.map((shot) => ({
      ...shot,
      steps: [...shot.steps],
      faces: [...shot.faces],
      notes: [...shot.notes],
      target: { ...shot.target },
    })),
    // Records are plain data that is never mutated, so they can be shared
    log: [...state.log],
    startCoins: state.startCoins,
    coinAdjustments: [...state.coinAdjustments],
    rewardChoice: state.rewardChoice,
    combatDrawPile: ids(state.combatDrawPile),
    combatDiscardPile: ids(state.combatDiscardPile),
    combatHand: ids(state.combatHand),
    orderCombatCard: state.orderCombatCard?.id ?? null,
    markers: state.markers.map((p) => ({ ...p })),
    battleCombatCard: state.battleCombatCard?.id ?? null,
    drawnCombatCard: state.drawnCombatCard?.id ?? null,
    units: savedUnits,
  };
}

/**
 * Read a save back, putting its units on `board` in place of the scenario's.
 * Throws on anything that doesn't fit these cards or this version.
 */
export function readSave(
  saved: SavedGame,
  board: BoardManager,
  commandCards: readonly CommandCard[],
  combatCards: readonly CombatCard[]
): SessionState {
  if (saved.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version ${(saved as { version: unknown }).version}`);
  }
  if (!Object.values(TurnPhase).some((phase) => typeof phase === "number" && phase === saved.phase)) {
    throw new Error(`Unknown phase ${saved.phase}`);
  }

  const cardsById = new Map(commandCards.map((card) => [card.id, card]));
  const card = (id: string) => {
    const found = cardsById.get(id);
    if (!found) throw new Error(`Unknown card ${id}`);
    return found;
  };
  const cards = (ids: string[]) => ids.map(card);
  const combatById = new Map(combatCards.map((card) => [card.id, card]));
  const combatCard = (id: string) => {
    const found = combatById.get(id);
    if (!found) throw new Error(`Unknown combat card ${id}`);
    return found;
  };
  const combatCardOrNull = (id: string | null) => (id === null ? null : combatCard(id));
  const section = (value: Section | null) => {
    if (value !== null && !isSection(value)) throw new Error(`Unknown section ${value}`);
    return value;
  };

  board.getAllHexes().forEach((hex) => hex.removeUnit());
  const units = saved.units.map((savedUnit) => {
    if (!isUnitType(savedUnit.type)) throw new Error(`Unknown unit type ${savedUnit.type}`);
    const unit = new Unit(savedUnit.type);
    if (savedUnit.position && !board.placeUnitAt(savedUnit.position, unit)) {
      throw new Error(`Can't place unit at ${positionKey(savedUnit.position)}`);
    }
    return unit;
  });
  const unit = (index: number) => {
    if (!units[index]) throw new Error(`Unknown unit ${index}`);
    return units[index];
  };

  const hand = cards(saved.hand);
  const drawnCard = saved.drawnCard === null ? null : card(saved.drawnCard);
  if (drawnCard && !hand.includes(drawnCard)) throw new Error("Drawn card not in hand");

  const orders = saved.orders.map(
    (order) =>
      new Order({
        unit: unit(order.unit),
        start: order.start,
        end: order.end,
        path: order.path,
        shots: order.shots,
        section: section(order.section),
        onTheMove: order.onTheMove,
        extra: order.extra,
        cost: order.cost,
        closeAssaultOnly: order.closeAssaultOnly,
      })
  );

  const faces = new Set<string>(Object.values(DieFace));
  const shots = saved.shots.map((shot) => {
    if (!orders[shot.orderIndex]) throw new Error(`Shot for unknown order ${shot.orderIndex}`);
    if (!shot.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
    if (!isUnitType(shot.target?.unitType)) throw new Error(`Unknown target ${shot.target?.unitType}`);
    return shot;
  });

  if (!Array.isArray(saved.log)) throw new Error("Turn log is not a list");
  saved.log.forEach((record) => {
    if (!record.shots.every((shot) => shot.faces.every((face) => faces.has(face)))) {
      throw new Error(`Unknown die face in turn ${record.turn}`);
    }
  });

  const isCount = (value: unknown) => Number.isInteger(value);
  if (!isCount(saved.startCoins)) throw new Error("Coins are not a number");
  if (!Array.isArray(saved.coinAdjustments) || !saved.coinAdjustments.every(isCount)) {
    throw new Error("Coin adjustments are not a list of numbers");
  }
  if (saved.rewardChoice !== null && !isRewardChoice(saved.rewardChoice)) {
    throw new Error(`Unknown reward ${saved.rewardChoice}`);
  }

  return {
    turn: saved.turn,
    phase: saved.phase,
    drawPile: cards(saved.drawPile),
    discardPile: cards(saved.discardPile),
    hand,
    chosenCard: saved.chosenCard === null ? null : card(saved.chosenCard),
    chosenSection: section(saved.chosenSection),
    drawnCard,
    drawOptions: cards(saved.drawOptions),
    drewAgain: saved.drewAgain === true,
    orders,
    ordersCommitted: saved.ordersCommitted,
    unmovedFireSkipped: saved.unmovedFireSkipped,
    battleEdits: saved.battleEdits.map((edit) =>
      edit.kind === "remove" ? { kind: "remove", position: edit.position, unit: unit(edit.unit) } : edit
    ),
    shots,
    log: saved.log,
    startCoins: saved.startCoins,
    coinAdjustments: [...saved.coinAdjustments],
    rewardChoice: saved.rewardChoice,
    combatDrawPile: saved.combatDrawPile.map(combatCard),
    combatDiscardPile: saved.combatDiscardPile.map(combatCard),
    combatHand: saved.combatHand.map(combatCard),
    orderCombatCard: combatCardOrNull(saved.orderCombatCard),
    markers: readMarkers(saved.markers),
    battleCombatCard: combatCardOrNull(saved.battleCombatCard),
    drawnCombatCard: combatCardOrNull(saved.drawnCombatCard),
  };
}
