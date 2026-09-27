// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import CommandCard, { Section, isSection } from "./commandCard";
import Deck from "./deck";
import Order from "./order";
import Unit, { UnitType, isUnitType } from "./unit";
import { ShotTarget } from "../data/hitRules";
import { DieFace, rollDice } from "./dice";
import { DiceStep, FireAnswers, calculateFireDice, nextFireQuestion } from "./fireRules";
import { COLLISION_NOTES, FIRE_QUESTIONS, collisionSteps, fireBonusSteps } from "../data/fireQuestions";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { Faction } from "../types/faction";
import { positionKey, samePosition } from "./position";
import {
  MoveLimits,
  OrderContext,
  OrderSlot,
  fallbackCard,
  moveLimits,
  orderSlots,
  orderablePositions,
  ordersLeft,
  sameSlot,
} from "./orderRules";
import { SavedGame, SessionState, readSave, writeSave } from "./saveGame";
import { TurnRecord, recordTurn } from "./turnLog";
import { summarizeOrders } from "./turnSummary";

export interface GameSnapshot {
  turn: number;
  phase: TurnPhase;
  hand: readonly CommandCard[];
  /** The command card drawn in the final phase, once drawn (it is already in the hand) */
  drawnCard: CommandCard | null;
  /** Debug placeholder for cards that let you keep 1 of 2 drawn cards */
  choiceCards: readonly CommandCard[];
  chosenCard: CommandCard | null;
  /**
   * The rules in force this turn: the chosen card, or "1 unit of your choice"
   * when it's a unit-type card and none of those units are left
   */
  activeCard: CommandCard | null;
  /** The section picked for a card that orders units in a section of the player's choice */
  chosenSection: Section | null;
  orders: readonly Order[];
  /** The most orders the player can still give with this card */
  ordersLeft: number;
  /** Units that can still be ordered (empty outside giving orders) */
  orderable: readonly Position[];
  /** With a Close Assault card, in the battle: units that can still be marked as in close assault */
  closeAssaultMarkable: readonly Position[];
  ordersCommitted: boolean;
  /** Board changes made in the final phase to mirror the table after the battle (undoable) */
  battleEdits: number;
  drawPileCount: number;
  discardPileCount: number;
  /** Shots fired this turn, in the order they were rolled */
  shots: readonly Shot[];
  /** The player gave up the unfired shots of the units that didn't move, so the moved units can fire */
  unmovedFireSkipped: boolean;
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
  /** What it was rolled against, to read the hits */
  target: ShotTarget;
}

export interface MoveOptions {
  moves: Position[];
  moveAndFire: Position[];
  /** How far it moves with this order, and its shots if it holds */
  limits: MoveLimits;
  /**
   * The ways the unit can be ordered. The moves are for the card's own orders
   * when it can take one; with more than one, the player picks the section.
   */
  slots: OrderSlot[];
}

interface GameSessionOptions {
  scenario: Scenario;
  faction: Faction;
  initialHandSize: number;
  commandCards: CommandCard[];
  /** Random source for the dice, [0, 1) like Math.random; tests pass a fixed one */
  random?: () => number;
}

/** A change made in END_OF_TURN to match the physical table after the battle */
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
  private chosenSection: Section | null = null;
  private drawnCard: CommandCard | null = null;
  private orders: Order[] = [];
  private ordersCommitted = false;
  private battleEdits: BattleEdit[] = [];
  private shots: Shot[] = [];
  private unmovedFireSkipped = false;
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

  /** The card orders units in a section the player picks when playing it (and doesn't fall back to 1 unit) */
  cardNeedsSection(card: CommandCard): boolean {
    return card.choosesSection && !fallbackCard(card, this.board);
  }

  /** Play a card from the hand; see `cardNeedsSection` for when it takes a section */
  pickCard(card: CommandCard, section?: Section): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (this.choiceCards.length > 0) return false;
    if (!this.hand.includes(card)) return false;
    if (this.cardNeedsSection(card) ? !isSection(section) : section !== undefined) return false;

    this.chosenCard = card;
    this.chosenSection = section ?? null;
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

  /** The chosen card's rules, or 1 unit of any type when it's a unit-type card with none of its units left */
  private activeCard(): CommandCard | null {
    if (!this.chosenCard) return null;
    return fallbackCard(this.chosenCard, this.board) ?? this.chosenCard;
  }

  private orderContext(): OrderContext | null {
    const card = this.activeCard();
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted || !card) return null;
    return { card, chosenSection: this.chosenSection, board: this.board, orders: this.orders };
  }

  private remainingOrders(): number {
    const context = this.orderContext();
    return context ? ordersLeft(context) : 0;
  }

  /** The order slot to use: the one asked for, else the card's own order, else on the move */
  private slotFor(slots: OrderSlot[], slot?: OrderSlot): OrderSlot | null {
    if (slot) return slots.find((s) => sameSlot(s, slot)) ?? null;
    const cardSlots = slots.filter((s) => !s.onTheMove);
    if (cardSlots.length > 1) return null; // a border unit: the player picks the section
    return cardSlots[0] ?? slots[0] ?? null;
  }

  /**
   * Where the unit at `position` can move, or null if it can't be ordered.
   * `slot` gets the moves for one way of ordering it (e.g. on the move).
   */
  getMoveOptions(position: Position, slot?: OrderSlot): MoveOptions | null {
    const context = this.orderContext();
    const hex = this.board.getHex(position);
    const unit = hex?.unit;
    if (!context || !hex || !unit) return null;
    const slots = orderSlots(context, unit, hex.getSide());
    const moveSlot = slot ? this.slotFor(slots, slot) : (slots.find((s) => !s.onTheMove) ?? slots[0]);
    if (!moveSlot) return null;

    const limits = moveLimits(context.card, unit, moveSlot);
    const destinations = (range: number, forFire = false) =>
      this.board.calculatePossibleMovesWithPaths(hex, range, forFire).map((result) => result.position);
    return {
      moves: destinations(limits.maxMove),
      moveAndFire: destinations(limits.moveAndFire, true),
      limits,
      slots,
    };
  }

  /**
   * Order the unit at `from` to move to `to`, or to hold when `to` equals `from`.
   * `slot` is needed when the unit can fill more than one section's orders.
   */
  issueOrder(from: Position, to: Position, slot?: OrderSlot): boolean {
    const context = this.orderContext();
    const hex = this.board.getHex(from);
    const unit = hex?.unit;
    if (!context || !hex || !unit) return false;
    const chosen = this.slotFor(orderSlots(context, unit, hex.getSide()), slot);
    if (!chosen) return false;
    const limits = moveLimits(context.card, unit, chosen);

    let order: Order;
    const props = { unit, start: from, end: to, section: chosen.section, onTheMove: chosen.onTheMove };
    if (samePosition(from, to)) {
      order = new Order({ ...props, path: [from], shots: limits.holdShots });
    } else {
      // Paths must be found before moving: afterwards the start hex is empty and the destination taken
      const path = this.board.getAllPaths(hex, limits.maxMove).get(positionKey(to));
      const canFire = this.board.getAllPaths(hex, limits.moveAndFire, true).has(positionKey(to));
      if (!path || !this.board.moveUnit(from, to)) return false;
      order = new Order({ ...props, path, shots: canFire ? 1 : 0 });
    }

    this.orders = [...this.orders, order];
    return this.publish();
  }

  undoLastOrder(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted) return false;
    const lastOrder = this.orders.at(-1);
    if (!lastOrder) return false;

    if (!samePosition(lastOrder.start, lastOrder.end)) {
      this.board.moveUnit(lastOrder.end, lastOrder.start);
    }
    this.orders = this.orders.slice(0, -1);
    return this.publish();
  }

  commitOrders(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted) return false;
    if (this.remainingOrders() > 0) return false;

    this.ordersCommitted = true;
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

  /**
   * The units that didn't move fire first, then the ones that moved. Give up
   * the unfired shots of the units that didn't move, so the moved ones can fire.
   */
  skipUnmovedFire(): boolean {
    if (this.phase !== TurnPhase.BATTLE || this.unmovedFireDone()) return false;

    this.unmovedFireSkipped = true;
    return this.publish();
  }

  // Firing: the dice are rolled here, once, and the result is kept

  private summaries() {
    return summarizeOrders(this.orders, this.board, this.shots, this.unmovedFireSkipped);
  }

  /** No unit that didn't move has a shot left (or the player skipped them) */
  private unmovedFireDone(): boolean {
    return this.summaries().every((summary) => !summary.hold || summary.shotsLeft === 0);
  }

  /** Shots the unit of this order may still fire this turn (0 if it can't fire at all) */
  shotsLeft(orderIndex: number): number {
    if (this.phase !== TurnPhase.BATTLE) return 0;
    return this.summaries()[orderIndex]?.shotsLeft ?? 0;
  }

  /** The unit may fire now: it has a shot left and, if it moved, the units that didn't move are done */
  private canFireNow(orderIndex: number): boolean {
    if (this.shotsLeft(orderIndex) <= 0) return false;
    return !this.summaries()[orderIndex]!.waiting;
  }

  /**
   * Fire with the unit of this order, using the answers to the fire questions
   * to work out the dice. The questionnaire must be complete. A shot worth 0
   * dice is still recorded: the unit has used its fire.
   */
  fire(orderIndex: number, answers: FireAnswers): boolean {
    if (!this.canFireNow(orderIndex)) return false;
    const order = this.orders[orderIndex]!;
    const context = {
      unitType: order.unit.getUnitType(),
      card: this.activeCard(),
      closeAssaultOnly: order.closeAssaultOnly,
    };
    if (nextFireQuestion(FIRE_QUESTIONS, context, answers)) return false;
    if (order.closeAssaultOnly && answers.distance !== "1") return false;

    const { dice, steps, notes, blocked } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
    if (blocked) return false;
    const unitType = answers.targetType as UnitType;
    if (!isUnitType(unitType)) return false;
    const target = { unitType, closeAssault: answers.distance === "1" };
    return this.recordShot(orderIndex, dice, steps, notes, target);
  }

  /** Fire with a number of dice the player worked out themselves */
  fireQuick(orderIndex: number, dice: number, target: ShotTarget): boolean {
    if (!Number.isInteger(dice) || dice < 1) return false;
    if (!isUnitType(target.unitType)) return false;
    if (!this.canFireNow(orderIndex)) return false;
    if (this.orders[orderIndex]!.closeAssaultOnly && !target.closeAssault) return false;
    return this.recordShot(orderIndex, dice, [], [], { ...target });
  }

  /**
   * Roll for a collision: the unit crossed or landed on a hex with an enemy
   * unit during the movement phase. Only a unit that moved, may fire and
   * hasn't fired yet; the roll uses up its shot. Collisions come before any
   * other shot, so they don't wait for the units that didn't move.
   */
  fireCollision(orderIndex: number, targetType: UnitType): boolean {
    if (!isUnitType(targetType)) return false;
    if (this.shotsLeft(orderIndex) <= 0) return false;
    const order = this.orders[orderIndex]!;
    if (samePosition(order.start, order.end)) return false;
    if (this.shots.some((shot) => shot.orderIndex === orderIndex)) return false;

    const steps = collisionSteps({ unitType: order.unit.getUnitType(), card: this.activeCard() });
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    const target = { unitType: targetType, closeAssault: true };
    return this.recordShot(orderIndex, dice, steps, [...COLLISION_NOTES], target, true);
  }

  // Close Assault card: no orders; in the battle the player marks each unit
  // that is adjacent to an enemy on the table, and it fires in close assault

  private canMarkCloseAssault(): boolean {
    return this.phase === TurnPhase.BATTLE && (this.activeCard()?.closeAssaultOnly ?? false);
  }

  private closeAssaultMarkable(): Position[] {
    if (!this.canMarkCloseAssault()) return [];
    const marked = new Set(this.orders.map((order) => order.unit));
    return this.board
      .getAllHexes()
      .filter((hex) => hex.unit && !marked.has(hex.unit))
      .map((hex) => hex.getPosition());
  }

  /** Mark the unit at `position` as in close assault: it may fire once, at an adjacent enemy */
  markCloseAssault(position: Position): boolean {
    if (!this.closeAssaultMarkable().some((p) => samePosition(p, position))) return false;

    const unit = this.board.getHex(position)!.unit!;
    const order = new Order({ unit, start: position, end: position, path: [position], shots: 1, closeAssaultOnly: true });
    this.orders = [...this.orders, order];
    return this.publish();
  }

  /** Take back the last mark, if that unit hasn't fired */
  undoCloseAssaultMark(): boolean {
    if (!this.canMarkCloseAssault()) return false;
    const index = this.orders.length - 1;
    if (index < 0 || this.shots.some((shot) => shot.orderIndex === index)) return false;

    this.orders = this.orders.slice(0, -1);
    return this.publish();
  }

  /** Take back this unit's last shot, for a shot recorded by mistake */
  undoShot(orderIndex: number): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const index = this.shots.findLastIndex((shot) => shot.orderIndex === orderIndex);
    if (index === -1) return false;

    this.shots = this.shots.filter((_, i) => i !== index);
    return this.publish();
  }

  private recordShot(
    orderIndex: number,
    dice: number,
    steps: DiceStep[],
    notes: string[],
    target: ShotTarget,
    collision = false
  ): true {
    const faces = rollDice(dice, this.random);
    const shot: Shot = { orderIndex, steps, dice, faces, notes, collision, target };
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  // --- END_OF_TURN

  // The battle is fought on the physical table and the retreats are made
  // after it; these then bring the app's board in line with the table

  /** Remove a unit destroyed on the table */
  removeUnit(position: Position): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN) return false;
    const unit = this.board.removeUnitAt(position);
    if (!unit) return false;

    this.battleEdits = [...this.battleEdits, { kind: "remove", position, unit }];
    return this.publish();
  }

  /** Move a unit to any empty hex, to mirror a retreat or taking ground */
  relocateUnit(from: Position, to: Position): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || samePosition(from, to)) return false;
    if (!this.board.getHex(to)?.isPassable()) return false;
    if (!this.board.moveUnit(from, to)) return false;

    this.battleEdits = [...this.battleEdits, { kind: "move", from, to }];
    return this.publish();
  }

  undoBattleEdit(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN) return false;
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

    this.chosenCard = null;
    this.chosenSection = null;
    this.drawnCard = null;
    this.orders = [];
    this.ordersCommitted = false;
    this.battleEdits = [];
    this.shots = [];
    this.unmovedFireSkipped = false;
    this.turn++;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  // --- saving

  save(): SavedGame {
    return writeSave(this.scenario.id, this.faction, this.board, {
      turn: this.turn,
      phase: this.phase,
      drawPile: this.deck.drawPile,
      discardPile: this.deck.discardPile,
      hand: this.hand,
      choiceCards: this.choiceCards,
      chosenCard: this.chosenCard,
      chosenSection: this.chosenSection,
      drawnCard: this.drawnCard,
      orders: this.orders,
      ordersCommitted: this.ordersCommitted,
      unmovedFireSkipped: this.unmovedFireSkipped,
      battleEdits: this.battleEdits,
      shots: this.shots,
      log: this.log,
    });
  }

  /** Rebuild a saved game. Throws if the save doesn't fit this scenario or these cards. */
  static restore(saved: SavedGame, scenario: Scenario, commandCards: CommandCard[], random?: () => number): GameSession {
    if (saved.scenarioId !== scenario.id) throw new Error(`Save is for scenario ${saved.scenarioId}`);

    const session = new GameSession({ scenario, faction: saved.faction, initialHandSize: 0, commandCards, random });
    const state: SessionState = readSave(saved, session.board, commandCards);
    session.deck.restorePiles([...state.drawPile], [...state.discardPile]);
    session.turn = state.turn;
    session.phase = state.phase;
    session.hand = state.hand;
    session.choiceCards = state.choiceCards;
    session.chosenCard = state.chosenCard;
    session.chosenSection = state.chosenSection;
    session.drawnCard = state.drawnCard;
    session.orders = state.orders;
    session.ordersCommitted = state.ordersCommitted;
    session.unmovedFireSkipped = state.unmovedFireSkipped;
    session.battleEdits = state.battleEdits;
    session.shots = state.shots;
    session.log = state.log;
    session.snapshot = session.createSnapshot();
    return session;
  }

  // --- internals

  private createSnapshot(): GameSnapshot {
    const orderContext = this.orderContext();
    return {
      turn: this.turn,
      phase: this.phase,
      hand: [...this.hand],
      choiceCards: [...this.choiceCards],
      chosenCard: this.chosenCard,
      activeCard: this.activeCard(),
      chosenSection: this.chosenSection,
      drawnCard: this.drawnCard,
      orders: this.orders,
      ordersLeft: orderContext ? ordersLeft(orderContext) : 0,
      orderable: orderContext ? orderablePositions(orderContext) : [],
      closeAssaultMarkable: this.closeAssaultMarkable(),
      ordersCommitted: this.ordersCommitted,
      battleEdits: this.battleEdits.length,
      drawPileCount: this.deck.getDrawPileCount(),
      discardPileCount: this.deck.getDiscardPileCount(),
      shots: this.shots,
      unmovedFireSkipped: this.unmovedFireSkipped,
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
