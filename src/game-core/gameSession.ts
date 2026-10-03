// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import CommandCard, { Section, isSection } from "./commandCard";
import Deck from "./deck";
import Order from "./order";
import Unit, { UnitType, isUnitType } from "./unit";
import { ShotTarget } from "../data/hitRules";
import { DIE_SIDES, DieFace, LONG_RANGE_DIE_SIDES, SixSidedFace, rollDice } from "./dice";
import { appliedFaces, isKeptList, readRoll } from "./rollResult";
import { DiceStep, FireAnswers, FireContext, calculateFireDice, nextFireQuestion } from "./fireRules";
import { FireTarget, fireTargets, mapAnswers } from "./fireTargets";
import {
  COLLISION_NOTES,
  FIRE_QUESTIONS,
  collisionSteps,
  TAKE_GROUND_UNIT_TYPES,
  combatBonusQuestion,
  fireBonusSteps,
  wireChoiceFor,
} from "../data/fireQuestions";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { HexType, Side } from "../types/hex";
import { Faction } from "../types/faction";
import { fromKey, positionKey, samePosition } from "./position";
import Hex from "./hex";
import {
  EXTRA_SLOT,
  MoveLimits,
  boostedLimits,
  OrderContext,
  OrderSlot,
  canBuyExtraOrder,
  cardOrdersLeft,
  extraOrderablePositions,
  fallbackCard,
  moveLimits,
  orderSlots,
  orderablePositions,
  ordersLeft,
  sameSlot,
  slotCost,
} from "./orderRules";
import { CoinEntry, RewardChoice, isRewardChoice, sumCoins, turnCoins } from "./coins";
import { STARTING_COINS, TEST_MODE_COINS } from "../data/coinRules";
import { CombatCard, DiceBonusEffect, MoveEffect } from "./combatCard";
import { MAX_COMBAT_HAND, STARTING_COMBAT_CARDS } from "../data/combatCards";
import { canMark, markablePositions } from "./markerRules";
import { SavedGame, SessionState, readSave, writeSave } from "./saveGame";
import { TurnRecord, recordTurn } from "./turnLog";
import { summarizeOrders } from "./turnSummary";

export interface GameSnapshot {
  turn: number;
  phase: TurnPhase;
  hand: readonly CommandCard[];
  /** The command card drawn in the final phase, once kept (it is already in the hand) */
  drawnCard: CommandCard | null;
  /** The second card drawn this turn, straight into the hand (the scenario's `extraDraws`) */
  extraDrawn: CommandCard | null;
  /** This turn's draw brings a second card (the scenario's `extraDraws`) */
  drawsExtra: boolean;
  /** Cards drawn in the final phase waiting for the player to keep one (Recon: 3); a single card is kept at once */
  drawOptions: readonly CommandCard[];
  /** The one card drawn (already kept) may be discarded once for another, which must be kept */
  canDrawAgain: boolean;
  /** The first card drawn this turn was discarded and the kept card is its replacement */
  drewAgain: boolean;
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
  /** The card's orders still to give, including optional ones paid in coins (Finest Hour) */
  cardOrdersLeft: number;
  /** Units that the card can still order (empty outside giving orders) */
  orderable: readonly Position[];
  /** Units that can take an extra order bought with coins (empty outside giving orders, or without the coins) */
  extraOrderable: readonly Position[];
  /** With a Close Assault card, in the battle: units that can still be marked as in close assault */
  closeAssaultMarkable: readonly Position[];
  ordersCommitted: boolean;
  /** Board changes made to mirror the table: after the battle, or in Órdenes before any order */
  battleEdits: number;
  /** The map can be changed by hand now: in the final phase, or in Órdenes before any order or mark */
  canEditMap: boolean;
  /** The last map change can be taken back now */
  canUndoMapEdit: boolean;
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
  /** Coins the player has now */
  coins: number;
  /** How this turn earned and spent coins, in the order of the ledger */
  coinEntries: readonly CoinEntry[];
  /** Coins can be added or taken by hand now (not in the extra turn, nor while waiting for it) */
  canAdjustCoins: boolean;
  /** Final phase: 2 coins or a combat card, once chosen */
  rewardChoice: RewardChoice | null;
  /** The final phase asks for the choice (not in the extra turn, nor after a card that gives its own reward) */
  needsRewardChoice: boolean;
  /** Combat cards in the hand (not the ones played this turn) */
  combatHand: readonly CombatCard[];
  combatDrawPileCount: number;
  /** Combat cards can be played this turn (not in the attacker's extra turn) */
  canPlayCombatCards: boolean;
  /** The order combat card played with the command card this turn */
  orderCombatCard: CombatCard | null;
  /** Hexes marked on the map for the order combat card (Barrage, Air Power…), in the order marked */
  markers: readonly Position[];
  /** Hexes that can be marked next (empty outside giving orders, or when all are marked) */
  markable: readonly Position[];
  /** The attack combat card's rolls, one per marked hex (Barrage, Air Power…) */
  cardAttacks: readonly CardAttack[];
  /** The attack combat card still has hexes to roll: no unit fires until they're done */
  attacksPending: boolean;
  /** The battle combat card played in this turn's battle (one per battle) */
  battleCombatCard: CombatCard | null;
  /** Ambush was played and hasn't fired yet: this side's units that can fire first, at an adjacent hex */
  ambushUnits: readonly Position[];
  /** The Ambush card's shot, once rolled */
  ambush: AmbushShot | null;
  /** The combat card drawn in the final phase */
  drawnCombatCard: CombatCard | null;
  /** The final phase still owes a combat card: drawing it is the next step */
  combatCardDue: boolean;
  /** The hand has more combat cards than allowed: one must be discarded before the next turn */
  mustDiscardCombatCard: boolean;
  /** The unit of each order fires from a hex with barbed wire and may remove it instead (infantry), by order index */
  canRemoveWire: readonly boolean[];
  /** Paratroopers placed so far, in order (PARADROP) */
  drops: readonly Position[];
  /** Paratroopers that can still be placed (PARADROP) */
  dropsLeft: number;
  /** Giving orders with none given yet: the card can be taken back (`unpickCard`) */
  canUnpickCard: boolean;
  /** The Reinforcements card's roll in the final phase, and the unit it brings on this map (null: none) */
  reinforcement: ReinforcementRoll | null;
  /** The Reinforcements card was played and its die is still to roll (final phase) */
  reinforcementDue: boolean;
  /** The unit rolled isn't on the map yet: the player taps an empty hex for it (its marked hex was taken) */
  reinforcementToPlace: UnitType | null;
}

export interface ReinforcementRoll {
  face: SixSidedFace;
  unitType: UnitType | null;
}

/** A roll at an enemy unit: how the dice were worked out, the faces and what was applied */
export interface ShotRoll {
  /** How the dice were worked out (a collision's steps; empty only in shots saved from before the quick roll was removed) */
  steps: readonly DiceStep[];
  dice: number;
  faces: readonly DieFace[];
  /** Reminders for resolving the hits (e.g. sandbags ignore 1 flag) */
  notes: readonly string[];
  /** Rolled for a collision in the movement phase, before the normal battle */
  collision: boolean;
  /** What it was rolled against, to read the hits */
  target: ShotTarget;
  /** It used the battle combat card's extra dice (Spotter, Street Fight, Explosives) */
  combatBonus: boolean;
  /**
   * The dice whose results are applied, as indexes into `faces` in the order
   * rolled, when the player applies fewer results than were rolled (a unit
   * with few figures); null applies them all. Hits and coins count only these.
   */
  kept: readonly number[] | null;
  /** The hex fired at, when it was picked on the map */
  targetPosition?: Position;
}

/** A unit's shot this turn. Once rolled it stands; only a deliberate undo removes it. */
export interface Shot extends ShotRoll {
  /** Index of the firing unit's order in this turn's orders */
  orderIndex: number;
  /** After this close assault the unit took ground (the target retreated or was eliminated) and gets one more shot */
  tookGround?: boolean;
  /** Instead of firing, the unit removed the barbed wire on this hex (no dice) */
  removedWire?: Position;
}

/**
 * Ambush (a battle combat card): one of this side's units, ordered or not,
 * fires first at the enemy unit attacking it in close assault. It isn't one
 * of the unit's own shots, and the command card adds nothing to it.
 */
export interface AmbushShot extends ShotRoll {
  /** Where the ambushing unit stands */
  from: Position;
  unitType: UnitType;
  targetPosition: Position;
}

/** The roll of an attack combat card on one marked hex (Barrage, Air Power, Air Bombardment) */
export interface CardAttack {
  /** Index of the hex in the turn's markers */
  marker: number;
  /** The enemy unit on the hex, or null when it was empty (no roll) */
  target: ShotTarget | null;
  dice: number;
  faces: readonly DieFace[];
}

/** Reminder kept with every attack combat card roll */
export const CARD_ATTACK_NOTE = "Los suministros cuentan como impacto y las retiradas no se pueden ignorar.";

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
  /** It can use the order combat card's movement (Frozen Ground…) */
  canBoost: boolean;
}

interface GameSessionOptions {
  scenario: Scenario;
  faction: Faction;
  initialHandSize: number;
  commandCards: CommandCard[];
  /** This side's combat deck; the hand starts with 2 of them */
  combatCards?: CombatCard[];
  /** Shots at range roll the 8-sided long-range die (an experiment, chosen per game) */
  longRangeDie?: boolean;
  /**
   * Test mode, to try every combat card: the whole combat deck starts in the hand, there's no
   * hand limit, cards played come back to the hand, and each turn starts with plenty of coins
   */
  testMode?: boolean;
  /** Random source for the dice, [0, 1) like Math.random; tests pass a fixed one */
  random?: () => number;
}

/**
 * A change made to match the physical table: in END_OF_TURN after the battle,
 * or in ORDER_UNITS before any order (`beforeOrders`), when the map turns out
 * not to match the table (a roll changed at the table, a missed retreat)
 */
export type BattleEdit = (
  | { kind: "remove"; position: Position; unit: Unit }
  | { kind: "move"; from: Position; to: Position }
  /** A unit that arrived: the Reinforcements card */
  | { kind: "add"; position: Position; unit: Unit }
  /** Barbed wire removed at the table (by the other side, or missed here) */
  | { kind: "wire"; position: Position }
) & { beforeOrders?: boolean };

/**
 * Owns one player's game: board, command cards and the turn flow
 * PICK_CARDS -> ORDER_UNITS -> MOVEMENT -> BATTLE -> END_OF_TURN -> (next turn). The attacking side
 * plays turn 1 alone; the defender waits in AWAIT_ATTACKER and starts at turn 2. A side with a
 * paradrop starts in PARADROP, placing the units that landed on the table.
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
  /** Shots at range roll the 8-sided long-range die */
  readonly longRangeDie: boolean;
  /** Test mode: every combat card in hand, played cards come back, plenty of coins */
  readonly testMode: boolean;
  readonly board: BoardManager;
  /** Every command card in this side's deck, wherever it is now */
  readonly commandCards: readonly CommandCard[];
  private readonly deck: Deck;
  private hand: CommandCard[];

  private turn = 1;
  private phase: TurnPhase;
  private chosenCard: CommandCard | null = null;
  private chosenSection: Section | null = null;
  private drawnCard: CommandCard | null = null;
  private extraDrawn: CommandCard | null = null;
  private drawOptions: CommandCard[] = [];
  private drewAgain = false;
  private orders: Order[] = [];
  private ordersCommitted = false;
  private battleEdits: BattleEdit[] = [];
  private shots: Shot[] = [];
  private unmovedFireSkipped = false;
  private log: TurnRecord[] = [];
  /** Coins at the start of this turn; this turn's ledger adds to it */
  private startCoins = STARTING_COINS;
  private coinAdjustments: number[] = [];
  private rewardChoice: RewardChoice | null = null;
  /** Every combat card in this side's deck */
  readonly combatCards: readonly CombatCard[];
  private readonly combatDeck: Deck<CombatCard>;
  private combatHand: CombatCard[];
  private orderCombatCard: CombatCard | null = null;
  private markers: Position[] = [];
  private cardAttacks: CardAttack[] = [];
  private battleCombatCard: CombatCard | null = null;
  private ambush: AmbushShot | null = null;
  private drawnCombatCard: CombatCard | null = null;
  private drops: Position[] = [];
  private reinforcementFace: SixSidedFace | null = null;
  private readonly random: () => number;

  private readonly listeners = new Set<() => void>();
  private snapshot: GameSnapshot;

  constructor({
    scenario,
    faction,
    initialHandSize,
    commandCards,
    combatCards = [],
    longRangeDie = false,
    testMode = false,
    random = () => Math.random(),
  }: GameSessionOptions) {
    this.scenario = scenario;
    this.longRangeDie = longRangeDie;
    this.testMode = testMode;
    this.random = random;
    this.faction = faction;
    this.attacking = scenario.attacker === faction;
    this.phase = this.paradrop() ? TurnPhase.PARADROP : this.firstPhase();
    this.board = new BoardManager(scenario, faction);
    this.commandCards = commandCards;
    this.deck = new Deck(commandCards);
    this.hand = this.deck.draw(initialHandSize);
    this.combatCards = combatCards;
    this.combatDeck = new Deck(combatCards);
    this.combatHand = this.combatDeck.draw(testMode ? combatCards.length : STARTING_COMBAT_CARDS);
    if (testMode) this.startCoins = TEST_MODE_COINS;
    this.snapshot = this.createSnapshot();
  }

  // --- subscription (arrow functions so they can be passed around unbound)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameSnapshot => this.snapshot;

  /** The phase the game starts in, after any paradrop */
  private firstPhase(): TurnPhase {
    return this.attacking ? TurnPhase.PICK_CARDS : TurnPhase.AWAIT_ATTACKER;
  }

  // --- PARADROP

  /** This side's paradrop, if the scenario has one */
  private paradrop() {
    const paradrop = this.scenario.paradrop;
    return paradrop?.faction === this.faction ? paradrop : null;
  }

  private dropsLeft(): number {
    const paradrop = this.paradrop();
    return this.phase === TurnPhase.PARADROP && paradrop ? paradrop.units - this.drops.length : 0;
  }

  /** A paratrooper landed on this empty hex on the table */
  dropUnit(position: Position): boolean {
    const paradrop = this.paradrop();
    if (!paradrop || this.dropsLeft() === 0) return false;
    if (!this.placeNewUnit(position, paradrop.unitType)) return false;

    this.drops = [...this.drops, position];
    return this.publish();
  }

  /** Put a new unit on an empty hex it can stand on (paratroopers, reinforcements) */
  private placeNewUnit(position: Position, unitType: UnitType): Unit | null {
    const hex = this.board.getHex(position);
    if (!hex?.isPassable() || hex.hasUnit()) return null;
    const unit = new Unit(unitType);
    return this.board.placeUnitAt(position, unit) ? unit : null;
  }

  undoDrop(): boolean {
    const last = this.drops.at(-1);
    if (this.phase !== TurnPhase.PARADROP || !last) return false;

    this.board.removeUnitAt(last);
    this.drops = this.drops.slice(0, -1);
    return this.publish();
  }

  /** All the paratroopers that landed are placed (the others missed the board or hit a unit): start */
  finishParadrop(): boolean {
    if (this.phase !== TurnPhase.PARADROP) return false;

    this.phase = this.firstPhase();
    return this.publish();
  }

  // --- AWAIT_ATTACKER

  /** The attacker has finished the extra turn at the table: the defender joins in at turn 2 */
  startFirstTurn(): boolean {
    if (this.phase !== TurnPhase.AWAIT_ATTACKER) return false;

    this.turn = 2;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  // --- PICK_CARDS

  /**
   * The card orders units in a section the player picks when playing it (and
   * doesn't fall back to 1 unit), or Tactician changes the section of a card
   * for one section
   */
  cardNeedsSection(card: CommandCard, combatCard?: CombatCard): boolean {
    if (combatCard?.effect?.kind === "changeSection") return this.combatCardFits(card, combatCard);
    return card.choosesSection && !fallbackCard(card, this.board);
  }

  /**
   * The order combat card does something with this command card. Tactician
   * only changes a card that orders units in one fixed section, so it can't
   * be played (and paid for) with General Advance or a card of any section.
   */
  combatCardFits(card: CommandCard, combatCard: CombatCard): boolean {
    if (combatCard.effect?.kind !== "changeSection") return true;
    return card.sections !== "chosen" && card.sections.length === 1;
  }

  /**
   * Play a card from the hand; see `cardNeedsSection` for when it takes a
   * section. An order combat card from the hand can be played with it, paid now.
   */
  pickCard(card: CommandCard, section?: Section, combatCard?: CombatCard): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (!this.hand.includes(card)) return false;
    if (combatCard && !this.canPlayCombatCard(combatCard, "order")) return false;
    if (combatCard && !this.combatCardFits(card, combatCard)) return false;
    if (this.cardNeedsSection(card, combatCard) ? !isSection(section) : section !== undefined) return false;

    if (combatCard) this.playCombatCard(combatCard);
    this.chosenCard = card;
    this.chosenSection = section ?? null;
    this.phase = TurnPhase.ORDER_UNITS;
    return this.publish();
  }

  /** The card picked can still be taken back: giving orders, none given yet */
  private canUnpickCard(): boolean {
    return this.phase === TurnPhase.ORDER_UNITS && !this.ordersCommitted && this.orders.length === 0;
  }

  /**
   * Go back to choosing a card, before any order is given. An order combat
   * card played with it goes back to the hand, and its coins come back.
   */
  unpickCard(): boolean {
    if (!this.canUnpickCard()) return false;

    if (this.orderCombatCard) this.combatHand = [...this.combatHand, this.orderCombatCard];
    this.orderCombatCard = null;
    this.markers = [];
    this.chosenCard = null;
    this.chosenSection = null;
    this.phase = TurnPhase.PICK_CARDS;
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
    return { card, chosenSection: this.chosenSection, board: this.board, orders: this.orders, coins: this.coins() };
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
  getMoveOptions(position: Position, slot?: OrderSlot, boost = false): MoveOptions | null {
    const context = this.orderContext();
    const hex = this.board.getHex(position);
    const unit = hex?.unit;
    if (!context || !hex || !unit) return null;
    const slots = this.slotsFor(context, unit, hex.getSide(), slot);
    const moveSlot = slot ? this.slotFor(slots, slot) : (slots.find((s) => !s.onTheMove) ?? slots[0]);
    if (!moveSlot) return null;
    const canBoost = this.canBoost(hex, moveSlot);
    if (boost && !canBoost) return null;

    const plan = this.movePlan(hex, moveLimits(context.card, unit, moveSlot), boost);
    return {
      moves: [...plan.paths(plan.limits.maxMove).keys()].map(fromKey),
      moveAndFire: [...plan.paths(plan.limits.moveAndFire, true).keys()].map(fromKey),
      limits: plan.limits,
      slots,
      canBoost,
    };
  }

  // Order combat cards that change how some units move (Frozen Ground, Armor Forward, Rattenkrieg…)

  private moveEffect(): MoveEffect | null {
    const effect = this.orderCombatCard?.effect;
    return effect?.kind === "move" ? effect : null;
  }

  /** How many more ordered units can use the order combat card's movement */
  private boostsLeft(): number {
    const effect = this.moveEffect();
    return effect ? effect.units - this.orders.filter((order) => order.boosted).length : 0;
  }

  /** The unit on this hex, in this order slot, can use the order combat card's movement */
  private canBoost(hex: Hex, slot: OrderSlot): boolean {
    const effect = this.moveEffect();
    const unit = hex.unit;
    if (!effect || !unit || this.boostsLeft() <= 0) return false;
    if (effect.notOnTheMove && slot.onTheMove) return false;
    if (effect.unitTypes && !effect.unitTypes.includes(unit.getUnitType())) return false;
    if (effect.startNear) {
      const near = [hex.getPosition(), ...hex.getNeighbors()].some((p) =>
        effect.startNear!.includes(this.board.getHex(p)?.getType() as HexType)
      );
      if (!near) return false;
    }
    return true;
  }

  /** The unit's move limits and paths, with the order combat card's movement when `boost` */
  private movePlan(hex: Hex, limits: MoveLimits, boost: boolean) {
    const effect = boost ? this.moveEffect() : null;
    const rules = effect ? { ignoreTerrain: effect.ignoreTerrain, fireInto: effect.fireInto } : {};
    const endsOk = (key: string) => !effect?.endOn || effect.endOn.includes(this.board.getHex(fromKey(key))!.getType());
    return {
      limits: effect ? boostedLimits(limits, effect) : limits,
      paths: (range: number, forFire = false) =>
        new Map([...this.board.getAllPaths(hex, range, forFire, rules)].filter(([key]) => endsOk(key))),
    };
  }

  /**
   * Order the unit at `from` to move to `to`, or to hold when `to` equals `from`.
   * `slot` is needed when the unit can fill more than one section's orders.
   */
  issueOrder(from: Position, to: Position, slot?: OrderSlot, boost = false): boolean {
    const context = this.orderContext();
    const hex = this.board.getHex(from);
    const unit = hex?.unit;
    if (!context || !hex || !unit) return false;
    const chosen = this.slotFor(this.slotsFor(context, unit, hex.getSide(), slot), slot);
    if (!chosen) return false;
    if (boost && !this.canBoost(hex, chosen)) return false;
    const plan = this.movePlan(hex, moveLimits(context.card, unit, chosen), boost);
    const limits = plan.limits;
    const cost = slotCost(context.card, unit, chosen);
    if (cost > context.coins) return false;

    let order: Order;
    const props = {
      unit,
      start: from,
      end: to,
      section: chosen.section,
      onTheMove: chosen.onTheMove,
      extra: chosen.extra ?? false,
      cost,
      boosted: boost,
    };
    if (samePosition(from, to)) {
      order = new Order({ ...props, path: [from], shots: limits.holdShots });
    } else {
      // Paths must be found before moving: afterwards the start hex is empty and the destination taken
      const path = plan.paths(limits.maxMove).get(positionKey(to));
      const canFire = plan.paths(limits.moveAndFire, true).has(positionKey(to));
      if (!path || !this.board.moveUnit(from, to)) return false;
      order = new Order({ ...props, path, shots: canFire ? 1 : 0 });
    }

    this.orders = [...this.orders, order];
    return this.publish();
  }

  /** The card's slots for the unit, or the extra order bought with coins when that's what's asked for */
  private slotsFor(context: OrderContext, unit: Unit, side: Side, slot?: OrderSlot): OrderSlot[] {
    if (!slot?.extra) return orderSlots(context, unit, side);
    return !this.extraTurn() && canBuyExtraOrder(context, unit) ? [EXTRA_SLOT] : [];
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
    if (this.markersLeft() > 0) return false;

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
    // The 2 coins unless the player picks the combat card instead
    if (this.needsRewardChoice()) this.rewardChoice = "coins";
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
    return summarizeOrders(this.orders, this.board, this.shots, this.unmovedFireSkipped, this.orderCombatCard);
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
    if (this.shotsLeft(orderIndex) <= 0 || this.attacksPending()) return false;
    return !this.summaries()[orderIndex]!.waiting;
  }

  /** The battle combat card's extra dice, if this unit can still use them (Spotter, Street Fight, Explosives) */
  combatBonusFor(orderIndex: number): (DiceBonusEffect & { name: string }) | undefined {
    const card = this.battleCombatCard;
    const order = this.orders[orderIndex];
    if (this.phase !== TurnPhase.BATTLE || card?.effect?.kind !== "diceBonus" || !order) return undefined;
    if (this.shots.some((shot) => shot.combatBonus)) return undefined;
    if (!card.effect.unitTypes.includes(order.unit.getUnitType())) return undefined;
    return { ...card.effect, name: card.name };
  }

  // Attack combat cards: one roll per marked hex, before any other shot

  private attackEffect() {
    const effect = this.orderCombatCard?.effect;
    return effect?.kind === "attack" ? effect : null;
  }

  private attacksPending(): boolean {
    return this.phase === TurnPhase.BATTLE && !!this.attackEffect() && this.cardAttacks.length < this.markers.length;
  }

  /**
   * Roll the attack combat card on a marked hex: `targetType` is the enemy
   * unit on it, or null when the hex was empty (nothing to roll). Supplies hit.
   */
  attackHex(marker: number, targetType: UnitType | null): boolean {
    const effect = this.attackEffect();
    if (this.phase !== TurnPhase.BATTLE || !effect || !this.markers[marker]) return false;
    if (this.cardAttacks.some((attack) => attack.marker === marker)) return false;
    if (targetType !== null && !isUnitType(targetType)) return false;

    const attack: CardAttack =
      targetType === null
        ? { marker, target: null, dice: 0, faces: [] }
        : {
            marker,
            target: { unitType: targetType, closeAssault: false, suppliesHit: true },
            dice: effect.dicePerHex,
            faces: rollDice(effect.dicePerHex, this.random),
          };
    this.cardAttacks = [...this.cardAttacks, attack];
    return this.publish();
  }

  /** Take back a hex's attack roll, for one recorded by mistake */
  undoCardAttack(marker: number): boolean {
    if (this.phase !== TurnPhase.BATTLE || !this.cardAttacks.some((attack) => attack.marker === marker)) return false;

    this.cardAttacks = this.cardAttacks.filter((attack) => attack.marker !== marker);
    return this.publish();
  }

  /**
   * Fire with the unit of this order, using the answers to the fire questions
   * to work out the dice. The questionnaire must be complete. A shot worth 0
   * dice is still recorded: the unit has used its fire.
   */
  /** What the fire questions need to know about this unit's next shot */
  private fireContextFor(orderIndex: number): FireContext | null {
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    if (!order || !summary) return null;
    return {
      unitType: order.unit.getUnitType(),
      card: this.cardFor(order),
      closeAssaultOnly: summary.closeAssaultOnly,
      combatBonus: this.combatBonusFor(orderIndex),
      fromTerrain: this.board.getHex(summary.firingFrom)?.getType(),
      fromWire: this.board.getHex(summary.firingFrom)?.wire ?? false,
    };
  }

  /**
   * The hexes this unit can fire at from where it stands (or the hex it took
   * ground on): in range, and whether each is in sight and how many dice it gets.
   */
  fireTargetsFor(orderIndex: number): FireTarget[] {
    const context = this.fireContextFor(orderIndex);
    if (this.phase !== TurnPhase.BATTLE || !context) return [];
    return fireTargets(this.board, this.summaries()[orderIndex]!.firingFrom, context);
  }

  /** Fire answering the questionnaire by hand (the answers include the distance and the target's terrain) */
  fire(orderIndex: number, answers: FireAnswers): boolean {
    return this.fireWith(orderIndex, answers);
  }

  /**
   * Fire at a hex picked on the map: its distance and terrain answer those
   * questions. Only a hex in range and in sight, where the shot gets dice.
   */
  fireAt(
    orderIndex: number,
    { position, unitType, sandbags, useCombatBonus = false }: { position: Position; unitType: UnitType; sandbags: boolean; useCombatBonus?: boolean }
  ): boolean {
    const target = this.fireTargetsFor(orderIndex).find((t) => samePosition(t.position, position));
    if (!target || !target.lineOfSight || target.dice <= 0) return false;
    const context = this.fireContextFor(orderIndex)!;
    const answers: Record<string, string> = {
      ...mapAnswers(target),
      targetType: unitType,
      sandbags: sandbags ? "yes" : "no",
    };
    if (combatBonusQuestion.appliesTo?.(context, answers) ?? false) answers.combatCard = useCombatBonus ? "yes" : "no";
    return this.fireWith(orderIndex, answers, position);
  }

  private fireWith(orderIndex: number, answers: FireAnswers, targetPosition?: Position): boolean {
    if (!this.canFireNow(orderIndex)) return false;
    const order = this.orders[orderIndex]!;
    const context = this.fireContextFor(orderIndex)!;
    if (nextFireQuestion(FIRE_QUESTIONS, context, answers)) return false;
    if (context.closeAssaultOnly && answers.distance !== "1") return false;

    const { dice, steps, notes, blocked } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
    if (blocked) return false;
    const unitType = answers.targetType as UnitType;
    if (!isUnitType(unitType)) return false;
    const target = this.targetFor(order, { unitType, closeAssault: answers.distance === "1" });
    const usedBonus =
      !!context.combatBonus && answers.combatCard === "yes" && (combatBonusQuestion.appliesTo?.(context, answers) ?? true);
    return this.recordShot(orderIndex, dice, steps, notes, target, false, usedBonus, targetPosition);
  }

  /**
   * The unit's last shot was a close assault that pushed back or eliminated
   * its target, so it can take ground and fire once more: armour always,
   * infantry with Fragor del combate (for as many units as the card says).
   * Once per unit per turn; not after a collision.
   */
  canTakeGround(orderIndex: number): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    const last = this.shots.findLast((shot) => shot.orderIndex === orderIndex);
    if (!order || !summary || summary.removed || summary.tookGround || !last) return false;
    if (!last.target.closeAssault || last.collision || !last.targetPosition) return false;
    // Only when the target could have retreated (a flag) or been eliminated (a hit)
    const { hits, retreats } = readRoll(appliedFaces(last.faces, last.kept), last.target);
    if (hits === 0 && retreats === 0) return false;
    const unitType = order.unit.getUnitType();
    if (TAKE_GROUND_UNIT_TYPES.includes(unitType)) return true;
    const effect = this.battleCombatCard?.effect;
    if (effect?.kind !== "takeGround" || !effect.unitTypes.includes(unitType)) return false;
    // The card's units already used: units of its types (not armour) that took ground
    const used = this.summaries().filter(
      (s) => s.tookGround && effect.unitTypes.includes(s.unitType) && !TAKE_GROUND_UNIT_TYPES.includes(s.unitType)
    ).length;
    return used < effect.units;
  }

  /**
   * The unit took ground after its last shot: it moves to the hex it fired at
   * (as a map edit, as the player would in the final phase) and gets one more
   * shot, in close assault, from there.
   */
  takeGround(orderIndex: number): boolean {
    if (!this.canTakeGround(orderIndex)) return false;
    const last = this.shots.findLast((shot) => shot.orderIndex === orderIndex)!;
    const from = this.orders[orderIndex]!.end;
    const to = last.targetPosition!;
    if (!this.board.moveUnit(from, to)) return false;
    this.battleEdits = [...this.battleEdits, { kind: "move", from, to }];
    this.shots = this.shots.map((shot) => (shot === last ? { ...shot, tookGround: true } : shot));
    return this.publish();
  }

  /** Take back taking ground, while its extra shot hasn't been fired: the unit goes back */
  undoTakeGround(orderIndex: number): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const last = this.shots.findLast((shot) => shot.orderIndex === orderIndex);
    if (!last?.tookGround || !last.targetPosition) return false;
    const from = this.orders[orderIndex]!.end;
    const to = last.targetPosition;
    const edit = this.battleEdits.findLastIndex(
      (e) => e.kind === "move" && samePosition(e.from, from) && samePosition(e.to, to)
    );
    if (edit === -1 || !this.board.moveUnit(to, from)) return false;
    this.battleEdits = this.battleEdits.filter((_, i) => i !== edit);
    this.shots = this.shots.map((shot) => (shot === last ? { ...shot, tookGround: false } : shot));
    return this.publish();
  }

  // Ambush: a unit of this side fires first at the enemy that attacks it in close assault

  private ambushPlayed(): boolean {
    return this.phase === TurnPhase.BATTLE && this.battleCombatCard?.effect?.kind === "ambush";
  }

  /** What the fire questions need to know about an ambush from this hex: close assault, no command card */
  ambushContext(from: Position): FireContext | null {
    const hex = this.board.getHex(from);
    if (!hex?.hasUnit()) return null;
    return {
      unitType: hex.unit.getUnitType(),
      card: null,
      closeAssaultOnly: true,
      fromTerrain: hex.getType(),
      fromWire: hex.wire,
    };
  }

  /** The adjacent hexes a unit at `from` can fire at with Ambush, with their dice */
  ambushTargets(from: Position): FireTarget[] {
    const context = this.ambushContext(from);
    if (!this.ambushPlayed() || !context) return [];
    return fireTargets(this.board, from, context);
  }

  /** This side's units that can fire with Ambush now: at least one adjacent hex worth a die */
  private ambushUnits(): Position[] {
    if (!this.ambushPlayed() || this.ambush) return [];
    return this.board
      .getAllHexes()
      .filter((hex) => hex.hasUnit() && this.ambushTargets(hex.getPosition()).some((t) => t.dice > 0))
      .map((hex) => hex.getPosition());
  }

  /** Fire first with the unit at `from`, at the adjacent hex of the enemy unit attacking it (Ambush) */
  ambushAt(from: Position, { position, unitType, sandbags }: { position: Position; unitType: UnitType; sandbags: boolean }): boolean {
    if (!this.ambushPlayed() || this.ambush || !isUnitType(unitType)) return false;
    const target = this.ambushTargets(from).find((t) => samePosition(t.position, position));
    if (!target || target.dice <= 0) return false;
    const context = this.ambushContext(from)!;
    const answers = { ...mapAnswers(target), targetType: unitType, sandbags: sandbags ? "yes" : "no" };
    const { dice, steps, notes, blocked } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
    if (blocked) return false;

    this.ambush = {
      from: { ...from },
      unitType: context.unitType,
      targetPosition: { ...position },
      steps,
      dice,
      faces: rollDice(dice, this.random),
      notes,
      collision: false,
      target: { unitType, closeAssault: true },
      combatBonus: false,
      kept: null,
    };
    return this.publish();
  }

  /** Take back the Ambush shot, recorded by mistake */
  undoAmbush(): boolean {
    if (this.phase !== TurnPhase.BATTLE || !this.ambush) return false;
    this.ambush = null;
    return this.publish();
  }

  /** Apply only some of the Ambush shot's results (or all again, with null) */
  keepAmbushResults(kept: readonly number[] | null): boolean {
    if (this.phase !== TurnPhase.BATTLE || !this.ambush) return false;
    if (kept !== null && !isKeptList(kept, this.ambush.faces.length)) return false;
    const sorted = kept && kept.length < this.ambush.faces.length ? [...kept].sort((a, b) => a - b) : null;
    this.ambush = { ...this.ambush, kept: sorted };
    return this.publish();
  }

  // Barbed wire: infantry standing on it fires with a die less (fireBonusSteps),
  // or removes it instead of firing, which uses up the shot

  /** The unit of this order can remove the wire it stands on now, instead of its next shot */
  private canRemoveWire(orderIndex: number): boolean {
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    if (!order || !summary || !this.canFireNow(orderIndex)) return false;
    return !!this.board.getHex(summary.firingFrom)?.wire && wireChoiceFor(order.unit.getUnitType());
  }

  /** Remove the barbed wire under this unit instead of firing: it counts as the unit's shot */
  removeWire(orderIndex: number): boolean {
    if (!this.canRemoveWire(orderIndex)) return false;
    const position = { ...this.summaries()[orderIndex]!.firingFrom };
    this.board.getHex(position)!.setWire(false);
    const target = { unitType: this.orders[orderIndex]!.unit.getUnitType(), closeAssault: false };
    const shot: Shot = { orderIndex, steps: [], dice: 0, faces: [], notes: [], collision: false, target, combatBonus: false, kept: null, removedWire: position };
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  /** The target of a shot, marked as rolled on the long-range die when the game uses it and the target isn't adjacent */
  private targetFor(order: Order, { unitType, closeAssault }: ShotTarget): ShotTarget {
    return this.longRangeDie && !closeAssault
      ? { unitType, closeAssault, longRangeFirer: order.unit.getUnitType() }
      : { unitType, closeAssault };
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

    const steps = collisionSteps({ unitType: order.unit.getUnitType(), card: this.cardFor(order) });
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    const target = { unitType: targetType, closeAssault: true };
    return this.recordShot(orderIndex, dice, steps, [...COLLISION_NOTES], target, true);
  }

  /** The card whose bonuses the order gets: none for an extra order bought with coins */
  private cardFor(order: Order): CommandCard | null {
    return order.extra ? null : this.activeCard();
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
    if (!this.orders[index]?.closeAssaultOnly || this.shots.some((shot) => shot.orderIndex === index)) return false;

    this.orders = this.orders.slice(0, -1);
    return this.publish();
  }

  /** Take back this unit's last shot, for a shot recorded by mistake */
  undoShot(orderIndex: number): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const index = this.shots.findLastIndex((shot) => shot.orderIndex === orderIndex);
    if (index === -1) return false;

    const wire = this.shots[index]!.removedWire;
    if (wire) this.board.getHex(wire)?.setWire(true);
    this.shots = this.shots.filter((_, i) => i !== index);
    return this.publish();
  }

  /**
   * Apply only some of the results of this unit's shot number `shotNumber`
   * (0 for its first shot this turn): `kept` are indexes into its faces, and
   * null applies them all again. The roll itself stays as it was.
   */
  keepResults(orderIndex: number, shotNumber: number, kept: readonly number[] | null): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const shot = this.shots.filter((s) => s.orderIndex === orderIndex)[shotNumber];
    if (!shot) return false;
    if (kept !== null && !isKeptList(kept, shot.faces.length)) return false;

    const sorted = kept && kept.length < shot.faces.length ? [...kept].sort((a, b) => a - b) : null;
    this.shots = this.shots.map((s) => (s === shot ? { ...s, kept: sorted } : s));
    return this.publish();
  }

  private recordShot(
    orderIndex: number,
    dice: number,
    steps: DiceStep[],
    notes: string[],
    target: ShotTarget,
    collision = false,
    combatBonus = false,
    targetPosition?: Position
  ): true {
    const faces = rollDice(dice, this.random, target.longRangeFirer ? LONG_RANGE_DIE_SIDES : DIE_SIDES);
    const shot: Shot = { orderIndex, steps, dice, faces, notes, collision, target, combatBonus, kept: null };
    if (targetPosition) shot.targetPosition = targetPosition;
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  // --- coins: earned and spent through the turn; `turnCoins` works out the ledger

  private extraTurn(): boolean {
    return this.attacking && this.turn === 1;
  }

  private turnCoinEntries(): CoinEntry[] {
    const endOfTurn = this.phase === TurnPhase.END_OF_TURN;
    return turnCoins({
      orders: this.orders,
      combatCards: [this.orderCombatCard, this.battleCombatCard].filter((card) => card !== null),
      shots: this.shots,
      ambush: this.ambush,
      adjustments: this.coinAdjustments,
      reward: this.rewardChoice,
      cardReward: endOfTurn ? (this.chosenCard?.endOfTurnReward?.coins ?? 0) : 0,
      extraTurn: this.extraTurn(),
    });
  }

  /** Coins the player has now. It can drop below 0 only when a shot that earned coins already spent is undone. */
  private coins(): number {
    return this.startCoins + sumCoins(this.turnCoinEntries());
  }

  private canAdjustCoins(): boolean {
    return this.phase !== TurnPhase.AWAIT_ATTACKER && !this.extraTurn();
  }

  /**
   * Add (or, negative, take) coins by hand, e.g. to pay for a combat card
   * played at the table. The player can't spend more than they have.
   */
  adjustCoins(amount: number): boolean {
    if (!Number.isInteger(amount) || amount === 0 || !this.canAdjustCoins()) return false;
    if (amount < 0 && this.coins() + amount < 0) return false;

    this.coinAdjustments = [...this.coinAdjustments, amount];
    return this.publish();
  }

  /** Take back this turn's last change by hand */
  undoCoinAdjustment(): boolean {
    if (!this.canAdjustCoins() || this.coinAdjustments.length === 0) return false;

    this.coinAdjustments = this.coinAdjustments.slice(0, -1);
    return this.publish();
  }

  private needsRewardChoice(): boolean {
    return this.phase === TurnPhase.END_OF_TURN && !this.extraTurn() && !this.chosenCard?.endOfTurnReward;
  }

  /**
   * Final phase: take 2 coins or a combat card. Coins can be changed for the
   * card until the turn ends; the combat card is drawn at once, so it stays.
   */
  chooseReward(choice: RewardChoice): boolean {
    if (!this.needsRewardChoice() || !isRewardChoice(choice)) return false;
    if (this.drawnCombatCard) return false;

    this.rewardChoice = choice;
    if (choice === "combatCard") this.drawCombat();
    return this.publish();
  }

  // --- combat cards: order cards are played with the command card, battle
  // cards at any time in the battle (one each per turn), paid when played

  private hasCombatCards(): boolean {
    return this.combatDeck.getDrawPileCount() + this.combatDeck.getDiscardPileCount() > 0;
  }

  private canPlayCombatCard(card: CombatCard, phase: CombatCard["phase"]): boolean {
    return (
      !this.extraTurn() && card.phase === phase && this.combatHand.includes(card) && card.cost <= this.coins()
    );
  }

  private playCombatCard(card: CombatCard) {
    this.combatHand = this.combatHand.filter((c) => c !== card);
    if (card.phase === "order") this.orderCombatCard = card;
    else this.battleCombatCard = card;
  }

  /** Take back the order combat card while giving orders, before they're confirmed; its coins come back */
  cancelOrderCombatCard(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted || !this.orderCombatCard) return false;

    this.combatHand = [...this.combatHand, this.orderCombatCard];
    this.orderCombatCard = null;
    this.markers = [];
    return this.publish();
  }

  // Map markers: the hexes the order combat card targets, or where its unit appears

  private markerRule() {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.ordersCommitted) return null;
    return this.orderCombatCard?.marker ?? null;
  }

  private markersLeft(): number {
    const rule = this.orderCombatCard?.marker;
    return rule ? rule.count - this.markers.length : 0;
  }

  /** Mark a hex for the order combat card; see markerRules.ts for where */
  markHex(position: Position): boolean {
    const rule = this.markerRule();
    if (!rule || !canMark(rule, this.board, this.markers, position)) return false;

    this.markers = [...this.markers, { row: position.row, col: position.col }];
    return this.publish();
  }

  private markableNow(): Position[] {
    const rule = this.markerRule();
    return rule ? markablePositions(rule, this.board, this.markers) : [];
  }

  undoMarker(): boolean {
    if (!this.markerRule() || this.markers.length === 0) return false;

    this.markers = this.markers.slice(0, -1);
    return this.publish();
  }

  /** Play a battle combat card from the hand (one per battle), paid now */
  playBattleCombatCard(card: CombatCard): boolean {
    if (this.phase !== TurnPhase.BATTLE || this.battleCombatCard) return false;
    if (!this.canPlayCombatCard(card, "battle")) return false;

    this.playCombatCard(card);
    return this.publish();
  }

  /** Take back the battle combat card played by mistake; its coins come back */
  undoBattleCombatCard(): boolean {
    if (this.phase !== TurnPhase.BATTLE || !this.battleCombatCard) return false;
    // A shot already used its dice, or Ambush fired: undo that shot first
    if (this.shots.some((shot) => shot.combatBonus) || this.ambush) return false;

    this.combatHand = [...this.combatHand, this.battleCombatCard];
    this.battleCombatCard = null;
    return this.publish();
  }

  /** The final phase owes a combat card (the choice, or Preparations) that hasn't been drawn */
  private combatCardDue(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || this.extraTurn() || this.drawnCombatCard) return false;
    if (!this.hasCombatCards()) return false;
    return this.rewardChoice === "combatCard" || (this.chosenCard?.endOfTurnReward?.combatCard ?? false);
  }

  private drawCombat() {
    const [card] = this.combatDeck.draw(1);
    if (!card) return;
    this.combatHand = [...this.combatHand, card];
    this.drawnCombatCard = card;
  }

  /** Draw the combat card the final phase gives (Preparations: along with its coins) */
  drawCombatCard(): boolean {
    if (!this.combatCardDue()) return false;

    this.drawCombat();
    return this.publish();
  }

  private mustDiscardCombatCard(): boolean {
    return !this.testMode && this.combatHand.length > MAX_COMBAT_HAND;
  }

  /** With one combat card too many after drawing, discard one (it may be the new one) */
  discardCombatCard(card: CombatCard): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.mustDiscardCombatCard()) return false;
    if (!this.combatHand.includes(card)) return false;

    this.combatHand = this.combatHand.filter((c) => c !== card);
    this.combatDeck.discard(card);
    return this.publish();
  }

  // --- END_OF_TURN

  // The battle is fought on the physical table and the retreats are made
  // after it; these then bring the app's board in line with the table. In
  // Órdenes, before any order, they fix a map that doesn't match the table.

  private canEditMap(): boolean {
    if (this.phase === TurnPhase.END_OF_TURN) return true;
    return (
      this.phase === TurnPhase.ORDER_UNITS && !this.ordersCommitted && this.orders.length === 0 && this.markers.length === 0
    );
  }

  /** Edits made in Órdenes can't be undone after the orders: the orders start from them */
  private canUndoMapEdit(): boolean {
    const edit = this.battleEdits.at(-1);
    return this.canEditMap() && !!edit && (this.phase === TurnPhase.ORDER_UNITS || !edit.beforeOrders);
  }

  private addBattleEdit(edit: BattleEdit) {
    const beforeOrders = this.phase === TurnPhase.ORDER_UNITS;
    this.battleEdits = [...this.battleEdits, beforeOrders ? { ...edit, beforeOrders } : edit];
  }

  /** Remove a unit destroyed on the table */
  removeUnit(position: Position): boolean {
    if (!this.canEditMap()) return false;
    const unit = this.board.removeUnitAt(position);
    if (!unit) return false;

    this.addBattleEdit({ kind: "remove", position, unit });
    return this.publish();
  }

  /** Move a unit to any empty hex, to mirror a retreat or taking ground */
  relocateUnit(from: Position, to: Position): boolean {
    if (!this.canEditMap() || samePosition(from, to)) return false;
    if (!this.board.getHex(to)?.isPassable()) return false;
    if (!this.board.moveUnit(from, to)) return false;

    this.addBattleEdit({ kind: "move", from, to });
    return this.publish();
  }

  /** Take off barbed wire removed at the table */
  removeWireAt(position: Position): boolean {
    if (!this.canEditMap()) return false;
    const hex = this.board.getHex(position);
    if (!hex?.wire) return false;

    hex.setWire(false);
    this.addBattleEdit({ kind: "wire", position: { ...position } });
    return this.publish();
  }

  undoBattleEdit(): boolean {
    if (!this.canUndoMapEdit()) return false;
    const edit = this.battleEdits.at(-1)!;

    if (edit.kind === "remove") {
      this.board.placeUnitAt(edit.position, edit.unit);
    } else if (edit.kind === "add") {
      this.board.removeUnitAt(edit.position);
    } else if (edit.kind === "wire") {
      this.board.getHex(edit.position)?.setWire(true);
    } else {
      this.board.moveUnit(edit.to, edit.from);
    }
    this.battleEdits = this.battleEdits.slice(0, -1);
    return this.publish();
  }

  // Reinforcements: in the final phase the app rolls the die, and the unit the
  // scenario's table gives for the face appears on the hex marked with the cross

  private reinforcementTable() {
    return this.orderCombatCard?.effect?.kind === "reinforcements" ? (this.scenario.reinforcements ?? null) : null;
  }

  private reinforcementDue(): boolean {
    return this.phase === TurnPhase.END_OF_TURN && !!this.reinforcementTable() && this.reinforcementFace === null;
  }

  private reinforcementRoll(): ReinforcementRoll | null {
    const table = this.reinforcementTable();
    if (!table || !this.reinforcementFace) return null;
    return { face: this.reinforcementFace, unitType: table[this.reinforcementFace] };
  }

  private reinforcementToPlace(): UnitType | null {
    if (this.phase !== TurnPhase.END_OF_TURN) return null;
    const unitType = this.reinforcementRoll()?.unitType ?? null;
    return unitType && !this.battleEdits.some((edit) => edit.kind === "add") ? unitType : null;
  }

  /** Roll the Reinforcements die; the unit it brings is put on the marked hex if that is still empty */
  rollReinforcements(): boolean {
    if (!this.reinforcementDue()) return false;

    this.reinforcementFace = rollDice(1, this.random)[0] as SixSidedFace;
    const marked = this.markers[0];
    if (marked) this.addReinforcement(marked);
    return this.publish();
  }

  /** Put the unit rolled on an empty hex, when its marked hex was taken (or the placing was undone) */
  placeReinforcement(position: Position): boolean {
    return this.addReinforcement(position) && this.publish();
  }

  private addReinforcement(position: Position): boolean {
    const unitType = this.reinforcementToPlace();
    const unit = unitType && this.placeNewUnit(position, unitType);
    if (!unit) return false;

    this.battleEdits = [...this.battleEdits, { kind: "add", position: { ...position }, unit }];
    return true;
  }

  /**
   * Discard the played card and draw a command card (once per turn). A single
   * card goes straight to the hand, and the player may swap it with
   * `drawAgain`; a card that draws more (Probe: 2) leaves them in
   * `drawOptions` and `keepCard` puts one in the hand.
   */
  drawCard(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.chosenCard) return false;
    if (this.drawnCard || this.drawOptions.length > 0) return false;

    // Discard first so a reshuffle on an empty deck can bring the card back,
    // so there is always a card to draw
    const playedCard = this.chosenCard;
    this.deck.discard(playedCard);
    this.hand = this.hand.filter((c) => c !== playedCard);
    const drawn = this.deck.draw(playedCard.drawChoice);
    if (drawn.length === 0) throw new Error("No command card to draw");
    // A single card is kept unless the player swaps it (drawAgain)
    if (playedCard.drawChoice === 1) this.keep(drawn[0]!);
    else this.drawOptions = drawn;
    // The scenario's extra card goes straight to the hand
    if (this.drawsExtra()) {
      const [extra] = this.deck.draw(1);
      if (extra) {
        this.hand = [...this.hand, extra];
        this.extraDrawn = extra;
      }
    }
    return this.publish();
  }

  /** This side's turns so far, counting this one: the defender's first turn is turn 2 */
  private ownTurn(): number {
    return this.attacking ? this.turn : this.turn - 1;
  }

  /** This turn's draw brings a second card (Pegasus Bridge: the Axis, after its first two turns) */
  private drawsExtra(): boolean {
    const rule = this.scenario.extraDraws;
    return !!rule && rule.faction === this.faction && this.ownTurn() <= rule.turns;
  }

  /** Keep one of the cards drawn; the others are discarded */
  keepCard(card: CommandCard): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.drawOptions.includes(card)) return false;

    this.drawOptions.filter((c) => c !== card).forEach((c) => this.deck.discard(c));
    this.keep(card);
    return this.publish();
  }

  /** The single card drawn can be swapped once (a save from before it was kept at once still has it in drawOptions) */
  private canDrawAgain(): boolean {
    if (this.chosenCard?.drawChoice !== 1 || this.drewAgain) return false;
    return this.drawOptions.length === 1 || this.drawnCard !== null;
  }

  /** Gamble: discard the card drawn and draw another, which must be kept */
  drawAgain(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.canDrawAgain()) return false;

    // Draw before discarding, so a reshuffle can't bring the same card back
    // (unless it's the only card left to draw)
    const first = this.drawnCard ?? this.drawOptions[0]!;
    const [next] = this.deck.draw(1);
    this.hand = this.hand.filter((c) => c !== first);
    this.deck.discard(first);
    this.keep(next ?? this.deck.draw(1)[0]!);
    this.drewAgain = true;
    return this.publish();
  }

  private keep(card: CommandCard) {
    this.hand = [...this.hand, card];
    this.drawnCard = card;
    this.drawOptions = [];
  }

  endTurn(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.chosenCard || !this.drawnCard) return false;
    if (this.needsRewardChoice() && !this.rewardChoice) return false;
    if (this.combatCardDue() || this.mustDiscardCombatCard()) return false;
    if (this.reinforcementDue() || this.reinforcementToPlace()) return false;

    const playedCard = this.chosenCard;
    const coins = this.coins();
    const record = recordTurn({
      turn: this.turn,
      card: playedCard,
      orders: this.orders,
      shots: this.shots,
      battleEdits: this.battleEdits,
      board: this.board,
      coins: this.turnCoinEntries(),
      coinsAfter: coins,
      reward: this.rewardChoice,
      combatCardsPlayed: [this.orderCombatCard, this.battleCombatCard].filter((card) => card !== null),
      combatCardDrawn: this.drawnCombatCard,
      markers: this.markers,
      cardAttacks: this.cardAttacks,
      ambush: this.ambush,
      reinforcement: this.reinforcementRoll(),
    });
    this.log = [...this.log, record];
    this.startCoins = this.testMode ? Math.max(coins, TEST_MODE_COINS) : coins;
    this.coinAdjustments = [];
    this.rewardChoice = null;
    const played = [this.orderCombatCard, this.battleCombatCard].filter((card) => card !== null);
    // Test mode: played cards come back to the hand so they can be tried again
    if (this.testMode) this.combatHand = [...this.combatHand, ...played];
    else played.forEach((card) => this.combatDeck.discard(card));
    this.orderCombatCard = null;
    this.markers = [];
    this.cardAttacks = [];
    this.battleCombatCard = null;
    this.ambush = null;
    this.drawnCombatCard = null;
    this.reinforcementFace = null;

    this.chosenCard = null;
    this.chosenSection = null;
    this.drawnCard = null;
    this.extraDrawn = null;
    this.drewAgain = false;
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
    return writeSave(this.scenario.id, this.faction, this.longRangeDie, this.testMode, this.board, {
      turn: this.turn,
      phase: this.phase,
      drawPile: this.deck.drawPile,
      discardPile: this.deck.discardPile,
      hand: this.hand,
      chosenCard: this.chosenCard,
      chosenSection: this.chosenSection,
      drawnCard: this.drawnCard,
      extraDrawn: this.extraDrawn,
      drawOptions: this.drawOptions,
      drewAgain: this.drewAgain,
      orders: this.orders,
      ordersCommitted: this.ordersCommitted,
      unmovedFireSkipped: this.unmovedFireSkipped,
      battleEdits: this.battleEdits,
      shots: this.shots,
      log: this.log,
      startCoins: this.startCoins,
      coinAdjustments: this.coinAdjustments,
      rewardChoice: this.rewardChoice,
      combatDrawPile: this.combatDeck.drawPile,
      combatDiscardPile: this.combatDeck.discardPile,
      combatHand: this.combatHand,
      orderCombatCard: this.orderCombatCard,
      markers: this.markers,
      cardAttacks: this.cardAttacks,
      battleCombatCard: this.battleCombatCard,
      ambush: this.ambush,
      drawnCombatCard: this.drawnCombatCard,
      drops: this.drops,
      reinforcementFace: this.reinforcementFace,
    });
  }

  /** Rebuild a saved game. Throws if the save doesn't fit this scenario or these cards. */
  static restore(
    saved: SavedGame,
    scenario: Scenario,
    commandCards: CommandCard[],
    combatCards: CombatCard[] = [],
    random?: () => number
  ): GameSession {
    if (saved.scenarioId !== scenario.id) throw new Error(`Save is for scenario ${saved.scenarioId}`);

    const session = new GameSession({
      scenario,
      faction: saved.faction,
      initialHandSize: 0,
      commandCards,
      combatCards,
      longRangeDie: saved.longRangeDie,
      testMode: saved.testMode,
      random,
    });
    const state: SessionState = readSave(saved, session.board, commandCards, combatCards);
    session.deck.restorePiles([...state.drawPile], [...state.discardPile]);
    session.turn = state.turn;
    session.phase = state.phase;
    session.hand = state.hand;
    session.chosenCard = state.chosenCard;
    session.chosenSection = state.chosenSection;
    session.drawnCard = state.drawnCard;
    session.extraDrawn = state.extraDrawn;
    session.drawOptions = state.drawOptions;
    session.drewAgain = state.drewAgain;
    session.orders = state.orders;
    session.ordersCommitted = state.ordersCommitted;
    session.unmovedFireSkipped = state.unmovedFireSkipped;
    session.battleEdits = state.battleEdits;
    session.shots = state.shots;
    session.log = state.log;
    session.startCoins = state.startCoins;
    session.coinAdjustments = state.coinAdjustments;
    session.rewardChoice = state.rewardChoice;
    session.combatDeck.restorePiles([...state.combatDrawPile], [...state.combatDiscardPile]);
    session.combatHand = state.combatHand;
    session.orderCombatCard = state.orderCombatCard;
    session.markers = state.markers;
    session.cardAttacks = state.cardAttacks;
    session.battleCombatCard = state.battleCombatCard;
    session.ambush = state.ambush;
    session.drawnCombatCard = state.drawnCombatCard;
    session.drops = state.drops;
    session.reinforcementFace = state.reinforcementFace;
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
      chosenCard: this.chosenCard,
      activeCard: this.activeCard(),
      chosenSection: this.chosenSection,
      drawnCard: this.drawnCard,
      extraDrawn: this.extraDrawn,
      drawsExtra: this.drawsExtra(),
      drawOptions: [...this.drawOptions],
      canDrawAgain: this.canDrawAgain(),
      drewAgain: this.drewAgain,
      orders: this.orders,
      ordersLeft: orderContext ? ordersLeft(orderContext) : 0,
      cardOrdersLeft: orderContext ? cardOrdersLeft(orderContext) : 0,
      orderable: orderContext ? orderablePositions(orderContext) : [],
      extraOrderable: orderContext && !this.extraTurn() ? extraOrderablePositions(orderContext) : [],
      closeAssaultMarkable: this.closeAssaultMarkable(),
      ordersCommitted: this.ordersCommitted,
      battleEdits: this.battleEdits.length,
      canEditMap: this.canEditMap(),
      canUndoMapEdit: this.canUndoMapEdit(),
      drawPileCount: this.deck.getDrawPileCount(),
      discardPileCount: this.deck.getDiscardPileCount(),
      shots: this.shots,
      unmovedFireSkipped: this.unmovedFireSkipped,
      log: this.log,
      extraTurn: this.extraTurn(),
      coins: this.coins(),
      coinEntries: this.turnCoinEntries(),
      canAdjustCoins: this.canAdjustCoins(),
      rewardChoice: this.rewardChoice,
      needsRewardChoice: this.needsRewardChoice(),
      combatHand: [...this.combatHand],
      combatDrawPileCount: this.combatDeck.getDrawPileCount(),
      canPlayCombatCards: !this.extraTurn() && this.phase !== TurnPhase.AWAIT_ATTACKER,
      orderCombatCard: this.orderCombatCard,
      markers: this.markers,
      markable: this.markableNow(),
      cardAttacks: this.cardAttacks,
      attacksPending: this.attacksPending(),
      battleCombatCard: this.battleCombatCard,
      ambushUnits: this.ambushUnits(),
      ambush: this.ambush,
      drawnCombatCard: this.drawnCombatCard,
      combatCardDue: this.combatCardDue(),
      mustDiscardCombatCard: this.mustDiscardCombatCard(),
      canRemoveWire: this.orders.map((_, i) => this.canRemoveWire(i)),
      drops: this.drops,
      dropsLeft: this.dropsLeft(),
      canUnpickCard: this.canUnpickCard(),
      reinforcement: this.reinforcementRoll(),
      reinforcementDue: this.reinforcementDue(),
      reinforcementToPlace: this.reinforcementToPlace(),
    };
  }

  private publish(): true {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default GameSession;
