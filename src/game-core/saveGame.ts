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

/** Bump when SavedGame changes shape; older saves are dropped instead of misread */
export const SAVE_VERSION = 7;

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
  choiceCards: string[];
  chosenCard: string | null;
  chosenSection: Section | null;
  drawnCard: string | null;
  units: SavedUnit[];
  orders: {
    unit: number;
    start: Position;
    end: Position;
    path: Position[] | null;
    shots: number;
    section: Section | null;
    onTheMove: boolean;
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
}

/** Everything a GameSession keeps between actions, apart from the board's units */
export interface SessionState {
  turn: number;
  phase: TurnPhase;
  drawPile: readonly CommandCard[];
  discardPile: readonly CommandCard[];
  hand: CommandCard[];
  choiceCards: CommandCard[];
  chosenCard: CommandCard | null;
  chosenSection: Section | null;
  drawnCard: CommandCard | null;
  orders: Order[];
  ordersCommitted: boolean;
  unmovedFireSkipped: boolean;
  battleEdits: BattleEdit[];
  shots: Shot[];
  log: TurnRecord[];
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

  const ids = (cards: readonly CommandCard[]) => cards.map((card) => card.id);
  return {
    version: SAVE_VERSION,
    scenarioId,
    faction,
    turn: state.turn,
    phase: state.phase,
    drawPile: ids(state.drawPile),
    discardPile: ids(state.discardPile),
    hand: ids(state.hand),
    choiceCards: ids(state.choiceCards),
    chosenCard: state.chosenCard?.id ?? null,
    chosenSection: state.chosenSection,
    drawnCard: state.drawnCard?.id ?? null,
    // Orders and edits first, so units they reference get indexes; the list is read after
    orders: state.orders.map((order) => ({
      unit: unitIndex(order.unit),
      start: order.start,
      end: order.end,
      path: order.path ?? null,
      shots: order.shots,
      section: order.section,
      onTheMove: order.onTheMove,
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
    units: savedUnits,
  };
}

/**
 * Read a save back, putting its units on `board` in place of the scenario's.
 * Throws on anything that doesn't fit these cards or this version.
 */
export function readSave(saved: SavedGame, board: BoardManager, commandCards: readonly CommandCard[]): SessionState {
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

  return {
    turn: saved.turn,
    phase: saved.phase,
    drawPile: cards(saved.drawPile),
    discardPile: cards(saved.discardPile),
    hand,
    choiceCards: cards(saved.choiceCards),
    chosenCard: saved.chosenCard === null ? null : card(saved.chosenCard),
    chosenSection: section(saved.chosenSection),
    drawnCard,
    orders,
    ordersCommitted: saved.ordersCommitted,
    unmovedFireSkipped: saved.unmovedFireSkipped,
    battleEdits: saved.battleEdits.map((edit) =>
      edit.kind === "remove" ? { kind: "remove", position: edit.position, unit: unit(edit.unit) } : edit
    ),
    shots,
    log: saved.log,
  };
}
