// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import CommandCard from "./commandCard";
import Deck from "./deck";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { DieFace, rollDice } from "./dice";
import { DiceStep, FireAnswers, calculateFireDice, nextFireQuestion } from "./fireRules";
import { COLLISION_NOTES, FIRE_QUESTIONS, collisionSteps, fireBonusSteps } from "../data/fireQuestions";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { Faction } from "../types/faction";
import { positionKey, samePosition } from "./position";
import { TurnRecord, recordTurn } from "./turnLog";

export interface GameSnapshot {
  turn: number;
  phase: TurnPhase;
  hand: readonly CommandCard[];
  /** The command card drawn in the final phase, once drawn (it is already in the hand) */
  drawnCard: CommandCard | null;
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
  /** Shots fired this turn, in the order they were rolled */
  shots: readonly Shot[];
  /** How many times each unit that can fire may fire this turn (from the card) */
  firesPerUnit: number;
  /** Finished turns, oldest first */
  log: readonly TurnRecord[];
  /** The attacker's extra first turn, before the defender plays (no combat cards or coins) */
  extraTurn: boolean;
}

/** A unit's shot this turn. Once rolled it stands; only a deliberate undo removes it. */
export interface Shot {
  /** Index of the firing unit's order in this turn's orders */
  orderIndex: number;
  /** How the dice were worked out; empty for a quick roll where the player chose the dice */
  steps: readonly DiceStep[];
  dice: number;
  faces: readonly DieFace[];
  /** Reminders for resolving the hits (e.g. sandbags ignore 1 flag) */
  notes: readonly string[];
  /** Rolled for a collision in the movement phase, before the normal battle */
  collision: boolean;
}

/** Saves from before notes or collisions existed have neither */
type SavedShot = Omit<Shot, "notes" | "collision"> & { notes?: string[]; collision?: boolean };

export interface MoveOptions {
  moves: Position[];
  moveAndFire: Position[];
}

/** Bump when SavedGame changes shape; older saves are then migrated or dropped instead of misread */
export const SAVE_VERSION = 4;

interface SavedUnit {
  type: UnitType;
  /** null for a unit removed in this turn's battle (an undo can bring it back) */
  position: Position | null;
  orderable: boolean;
  ordered: boolean;
}

/**
 * The whole game as plain JSON, so it survives a page reload or the tablet
 * dropping the tab. Cards are saved by id, units by their index in `units`.
 */
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
  drawnCard: string | null;
  units: SavedUnit[];
  orders: { unit: number; start: Position; end: Position; canFire: boolean; path: Position[] | null }[];
  ordersLeft: number;
  ordersCommitted: boolean;
  battleEdits: (
    | { kind: "remove"; position: Position; unit: number }
    | { kind: "move"; from: Position; to: Position }
  )[];
  shots: SavedShot[];
  log: TurnRecord[];
}

/** Version 3 saves drew the new card as the turn ended, so none is ever pending */
type SavedGameV3 = Omit<SavedGame, "version" | "drawnCard"> & { version: 3 };
/** Version 2 saves had no turn log either; they are read as a game with no history */
type SavedGameV2 = Omit<SavedGameV3, "version" | "log"> & { version: 2 };
/** Version 1 saves had no shots either; they are read as a turn where nobody has fired yet */
type SavedGameV1 = Omit<SavedGameV2, "version" | "shots"> & { version: 1 };

interface GameSessionOptions {
  scenario: Scenario;
  faction: Faction;
  initialHandSize: number;
  commandCards: CommandCard[];
  /** Random source for the dice, [0, 1) like Math.random; tests pass a fixed one */
  random?: () => number;
}

/** A change made during BATTLE to match what happened on the physical table */
export type BattleEdit =
  | { kind: "remove"; position: Position; unit: Unit }
  | { kind: "move"; from: Position; to: Position };

/**
 * Owns one player's game: board, command cards and the turn flow
 * PICK_CARDS -> ORDER_UNITS -> MOVEMENT -> BATTLE -> END_OF_TURN -> (next turn). The attacking side
 * plays turn 1 alone; the defender waits in AWAIT_ATTACKER and starts at turn 2.
 *
 * Game objects are mutable, so instead of a React reducer (which React may run
 * twice) every action mutates them here and publishes a new immutable snapshot.
 * React reads it with useSyncExternalStore. Actions return false and change
 * nothing when they aren't allowed.
 */
class GameSession {
  readonly scenario: Scenario;
  readonly faction: Faction;
  /** This device's side attacks: it plays the extra first turn */
  readonly attacking: boolean;
  readonly board: BoardManager;
  private readonly deck: Deck;
  private hand: CommandCard[];

  private turn = 1;
  private phase: TurnPhase;
  private choiceCards: CommandCard[] = [];
  private chosenCard: CommandCard | null = null;
  private drawnCard: CommandCard | null = null;
  private orders: Order[] = [];
  private ordersLeft = 0;
  private ordersCommitted = false;
  private battleEdits: BattleEdit[] = [];
  private shots: Shot[] = [];
  private log: TurnRecord[] = [];
  private readonly random: () => number;

  private readonly listeners = new Set<() => void>();
  private snapshot: GameSnapshot;

  constructor({
    scenario,
    faction,
    initialHandSize,
    commandCards,
    random = () => Math.random(),
  }: GameSessionOptions) {
    this.scenario = scenario;
    this.random = random;
    this.faction = faction;
    this.attacking = scenario.attacker === faction;
    this.phase = this.attacking ? TurnPhase.PICK_CARDS : TurnPhase.AWAIT_ATTACKER;
    this.board = new BoardManager(scenario, faction);
    this.deck = new Deck(commandCards);
    this.hand = this.deck.draw(initialHandSize);
    this.snapshot = this.createSnapshot();
  }

  // --- subscription (arrow functions so they can be passed around unbound)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameSnapshot => this.snapshot;

  // --- AWAIT_ATTACKER

  /** The attacker has finished the extra turn at the table: the defender joins in at turn 2 */
  startFirstTurn(): boolean {
    if (this.phase !== TurnPhase.AWAIT_ATTACKER) return false;

    this.turn = 2;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  // --- PICK_CARDS

  pickCard(card: CommandCard): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (this.choiceCards.length > 0) return false;
    if (!this.hand.includes(card)) return false;

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
    this.hand = [...this.hand, card];
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

    const destinations = (range: number, forFire = false) =>
      this.board.calculatePossibleMovesWithPaths(hex, range, forFire).map((result) => result.position);
    return {
      moves: destinations(unit.getMaxMove()),
      moveAndFire: destinations(unit.getMoveAndFire(), true),
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

    unit.giveOrder();
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
    this.board.setUnitsNotOrderable();
    return this.publish();
  }

  // --- MOVEMENT: the orders are shown to the opponent and carried out on the table

  startMovement(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || !this.ordersCommitted) return false;

    this.phase = TurnPhase.MOVEMENT;
    return this.publish();
  }

  // --- BATTLE

  startBattle(): boolean {
    if (this.phase !== TurnPhase.MOVEMENT) return false;

    this.phase = TurnPhase.BATTLE;
    return this.publish();
  }

  /** Move on to the final phase; units that haven't fired lose their shot */
  endBattle(): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;

    this.phase = TurnPhase.END_OF_TURN;
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

  // Firing: the dice are rolled here, once, and the result is kept

  private get firesPerUnit(): number {
    return Math.max(1, this.chosenCard?.numFireTimes ?? 1);
  }

  /** Shots the unit of this order may still fire this turn (0 if it can't fire at all) */
  shotsLeft(orderIndex: number): number {
    if (this.phase !== TurnPhase.BATTLE) return 0;
    const order = this.orders[orderIndex];
    if (!order?.canFire || !this.isOnBoard(order.unit)) return 0;
    const fired = this.shots.filter((shot) => shot.orderIndex === orderIndex).length;
    return Math.max(0, this.firesPerUnit - fired);
  }

  /**
   * Fire with the unit of this order, using the answers to the fire questions
   * to work out the dice. The questionnaire must be complete. A shot worth 0
   * dice is still recorded: the unit has used its fire.
   */
  fire(orderIndex: number, answers: FireAnswers): boolean {
    if (this.shotsLeft(orderIndex) <= 0) return false;
    const context = { unitType: this.orders[orderIndex]!.unit.getUnitType(), card: this.chosenCard };
    if (nextFireQuestion(FIRE_QUESTIONS, context, answers)) return false;

    const { dice, steps, notes, blocked } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
    if (blocked) return false;
    return this.recordShot(orderIndex, dice, steps, notes);
  }

  /** Fire with a number of dice the player worked out themselves */
  fireQuick(orderIndex: number, dice: number): boolean {
    if (!Number.isInteger(dice) || dice < 1) return false;
    if (this.shotsLeft(orderIndex) <= 0) return false;
    return this.recordShot(orderIndex, dice, [], []);
  }

  /**
   * Roll for a collision: the unit crossed or landed on a hex with an enemy
   * unit during the movement phase. Only a unit that moved, may fire and
   * hasn't fired yet; the roll uses up its shot.
   */
  fireCollision(orderIndex: number): boolean {
    if (this.shotsLeft(orderIndex) <= 0) return false;
    const order = this.orders[orderIndex]!;
    if (samePosition(order.start, order.end)) return false;
    if (this.shots.some((shot) => shot.orderIndex === orderIndex)) return false;

    const steps = collisionSteps({ unitType: order.unit.getUnitType(), card: this.chosenCard });
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    return this.recordShot(orderIndex, dice, steps, [...COLLISION_NOTES], true);
  }

  /** Take back this unit's last shot, for a shot recorded by mistake */
  undoShot(orderIndex: number): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const index = this.shots.findLastIndex((shot) => shot.orderIndex === orderIndex);
    if (index === -1) return false;

    this.shots = this.shots.filter((_, i) => i !== index);
    return this.publish();
  }

  private recordShot(orderIndex: number, dice: number, steps: DiceStep[], notes: string[], collision = false): true {
    const shot: Shot = { orderIndex, steps, dice, faces: rollDice(dice, this.random), notes, collision };
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  private isOnBoard(unit: Unit): boolean {
    return this.board.getAllHexes().some((hex) => hex.unit === unit);
  }

  // --- END_OF_TURN

  /** Discard the played card and draw a new command card (once per turn) */
  drawCard(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.chosenCard || this.drawnCard) return false;

    // Discard first so a reshuffle on an empty deck can bring the card back,
    // so there is always a card to draw
    const playedCard = this.chosenCard;
    this.deck.discard(playedCard);
    const [drawn] = this.deck.draw(1);
    if (!drawn) throw new Error("No command card to draw");
    this.hand = [...this.hand.filter((c) => c !== playedCard), drawn];
    this.drawnCard = drawn;
    return this.publish();
  }

  endTurn(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.chosenCard || !this.drawnCard) return false;

    const playedCard = this.chosenCard;
    const record = recordTurn({
      turn: this.turn,
      card: playedCard,
      orders: this.orders,
      shots: this.shots,
      battleEdits: this.battleEdits,
      board: this.board,
    });
    this.log = [...this.log, record];

    this.board.removeOrders();
    this.chosenCard = null;
    this.drawnCard = null;
    this.orders = [];
    this.ordersLeft = 0;
    this.ordersCommitted = false;
    this.battleEdits = [];
    this.shots = [];
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
      });
    };
    const unitIndex = (unit: Unit) => {
      if (!units.includes(unit)) addUnit(unit, null);
      return units.indexOf(unit);
    };
    this.board.getAllHexes().forEach((hex) => {
      if (hex.unit) addUnit(hex.unit, hex.getPosition());
    });

    const ids = (cards: readonly CommandCard[]) => cards.map((card) => card.id);
    return {
      version: SAVE_VERSION,
      scenarioId: this.scenario.id,
      faction: this.faction,
      turn: this.turn,
      phase: this.phase,
      drawPile: ids(this.deck.drawPile),
      discardPile: ids(this.deck.discardPile),
      hand: ids(this.hand),
      choiceCards: ids(this.choiceCards),
      chosenCard: this.chosenCard?.id ?? null,
      drawnCard: this.drawnCard?.id ?? null,
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
      shots: this.shots.map((shot) => ({
        ...shot,
        steps: [...shot.steps],
        faces: [...shot.faces],
        notes: [...shot.notes],
      })),
      // Records are plain data that is never mutated, so they can be shared
      log: [...this.log],
      units: savedUnits,
    };
  }

  /** Rebuild a saved game. Throws if the save doesn't fit this scenario or these cards. */
  static restore(
    saved: SavedGame | SavedGameV3 | SavedGameV2 | SavedGameV1,
    scenario: Scenario,
    commandCards: CommandCard[],
    random?: () => number
  ): GameSession {
    if (![1, 2, 3, SAVE_VERSION].includes(saved.version)) {
      throw new Error(`Unsupported save version ${(saved as { version: unknown }).version}`);
    }
    if (saved.scenarioId !== scenario.id) throw new Error(`Save is for scenario ${saved.scenarioId}`);
    if (!Object.values(TurnPhase).some((phase) => typeof phase === "number" && phase === saved.phase)) {
      throw new Error(`Unknown phase ${saved.phase}`);
    }

    const session = new GameSession({
      scenario,
      faction: saved.faction,
      initialHandSize: 0,
      commandCards,
      random,
    });

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
      if (savedUnit.ordered) unit.giveOrder();
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
    session.hand = cards(saved.hand);
    session.choiceCards = cards(saved.choiceCards);
    session.chosenCard = saved.chosenCard === null ? null : card(saved.chosenCard);
    const drawnCard = saved.version === SAVE_VERSION ? saved.drawnCard : null;
    session.drawnCard = drawnCard === null ? null : card(drawnCard);
    if (session.drawnCard && !session.hand.includes(session.drawnCard)) throw new Error("Drawn card not in hand");
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
    const faces = new Set<string>(Object.values(DieFace));
    session.shots = (saved.version === 1 ? [] : saved.shots).map((shot) => {
      if (!session.orders[shot.orderIndex]) throw new Error(`Shot for unknown order ${shot.orderIndex}`);
      if (!shot.faces.every((face) => faces.has(face))) throw new Error("Unknown die face");
      return { ...shot, notes: shot.notes ?? [], collision: shot.collision ?? false };
    });
    const log = saved.version === 1 || saved.version === 2 ? [] : saved.log;
    if (!Array.isArray(log)) throw new Error("Turn log is not a list");
    log.forEach((record) => {
      if (!record.shots.every((shot) => shot.faces.every((face) => faces.has(face)))) {
        throw new Error(`Unknown die face in turn ${record.turn}`);
      }
    });
    session.log = log;
    session.snapshot = session.createSnapshot();
    return session;
  }

  // --- internals

  private createSnapshot(): GameSnapshot {
    return {
      turn: this.turn,
      phase: this.phase,
      hand: [...this.hand],
      choiceCards: [...this.choiceCards],
      chosenCard: this.chosenCard,
      drawnCard: this.drawnCard,
      orders: this.orders,
      ordersLeft: this.ordersLeft,
      ordersCommitted: this.ordersCommitted,
      battleEdits: this.battleEdits.length,
      drawPileCount: this.deck.getDrawPileCount(),
      discardPileCount: this.deck.getDiscardPileCount(),
      shots: this.shots,
      firesPerUnit: this.firesPerUnit,
      log: this.log,
      extraTurn: this.attacking && this.turn === 1,
    };
  }

  private publish(): true {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default GameSession;
