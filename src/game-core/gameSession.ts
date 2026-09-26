// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import CommandCard from "./commandCard";
import Deck from "./deck";
import Hand from "./hand";
import Order from "./order";
import Unit from "./unit";
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
