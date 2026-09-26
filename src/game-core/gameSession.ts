// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import CommandCard from "./commandCard";
import Deck from "./deck";
import Hand from "./hand";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";

export interface GameSnapshot {
  turn: number;
  phase: TurnPhase;
  hand: readonly CommandCard[];
  /** Debug placeholder for cards that let you keep 1 of 2 drawn cards */
  choiceCards: readonly CommandCard[];
  chosenCard: CommandCard | null;
  orders: readonly Order[];
  ordersLeft: number;
  ordersCommitted: boolean;
  /** Board changes made to mirror the physical battle this turn (undoable) */
  battleEdits: number;
  drawPileCount: number;
  discardPileCount: number;
}

export interface MoveOptions {
  moves: Position[];
  moveAndFire: Position[];
}

/** Bump when SavedGame changes shape; older saves are then dropped instead of misread */
export const SAVE_VERSION = 1;

interface SavedUnit {
  type: UnitType;
  /** null for a unit removed in this turn's battle (an undo can bring it back) */
  position: Position | null;
  orderable: boolean;
  ordered: boolean;
  readyToFire: boolean;
}

/**
 * The whole game as plain JSON, so it survives a page reload or the tablet
 * dropping the tab. Cards are saved by id, units by their index in `units`.
 */
export interface SavedGame {
  version: typeof SAVE_VERSION;
  scenarioId: string;
  faction: string;
  turn: number;
  phase: TurnPhase;
  drawPile: string[];
  discardPile: string[];
  hand: string[];
  choiceCards: string[];
  chosenCard: string | null;
  units: SavedUnit[];
  orders: { unit: number; start: Position; end: Position; canFire: boolean; path: Position[] | null }[];
  ordersLeft: number;
  ordersCommitted: boolean;
  battleEdits: (
    | { kind: "remove"; position: Position; unit: number }
    | { kind: "move"; from: Position; to: Position }
  )[];
}

interface GameSessionOptions {
  scenario: Scenario;
  faction: string;
  initialHandSize: number;
  commandCards: CommandCard[];
}

/** A change made during BATTLE to match what happened on the physical table */
type BattleEdit =
  | { kind: "remove"; position: Position; unit: Unit }
  | { kind: "move"; from: Position; to: Position };

const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col;
const positionKey = (p: Position) => `${p.row}-${p.col}`;

/**
 * Owns one player's game: board, command cards and the turn flow
 * PICK_CARDS -> ORDER_UNITS -> BATTLE -> (next turn).
 *
 * Game objects are mutable, so instead of a React reducer (which React may run
 * twice) every action mutates them here and publishes a new immutable snapshot.
 * React reads it with useSyncExternalStore. Actions return false and change
 * nothing when they aren't allowed.
 */
class GameSession {
  readonly scenario: Scenario;
  readonly faction: string;
  readonly board: BoardManager;
  private readonly deck: Deck;
  private hand: Hand;

  private turn = 1;
  private phase = TurnPhase.PICK_CARDS;
  private choiceCards: CommandCard[] = [];
  private chosenCard: CommandCard | null = null;
  private orders: Order[] = [];
  private ordersLeft = 0;
  private ordersCommitted = false;
  private battleEdits: BattleEdit[] = [];

  private readonly listeners = new Set<() => void>();
  private snapshot: GameSnapshot;

  constructor({ scenario, faction, initialHandSize, commandCards }: GameSessionOptions) {
    this.scenario = scenario;
    this.faction = faction;
    this.board = new BoardManager(scenario, faction);
    this.deck = new Deck(commandCards);
    this.hand = new Hand(this.deck.draw(initialHandSize));
    this.snapshot = this.createSnapshot();
  }

  // --- subscription (arrow functions so they can be passed around unbound)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameSnapshot => this.snapshot;

  // --- PICK_CARDS

  pickCard(card: CommandCard): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (this.choiceCards.length > 0) return false;
    if (!this.hand.cards.includes(card)) return false;

    this.chosenCard = card;
    this.ordersLeft = this.board.setOrderableUnits(card);
    this.phase = TurnPhase.ORDER_UNITS;
    return this.publish();
  }

  /** Debug placeholder: draw 2 cards to choose 1 from */
  drawChoice(): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (this.choiceCards.length > 0) return false;

    const drawn = this.deck.draw(2);
    if (drawn.length < 2) {
      drawn.forEach((card) => this.deck.discard(card));
      this.publish();
      return false;
    }
    this.choiceCards = drawn;
    return this.publish();
  }

  chooseCard(card: CommandCard): boolean {
    if (!this.choiceCards.includes(card)) return false;

    this.choiceCards.filter((c) => c !== card).forEach((c) => this.deck.discard(c));
    this.choiceCards = [];
    this.hand = new Hand([...this.hand.cards, card]);
    return this.publish();
  }

  // --- ORDER_UNITS

  private canGiveOrders(): boolean {
    return this.phase === TurnPhase.ORDER_UNITS && !this.ordersCommitted && this.ordersLeft > 0;
  }

  /** Where the orderable unit at `position` can move, or null if it can't be ordered */
  getMoveOptions(position: Position): MoveOptions | null {
    if (!this.canGiveOrders()) return null;
    const hex = this.board.getHex(position);
    const unit = hex?.unit;
    if (!hex || !unit?.isOrderable()) return null;

    return {
      moves: this.board.calculatePossibleMoves(hex, unit.getMaxMove()),
      moveAndFire: this.board.calculatePossibleMoves(hex, unit.getMoveAndFire(), true),
    };
  }

  /** Order the unit at `from` to move to `to`, or to hold and fire when `to` equals `from` */
  issueOrder(from: Position, to: Position): boolean {
    const options = this.getMoveOptions(from);
    if (!options) return false;
    const hex = this.board.getHex(from)!;
    const unit = hex.unit!;

    let order: Order;
    if (samePosition(from, to)) {
      order = new Order(unit, from, to, true, [from]);
    } else {
      // Path must be found before moving: the start hex is empty afterwards
      const path = this.board.getAllPaths(hex, unit.getMaxMove()).get(positionKey(to));
      if (!path || !this.board.moveUnit(from, to)) return false;
      const canFire = options.moveAndFire.some((p) => samePosition(p, to));
      order = new Order(unit, from, to, canFire, path);
    }

    unit.giveOrder(order.canFire);
    this.orders = [...this.orders, order];
    this.ordersLeft--;
    return this.publish();
  }

  undoLastOrder(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted) return false;
    const lastOrder = this.orders.at(-1);
    if (!lastOrder) return false;

    if (!samePosition(lastOrder.start, lastOrder.end)) {
      this.board.moveUnit(lastOrder.end, lastOrder.start);
    }
    lastOrder.unit.clearOrder();
    lastOrder.unit.setOrderable(true);
    this.orders = this.orders.slice(0, -1);
    this.ordersLeft++;
    return this.publish();
  }

  commitOrders(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted) return false;
    if (this.ordersLeft > 0) return false;

    this.ordersCommitted = true;
    this.board.setUnitsNotOrdable();
    return this.publish();
  }

  // --- BATTLE

  startBattle(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || !this.ordersCommitted) return false;

    this.phase = TurnPhase.BATTLE;
    return this.publish();
  }

  // The battle is fought on the physical table; these keep the app's board in sync

  /** Remove a unit destroyed on the table */
  removeUnit(position: Position): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const unit = this.board.removeUnitAt(position);
    if (!unit) return false;

    this.battleEdits = [...this.battleEdits, { kind: "remove", position, unit }];
    return this.publish();
  }

  /** Move a unit to any empty hex, to mirror a retreat or taking ground */
  relocateUnit(from: Position, to: Position): boolean {
    if (this.phase !== TurnPhase.BATTLE || samePosition(from, to)) return false;
    if (!this.board.getHex(to)?.isPassable()) return false;
    if (!this.board.moveUnit(from, to)) return false;

    this.battleEdits = [...this.battleEdits, { kind: "move", from, to }];
    return this.publish();
  }

  undoBattleEdit(): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const edit = this.battleEdits.at(-1);
    if (!edit) return false;

    if (edit.kind === "remove") {
      this.board.placeUnitAt(edit.position, edit.unit);
    } else {
      this.board.moveUnit(edit.to, edit.from);
    }
    this.battleEdits = this.battleEdits.slice(0, -1);
    return this.publish();
  }

  endTurn(): boolean {
    if (this.phase !== TurnPhase.BATTLE || !this.chosenCard) return false;

    // Discard first so a reshuffle on an empty deck can bring the card back
    const playedCard = this.chosenCard;
    this.deck.discard(playedCard);
    const drawn = this.deck.draw(1);
    this.hand = new Hand([...this.hand.cards.filter((c) => c !== playedCard), ...drawn]);

    this.board.removeOrders();
    this.chosenCard = null;
    this.orders = [];
    this.ordersLeft = 0;
    this.ordersCommitted = false;
    this.battleEdits = [];
    this.turn++;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  // --- saving

  save(): SavedGame {
    const units: Unit[] = [];
    const savedUnits: SavedUnit[] = [];
    const addUnit = (unit: Unit, position: Position | null) => {
      units.push(unit);
      savedUnits.push({
        type: unit.getUnitType(),
        position,
        orderable: unit.isOrderable(),
        ordered: unit.isOrdered(),
        readyToFire: unit.isReadyToFire(),
      });
    };
    const unitIndex = (unit: Unit) => {
      if (!units.includes(unit)) addUnit(unit, null);
      return units.indexOf(unit);
    };
    this.board.getAllHexes().forEach((hex) => {
      if (hex.unit) addUnit(hex.unit, hex.getPosition());
    });

    const ids = (cards: CommandCard[]) => cards.map((card) => card.id);
    return {
      version: SAVE_VERSION,
      scenarioId: this.scenario.id,
      faction: this.faction,
      turn: this.turn,
      phase: this.phase,
      drawPile: ids(this.deck.drawPile),
      discardPile: ids(this.deck.discardPile),
      hand: ids(this.hand.cards),
      choiceCards: ids(this.choiceCards),
      chosenCard: this.chosenCard?.id ?? null,
      // Orders and edits first, so units they reference get indexes; the list is read after
      orders: this.orders.map((order) => ({
        unit: unitIndex(order.unit),
        start: order.start,
        end: order.end,
        canFire: order.canFire,
        path: order.path ?? null,
      })),
      battleEdits: this.battleEdits.map((edit) =>
        edit.kind === "remove"
          ? { kind: "remove", position: edit.position, unit: unitIndex(edit.unit) }
          : edit
      ),
      ordersLeft: this.ordersLeft,
      ordersCommitted: this.ordersCommitted,
      units: savedUnits,
    };
  }

  /** Rebuild a saved game. Throws if the save doesn't fit this scenario or these cards. */
  static restore(saved: SavedGame, scenario: Scenario, commandCards: CommandCard[]): GameSession {
    if (saved.version !== SAVE_VERSION) throw new Error(`Unsupported save version ${saved.version}`);
    if (saved.scenarioId !== scenario.id) throw new Error(`Save is for scenario ${saved.scenarioId}`);
    if (![TurnPhase.PICK_CARDS, TurnPhase.ORDER_UNITS, TurnPhase.BATTLE].includes(saved.phase)) {
      throw new Error(`Unknown phase ${saved.phase}`);
    }

    const session = new GameSession({ scenario, faction: saved.faction, initialHandSize: 0, commandCards });

    const cardsById = new Map(commandCards.map((card) => [card.id, card]));
    const card = (id: string) => {
      const found = cardsById.get(id);
      if (!found) throw new Error(`Unknown card ${id}`);
      return found;
    };
    const cards = (ids: string[]) => ids.map(card);

    // Replace the scenario's starting units with the saved ones
    session.board.getAllHexes().forEach((hex) => hex.removeUnit());
    const units = saved.units.map((savedUnit) => {
      const unit = new Unit(savedUnit.type);
      if (savedUnit.ordered) unit.giveOrder(savedUnit.readyToFire);
      unit.setOrderable(savedUnit.orderable);
      if (savedUnit.position && !session.board.placeUnitAt(savedUnit.position, unit)) {
        throw new Error(`Can't place unit at ${positionKey(savedUnit.position)}`);
      }
      return unit;
    });
    const unit = (index: number) => {
      if (!units[index]) throw new Error(`Unknown unit ${index}`);
      return units[index];
    };

    session.deck.restorePiles(cards(saved.drawPile), cards(saved.discardPile));
    session.hand = new Hand(cards(saved.hand));
    session.choiceCards = cards(saved.choiceCards);
    session.chosenCard = saved.chosenCard === null ? null : card(saved.chosenCard);
    session.turn = saved.turn;
    session.phase = saved.phase;
    session.orders = saved.orders.map(
      (order) => new Order(unit(order.unit), order.start, order.end, order.canFire, order.path)
    );
    session.ordersLeft = saved.ordersLeft;
    session.ordersCommitted = saved.ordersCommitted;
    session.battleEdits = saved.battleEdits.map((edit) =>
      edit.kind === "remove" ? { kind: "remove", position: edit.position, unit: unit(edit.unit) } : edit
    );
    session.snapshot = session.createSnapshot();
    return session;
  }

  // --- internals

  private createSnapshot(): GameSnapshot {
    return {
      turn: this.turn,
      phase: this.phase,
      hand: [...this.hand.cards],
      choiceCards: [...this.choiceCards],
      chosenCard: this.chosenCard,
      orders: this.orders,
      ordersLeft: this.ordersLeft,
      ordersCommitted: this.ordersCommitted,
      battleEdits: this.battleEdits.length,
      drawPileCount: this.deck.getDrawPileCount(),
      discardPileCount: this.deck.getDiscardPileCount(),
    };
  }

  private publish(): true {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default GameSession;
