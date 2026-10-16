// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import CommandCard, { Section, isSection } from "./commandCard";
import Deck from "./deck";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { ShotTarget, TargetKinds, enemyTargetKinds } from "../data/hitRules";
import { ATTACK_DIE_SIDES, DieFace, SIDES_OF, rollDice } from "./dice";
import { appliedFaces, isKeptList, readRoll } from "./rollResult";
import { CombatBonus, DiceStep, FireAnswers, FireContext, calculateFireDice, nextFireQuestion, setFaces } from "./fireRules";
import { FireTarget, fireTargets, mapAnswers } from "./fireTargets";
import {
  COLLISION_NOTES,
  FIRE_QUESTIONS,
  collisionSteps,
  TAKE_GROUND_UNIT_TYPES,
  PUSH_BACK_UNIT_TYPES,
  TARGET_INFANTRY,
  TARGET_OTHER,
  combatBonusDice,
  fireBonusSteps,
  targetAnswer,
  wireChoiceFor,
  WIRE_CLEARING_UNIT_TYPES,
} from "../data/fireQuestions";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { HexType, Side } from "../types/hex";
import { Faction } from "../types/faction";
import { fromKey, includesPosition, positionKey, samePosition } from "./position";
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
import { ARTILLERY_CREW_FIGURES, FIGURES, figureDamaged, figuresLeft, hitsToDestroy } from "../data/figures";
import { CombatCard, CombatEffect, MarkerRule, MoveEffect, templateOf } from "./combatCard";
import { MAX_COMBAT_CARDS_PER_TURN, MAX_COMBAT_HAND, STARTING_COMBAT_CARDS } from "../data/combatCards";
import { canMark, firstConflictingMark, markablePositions } from "./markerRules";
import { SavedGame, SessionState, readSave, writeSave } from "./saveGame";
import { combatDeckFor } from "../data/combatCards";
import { TurnRecord, recordTurn } from "./turnLog";
import { summarizeOrders } from "./turnSummary";
import type { Localized } from "../i18n/lang";

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
  /** The combat cards played with the command card this turn, in order (two at most, never two copies of one) */
  combatCardsPlayed: readonly CombatCard[];
  /** Hexes marked on the map for the combat cards played (Barrage, Air Power…), each card's in turn, in the order marked */
  markers: readonly Position[];
  /** What each marked hex is for: a target or a cross */
  markerKinds: readonly MarkerRule["kind"][];
  /** The card whose hexes are marked next, its rule and how many are marked; null once all are */
  marking: { card: CombatCard; rule: MarkerRule; marked: number } | null;
  /** Hexes that can be marked next (empty outside giving orders, or when all are marked) */
  markable: readonly Position[];
  /** The marked hexes an attack card rolls on, with the card (Barrage, Air Power…) */
  attackMarks: readonly AttackMark[];
  /** The attack combat cards' rolls, one per marked hex (Barrage, Air Power…) */
  cardAttacks: readonly CardAttack[];
  /** An attack combat card still has hexes to roll: no unit fires until they're done */
  attacksPending: boolean;
  /** The cards played that were given to one of this side's units, and where the unit stands */
  assignments: readonly { card: CombatCard; unitType: UnitType; position: Position | null }[];
  /** The next card to give to a unit, and the units it can go to now; null when none is waiting */
  assigning: { card: CombatCard; positions: readonly Position[] } | null;
  /** Pass and play: collision rolls of units without an order */
  standingCollisions: readonly StandingCollisionRoll[];
  /** Pass and play: each unit's figures left and the flags it must retreat, by hex (none in the one-side game) */
  strength: readonly UnitStrength[];
  /** The combat card drawn in the final phase */
  drawnCombatCard: CombatCard | null;
  /** The final phase still owes a combat card: drawing it is the next step */
  combatCardDue: boolean;
  /** The hand has more combat cards than allowed: one must be discarded before the next turn */
  mustDiscardCombatCard: boolean;
  /** The unit of each order fires from a hex with barbed wire and may remove it instead (infantry), by order index */
  canRemoveWire: readonly boolean[];
  /** The unit of each order may fortify instead of firing now (Fortify: sandbags on its hex), by order index */
  canFortify: readonly boolean[];
  /** This side's units with the camouflage badge: only a close assault can hit them */
  camouflaged: readonly Position[];
  /** Pass and play, final phase: the artillery given Reposition and the hexes it can move to, until it has moved */
  repositioning: { from: Position; options: readonly Position[] } | null;
  /** Paratroopers placed so far, in order (PARADROP) */
  drops: readonly Position[];
  /** Paratroopers that can still be placed (PARADROP) */
  dropsLeft: number;
  /** Giving orders with none given yet: the card can be taken back (`unpickCard`) */
  canUnpickCard: boolean;
  /** The Reinforcements card's unit isn't on the map yet: the player taps an empty hex for it (its marked hex was taken) */
  reinforcementToPlace: UnitType | null;
}

/** Pass and play: an enemy unit as this side sees it, from the match (`setEnemyView`) */
export interface EnemyUnit {
  /** In this side's view of the board */
  position: Position;
  unitType: UnitType;
  sandbags: boolean;
  /** It has the camouflage badge: only a close assault can hit it */
  camouflaged: boolean;
}

/** Pass and play: a shot aimed at an enemy unit, before it's rolled (`GameSession.aimAt`) */
export interface ShotAim {
  position: Position;
  distance: number;
  terrain: HexType;
  enemy: EnemyUnit;
  dice: number;
  steps: DiceStep[];
  /** It throws the 8-sided long-range die */
  eightSided: boolean;
}

/** Pass and play: how a unit stands */
export interface UnitStrength {
  position: Position;
  figures: number;
  /** Flags to retreat after the battle; it can't battle any more this turn */
  retreats: number;
  /** A figure took a hit but not all it takes (armour hit once): the next hit removes it */
  damaged: boolean;
  /** Hits it took this turn, shown on the map until the turn ends */
  hitThisTurn: number;
}

/** A roll at an enemy unit: how the dice were worked out, the faces and what was applied */
export interface ShotRoll {
  /** How the dice were worked out (a collision's steps; empty only in shots saved from before the quick roll was removed) */
  steps: readonly DiceStep[];
  dice: number;
  faces: readonly DieFace[];
  /** Reminders for resolving the hits (e.g. sandbags ignore 1 flag) */
  notes: readonly Localized[];
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

/** What the player says about the hex fired at (pass and play knows it from the enemy unit there) */
export interface FireChoice {
  position: Position;
  infantry: boolean;
  sandbags: boolean;
  /** The target has the camouflage badge: only a close assault can hit it */
  camouflaged?: boolean;
}

/** A unit's shot this turn. Once rolled it stands; only a deliberate undo removes it. */
export interface Shot extends ShotRoll {
  /** Index of the firing unit's order in this turn's orders */
  orderIndex: number;
  /** After this close assault the unit took ground (the target retreated or was eliminated) and gets one more shot */
  tookGround?: boolean;
  /** Pass and play: infantry took ground by pushing back the unit its close assault made retreat; no more shot */
  pushedBack?: boolean;
  /** Instead of firing, the unit removed the barbed wire on this hex (no dice) */
  removedWire?: Position;
  /** Instead of firing, the unit fortified: sandbags on this hex (the Fortify card, no dice) */
  fortified?: Position;
}

/**
 * Pass and play: a collision roll of one of this side's units that had no order (an ordered
 * unit's roll is one of its shots)
 */
export interface StandingCollisionRoll extends ShotRoll {
  /** Where the unit stands */
  from: Position;
  unitType: UnitType;
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
export const CARD_ATTACK_NOTE: Localized = {
  es: "Las retiradas no se pueden ignorar.",
  en: "Retreats can't be ignored.",
};

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
  /** It can use a combat card's movement (Motorized…) */
  canBoost: boolean;
  /** The combat cards whose movement it can use */
  boosts: readonly CombatCard[];
}

/** A combat card played this turn given to one of this side's units (Explosives, Personal Armor…) */
export interface Assignment {
  card: CombatCard;
  unit: Unit;
}

/** A hex marked for an attack combat card, which rolls there before anyone fires */
export interface AttackMark {
  /** Its index in the turn's markers */
  marker: number;
  position: Position;
  card: CombatCard;
  dicePerHex: number;
}

const asList = <T,>(value: T | readonly T[]): readonly T[] => (Array.isArray(value) ? (value as readonly T[]) : [value as T]);

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
  /** Experimental rule: a destroyed artillery unit leaves its crew behind as an infantry unit */
  artilleryCrew?: boolean;
  /**
   * Pass and play: units have figures and take the hits the app applies (`sufferHits`); a flag
   * marks the unit to retreat after the battle, and it can't battle any more this turn
   */
  figures?: boolean;
  /** Random source for the dice, [0, 1) like Math.random; tests pass a fixed one */
  random?: () => number;
}

/**
 * A change made to match the physical table: in END_OF_TURN after the battle,
 * or in ORDER_UNITS before any order (`beforeOrders`), when the map turns out
 * not to match the table (a roll changed at the table, a missed retreat)
 */
export type BattleEdit = (
  /**
   * `replacement`: the infantry an artillery's crew leaves behind (the `artilleryCrew` rule);
   * `sandbags`: the unit's sandbags went with it (a crew left behind keeps them)
   */
  | { kind: "remove"; position: Position; unit: Unit; replacement?: Unit; sandbags?: boolean }
  /**
   * `unit`: the unit moved, kept so the turn log names it (orders after a fix in Órdenes move units too);
   * `sandbags`: hexes whose sandbags went with the move (the unit left them); `clearedWire`: a tank removed the wire on `to`
   */
  | { kind: "move"; from: Position; to: Position; unit: Unit; sandbags?: Position[]; clearedWire?: boolean; reposition?: boolean }
  /** A unit that arrived: the Reinforcements card */
  | { kind: "add"; position: Position; unit: Unit }
  /** Barbed wire removed at the table (by the other side, or missed here) */
  | { kind: "wire"; position: Position }
  /** Sandbags taken away to fix the map (`fortify`: put on for Fortify, in older turns) */
  | { kind: "sandbags"; position: Position; placed: boolean; fortify?: boolean }
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
  /** What the enemy starts with (from the scenario), so a shot only asks whether its target is infantry when it has both */
  readonly targetKinds: TargetKinds;
  /** The enemy's combat deck has Camouflage: a shot at range asks whether the target is camouflaged */
  readonly enemyCamouflage: boolean;
  /** Test mode: every combat card in hand, played cards come back, plenty of coins */
  readonly testMode: boolean;
  /** Experimental rule: artillery destroyed in the battle turns into an infantry unit */
  readonly artilleryCrew: boolean;
  /** Pass and play: units have figures and take hits */
  readonly figures: boolean;
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
  private combatCardsPlayed: CombatCard[] = [];
  private markers: Position[] = [];
  private cardAttacks: CardAttack[] = [];
  private assignments: Assignment[] = [];
  private standingCollisions: StandingCollisionRoll[] = [];
  /** Pass and play: hits each unit has taken (kept from turn to turn) */
  private hits = new Map<Unit, number>();
  /** Pass and play: flags each unit must retreat after this turn's battle */
  private retreatFlags = new Map<Unit, number>();
  /** Pass and play: hits each unit has taken this turn, shown on the map until the turn ends */
  private turnHits = new Map<Unit, number>();
  /** Pass and play: the infantry-symbol hits each unit has ignored this turn with Personal Armor */
  private armorHits = new Map<Unit, number>();
  /** Units with the camouflage badge, kept from turn to turn until they move or battle (`camouflagedUnits`) */
  private camouflaged = new Set<Unit>();
  /** Pass and play: where the enemy units are, from the match; null in the one-side game */
  private enemyView: (() => readonly EnemyUnit[]) | null = null;
  private drawnCombatCard: CombatCard | null = null;
  private drops: Position[] = [];
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
    artilleryCrew = false,
    figures = false,
    random = () => Math.random(),
  }: GameSessionOptions) {
    this.figures = figures;
    this.scenario = scenario;
    this.longRangeDie = longRangeDie;
    this.testMode = testMode;
    this.artilleryCrew = artilleryCrew;
    this.random = random;
    this.faction = faction;
    this.attacking = scenario.attacker === faction;
    this.targetKinds = enemyTargetKinds(scenario, faction);
    this.enemyCamouflage = combatDeckFor(scenario, faction === "Allies" ? "Axis" : "Allies").some(
      (card) => card.effect?.kind === "camouflage"
    );
    this.phase = this.paradrop() ? TurnPhase.PARADROP : this.firstPhase();
    this.board = new BoardManager(scenario, faction);
    this.commandCards = commandCards;
    // Cards kept out of the deck (Armor Assault) come only from another card's reward
    this.deck = new Deck(commandCards.filter((card) => !card.reserve));
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
  cardNeedsSection(card: CommandCard, combatCards: CombatCard | readonly CombatCard[] = []): boolean {
    const tactician = asList(combatCards).find((combatCard) => combatCard.effect?.kind === "changeSection");
    if (tactician) return this.combatCardFits(card, tactician);
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
   * These combat cards can be played together this turn: at most
   * `MAX_COMBAT_CARDS_PER_TURN`, from the hand, never two copies of one card,
   * and the coins to pay for all of them (none in the attacker's extra turn)
   */
  canPlayTogether(combatCards: readonly CombatCard[]): boolean {
    if (combatCards.length === 0) return true;
    if (this.extraTurn() || combatCards.length > MAX_COMBAT_CARDS_PER_TURN) return false;
    if (combatCards.some((card, i) => !this.combatHand.includes(card) || combatCards.indexOf(card) !== i)) return false;
    if (new Set(combatCards.map(templateOf)).size < combatCards.length) return false;
    return combatCards.reduce((sum, card) => sum + card.cost, 0) <= this.coins();
  }

  /**
   * Play a card from the hand; see `cardNeedsSection` for when it takes a
   * section. Up to two combat cards from the hand can be played with it
   * (`canPlayTogether`), paid now.
   */
  pickCard(card: CommandCard, section?: Section, combatCards: CombatCard | readonly CombatCard[] = []): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (!this.hand.includes(card)) return false;
    const played = asList(combatCards);
    if (!this.canPlayTogether(played)) return false;
    if (played.some((combatCard) => !this.combatCardFits(card, combatCard))) return false;
    if (this.cardNeedsSection(card, played) ? !isSection(section) : section !== undefined) return false;

    this.combatHand = this.combatHand.filter((c) => !played.includes(c));
    this.combatCardsPlayed = [...played];
    this.chosenCard = card;
    this.chosenSection = section ?? null;
    this.phase = TurnPhase.ORDER_UNITS;
    return this.publish();
  }

  /** The card picked can still be taken back: giving orders, none given yet */
  private canUnpickCard(): boolean {
    return this.phase === TurnPhase.ORDER_UNITS && this.orders.length === 0;
  }

  /**
   * Go back to choosing a card, before any order is given. The combat cards
   * played with it go back to the hand, and their coins come back.
   */
  unpickCard(): boolean {
    if (!this.canUnpickCard()) return false;

    this.combatHand = [...this.combatHand, ...this.combatCardsPlayed];
    this.combatCardsPlayed = [];
    this.markers = [];
    this.assignments = [];
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
    if (this.phase !== TurnPhase.ORDER_UNITS || !card) return null;
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
  getMoveOptions(position: Position, slot?: OrderSlot, boost: boolean | string = false): MoveOptions | null {
    const context = this.orderContext();
    const hex = this.board.getHex(position);
    const unit = hex?.unit;
    if (!context || !hex || !unit) return null;
    const slots = this.slotsFor(context, unit, hex.getSide(), slot);
    const moveSlot = slot ? this.slotFor(slots, slot) : (slots.find((s) => !s.onTheMove) ?? slots[0]);
    if (!moveSlot) return null;
    const boosts = this.boostsFor(hex, moveSlot);
    const used = this.boostFor(hex, moveSlot, boost);
    if (boost !== false && !used) return null;

    const plan = this.movePlan(hex, moveLimits(context.card, unit, moveSlot), used?.effect ?? null);
    return {
      moves: [...plan.paths(plan.limits.maxMove).keys()].map(fromKey),
      moveAndFire: [...plan.paths(plan.limits.moveAndFire, true).keys()].map(fromKey),
      limits: plan.limits,
      slots,
      canBoost: boosts.length > 0,
      boosts: boosts.map(({ card }) => card),
    };
  }

  // Combat cards that change how some ordered units move (Motorized, Armor Forward, Rattenkrieg…)

  private moveCards(): { card: CombatCard; effect: MoveEffect }[] {
    return this.combatCardsPlayed.flatMap((card) => (card.effect?.kind === "move" ? [{ card, effect: card.effect }] : []));
  }

  /** The move cards the unit on this hex, in this order slot, can still use */
  private boostsFor(hex: Hex, slot: OrderSlot): { card: CombatCard; effect: MoveEffect }[] {
    const unit = hex.unit;
    if (!unit) return [];
    return this.moveCards().filter(({ card, effect }) => {
      if (effect.units - this.orders.filter((order) => order.boostCard === card.id).length <= 0) return false;
      if (effect.notOnTheMove && slot.onTheMove) return false;
      if (effect.unitTypes && !effect.unitTypes.includes(unit.getUnitType())) return false;
      return !effect.startNear || this.isNear(hex.getPosition(), effect.startNear);
    });
  }

  /** The move card a unit uses: the one with this id, or with `true` the first one it can use */
  private boostFor(hex: Hex, slot: OrderSlot, boost: boolean | string): { card: CombatCard; effect: MoveEffect } | null {
    if (boost === false) return null;
    const boosts = this.boostsFor(hex, slot);
    return (boost === true ? boosts[0] : boosts.find(({ card }) => card.id === boost)) ?? null;
  }

  /** The hex, or one next to it, is one of these terrains */
  private isNear(position: Position, terrains: readonly HexType[]): boolean {
    const hex = this.board.getHex(position);
    if (!hex) return false;
    return [position, ...hex.getNeighbors()].some((p) => terrains.includes(this.board.getHex(p)?.getType() as HexType));
  }

  /** The unit's move limits and paths, with a combat card's movement */
  private movePlan(hex: Hex, limits: MoveLimits, effect: MoveEffect | null) {
    const rules = effect ? { ignoreTerrain: effect.ignoreTerrain, fireInto: effect.fireInto } : {};
    const endsOk = (key: string) =>
      (!effect?.endOn || effect.endOn.includes(this.board.getHex(fromKey(key))!.getType())) && !this.breaksMark(fromKey(key));
    return {
      limits: effect ? boostedLimits(limits, effect) : limits,
      paths: (range: number, forFire = false) =>
        new Map([...this.board.getAllPaths(hex, range, forFire, rules)].filter(([key]) => endsOk(key))),
    };
  }

  /**
   * Order the unit at `from` to move to `to`, or to hold when `to` equals `from`.
   * `slot` is needed when the unit can fill more than one section's orders.
   * `boost` uses a combat card's movement (its id, or `true` for the first one
   * the unit can use); a unit that holds doesn't move, so it doesn't use it up.
   */
  issueOrder(from: Position, to: Position, slot?: OrderSlot, boostMove: boolean | string = false): boolean {
    const boost = samePosition(from, to) ? false : boostMove;
    const context = this.orderContext();
    const hex = this.board.getHex(from);
    const unit = hex?.unit;
    if (!context || !hex || !unit) return false;
    const chosen = this.slotFor(this.slotsFor(context, unit, hex.getSide(), slot), slot);
    if (!chosen) return false;
    const used = this.boostFor(hex, chosen, boost);
    if (boost !== false && !used) return false;
    const plan = this.movePlan(hex, moveLimits(context.card, unit, chosen), used?.effect ?? null);
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
      boostCard: used?.card.id ?? null,
    };
    if (samePosition(from, to)) {
      order = new Order({ ...props, path: [from], shots: limits.holdShots });
    } else {
      // Paths must be found before moving: afterwards the start hex is empty and the destination taken
      const path = plan.paths(limits.maxMove).get(positionKey(to));
      const canFire = plan.paths(limits.moveAndFire, true).has(positionKey(to));
      if (!path) return false;
      const lostSandbags = this.moveUnit(from, to);
      if (!lostSandbags) return false;
      const clearedWire = this.clearWire(unit, to);
      order = new Order({ ...props, path, shots: canFire ? 1 : 0, lostSandbags, clearedWire });
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
    if (this.phase !== TurnPhase.ORDER_UNITS) return false;
    const lastOrder = this.orders.at(-1);
    if (!lastOrder) return false;

    if (!samePosition(lastOrder.start, lastOrder.end)) {
      this.board.moveUnit(lastOrder.end, lastOrder.start);
      this.restoreSandbags(lastOrder.lostSandbags);
      if (lastOrder.clearedWire) this.board.getHex(lastOrder.end)?.setWire(true);
      // Back on (or next to) a hex marked meanwhile: those marks, and the ones after them, are erased
      for (const span of this.markerSpans()) {
        const broken = firstConflictingMark(span.rule, this.board, this.marksOf(span), lastOrder.start);
        if (broken !== -1) {
          this.markers = this.markers.slice(0, span.start + broken);
          break;
        }
      }
    }
    this.orders = this.orders.slice(0, -1);
    // A card given to an ordered unit goes back when the unit's order is undone
    this.assignments = this.assignments.filter(
      ({ card, unit }) => !card.assign?.ordered || this.orders.some((order) => order.unit === unit)
    );
    return this.publish();
  }

  // --- MOVEMENT: the orders are shown to the opponent and carried out on the table

  /** Confirm the orders and move on to the movement phase; from here on they can't change */
  commitOrders(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS) return false;
    if (this.remainingOrders() > 0) return false;
    if (this.markersLeft() > 0) return false;
    if (this.assignmentDue()) return false;

    this.phase = TurnPhase.MOVEMENT;
    return this.publish();
  }

  // --- Pass and play: figures, hits and retreats

  /** Figures left of the unit on this hex; null without one, or in the one-side game */
  figuresAt(position: Position): number | null {
    const unit = this.board.getHex(position)?.unit;
    if (!this.figures || !unit) return null;
    return figuresLeft(unit.getUnitType(), this.hits.get(unit) ?? 0);
  }

  /** The unit on this hex must retreat after the battle, so it can't battle any more this turn */
  isRetreating(position: Position): boolean {
    const unit = this.board.getHex(position)?.unit;
    return !!unit && (this.retreatFlags.get(unit) ?? 0) > 0;
  }

  /**
   * The enemy's roll hit the unit on this hex (pass and play): it takes `hits` (`hitFaces`, the
   * faces that hit, say which Personal Armor ignores) and, if it survives, is marked to retreat
   * `flags` hexes after the battle (none for Not One Step Back's infantry). A unit that loses its last
   * figure is removed; artillery leaves its crew behind, `ARTILLERY_CREW_FIGURES` infantry figures
   */
  sufferHits(position: Position, hits: number, flags: number, hitFaces: readonly DieFace[] = []): boolean {
    const unit = this.board.getHex(position)?.unit;
    if (!this.figures || !unit || hits < 0 || flags < 0) return false;
    // Not One Step Back: this side's infantry ignores every flag this turn
    if (this.playedEffect("ignoreFlags")?.unitTypes.includes(unit.getUnitType())) flags = 0;
    // Personal Armor: the unit it was given to ignores its first hits of one symbol this turn
    const armor = this.assignments.find((a) => a.unit === unit && a.card.effect?.kind === "ignoreHits")?.card.effect;
    if (armor?.kind === "ignoreHits") {
      const used = this.armorHits.get(unit) ?? 0;
      const ignored = Math.min(hits, armor.hits - used, hitFaces.filter((face) => face === armor.face).length);
      if (ignored > 0) {
        hits -= ignored;
        this.armorHits = new Map(this.armorHits).set(unit, used + ignored);
      }
    }
    const taken = (this.hits.get(unit) ?? 0) + hits;
    if (taken < hitsToDestroy(unit.getUnitType())) {
      if (hits > 0) {
        this.hits = new Map(this.hits).set(unit, taken);
        this.turnHits = new Map(this.turnHits).set(unit, (this.turnHits.get(unit) ?? 0) + hits);
      }
      if (flags > 0) this.retreatFlags = new Map(this.retreatFlags).set(unit, (this.retreatFlags.get(unit) ?? 0) + flags);
      return this.publish();
    }

    this.board.removeUnitAt(position);
    const damage = new Map(this.hits);
    damage.delete(unit);
    const flagged = new Map(this.retreatFlags);
    flagged.delete(unit);
    const crew = unit.getUnitType() === UnitType.ARTILLERY ? new Unit(UnitType.INFANTRY) : undefined;
    if (crew) {
      this.board.placeUnitAt(position, crew);
      damage.set(crew, hitsToDestroy(UnitType.INFANTRY) - ARTILLERY_CREW_FIGURES);
    }
    this.hits = damage;
    this.retreatFlags = flagged;
    const hitThisTurn = new Map(this.turnHits);
    hitThisTurn.delete(unit);
    this.turnHits = hitThisTurn;
    // The sandbags go with the unit; a crew left behind stays behind them
    const hex = this.board.getHex(position)!;
    const sandbags = hex.sandbags && !crew;
    if (sandbags) hex.setSandbags(false);
    this.addBattleEdit({ kind: "remove", position, unit, ...(crew && { replacement: crew }), ...(sandbags && { sandbags }) });
    return this.publish();
  }

  /**
   * Pass and play: where the unit on this hex can retreat one hex, toward its own edge (the
   * bottom of this side's view): the two hexes behind it that are free and passable
   */
  retreatOptions(position: Position): Position[] {
    if (!this.isRetreating(position)) return [];
    const enemies = new Set((this.enemyView?.() ?? []).map((enemy) => positionKey(enemy.position)));
    return this.board
      .getHex(position)!
      .getNeighbors()
      .filter((next) => next.row === position.row + 1)
      .filter((next) => !!this.board.getHex(next)?.isPassable() && !enemies.has(positionKey(next)));
  }

  /** Pass and play: the unit retreats one hex, one of `retreatOptions`; it has a flag less to go */
  retreatTo(position: Position, to: Position): boolean {
    if (!includesPosition(this.retreatOptions(position), to)) return false;
    const unit = this.board.getHex(position)!.unit!;
    const sandbags = this.moveUnit(position, to);
    if (!sandbags) return false;
    this.retreatFlags = this.countDown(this.retreatFlags, unit);
    this.addBattleEdit({ kind: "move", from: { ...position }, to: { ...to }, unit, ...(sandbags.length > 0 && { sandbags }) });
    return this.publish();
  }

  /** Pass and play: the unit can't retreat this hex (nowhere free behind it): it takes a hit instead */
  retreatBlocked(position: Position): boolean {
    if (!this.isRetreating(position) || this.retreatOptions(position).length > 0) return false;
    const unit = this.board.getHex(position)!.unit!;
    this.retreatFlags = this.countDown(this.retreatFlags, unit);
    // One hit per hex it can't retreat: a figure of infantry, half an armour figure
    return this.sufferHits(position, 1, 0);
  }

  private countDown(flags: ReadonlyMap<Unit, number>, unit: Unit): Map<Unit, number> {
    const next = new Map(flags);
    const left = (next.get(unit) ?? 0) - 1;
    if (left > 0) next.set(unit, left);
    else next.delete(unit);
    return next;
  }

  private strength(): UnitStrength[] {
    if (!this.figures) return [];
    return this.board.getAllHexes().flatMap((hex) => {
      const unit = hex.unit;
      if (!unit) return [];
      const hits = this.hits.get(unit) ?? 0;
      const figures = figuresLeft(unit.getUnitType(), hits);
      const damaged = figureDamaged(unit.getUnitType(), hits);
      const hitThisTurn = this.turnHits.get(unit) ?? 0;
      return [{ position: hex.getPosition(), figures, retreats: this.retreatFlags.get(unit) ?? 0, damaged, hitThisTurn }];
    });
  }

  // --- Pass and play: the app carries out both sides' moves at once (PassAndPlayMatch)

  /**
   * Cut orders short where their units stopped: a collision, or one of their own units in the
   * way. Each stop is a hex of the order's path before its end. Only in the movement phase
   */
  haltOrders(stops: readonly { order: number; at: Position }[]): boolean {
    if (this.phase !== TurnPhase.MOVEMENT) return false;
    if (new Set(stops.map((stop) => stop.order)).size !== stops.length) return false;
    const halts = stops.map(({ order, at }) => ({ index: order, order: this.orders[order], at }));
    const onTheWay = (order: Order | undefined, at: Position) =>
      !!order && (order.path ?? []).slice(0, -1).some((hex) => samePosition(hex, at));
    if (!halts.every(({ order, at }) => onTheWay(order, at))) return false;

    // Lift every unit first: one may stop where another's move ended
    halts.forEach(({ order }) => this.board.removeUnitAt(order!.end));
    const orders = [...this.orders];
    for (const { index, order, at } of halts) {
      const halted = order!;
      this.board.getHex(at)!.placeUnit(halted.unit);
      // A tank that didn't get there didn't clear the wire; a unit still home keeps its sandbags
      if (halted.clearedWire) this.board.getHex(halted.end)?.setWire(true);
      const home = samePosition(at, halted.start);
      if (home) this.restoreSandbags(halted.lostSandbags);
      const reached = halted.path!.findIndex((hex) => samePosition(hex, at));
      orders[index] = new Order({
        ...halted,
        end: { ...at },
        path: halted.path!.slice(0, reached + 1),
        clearedWire: false,
        lostSandbags: home ? [] : halted.lostSandbags,
      });
    }
    this.orders = orders;
    return this.publish();
  }

  /**
   * Whether this side's unit can battle in a collision: not when its order doesn't let it fire
   * (it moved too far, or into terrain it can't fire from), nor once it's marked to retreat
   */
  canRollCollision(position: Position, order: number | null): boolean {
    if (order !== null && !this.orders[order]?.canFire) return false;
    return !this.isRetreating(position);
  }

  /**
   * Pass and play: this side's unit at `position` rolls in a collision against an enemy unit
   * that is or isn't infantry: its close assault dice minus 1, terrain ignored. `order` is its
   * order's index (the roll is then its shot this turn), or null for a unit without an order,
   * which can also be hit while its side waits out the attacker's extra turn
   */
  rollCollision(position: Position, infantry: boolean, order: number | null): boolean {
    const waiting = this.phase === TurnPhase.AWAIT_ATTACKER && order === null;
    if (this.phase !== TurnPhase.MOVEMENT && !waiting) return false;
    const unit = this.board.getHex(position)?.unit;
    if (!unit) return false;
    const ordered = order === null ? null : this.orders[order];
    if (ordered === undefined || (ordered && ordered.unit !== unit)) return false;
    if (!ordered && this.orders.some((o) => o.unit === unit)) return false;
    if (!this.canRollCollision(position, order)) return false;

    const context: FireContext = {
      unitType: unit.getUnitType(),
      card: ordered ? this.cardFor(ordered) : null,
      combatBonuses: ordered ? this.combatBonusesFor(order!) : [],
    };
    const steps = collisionSteps(context);
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    const target: ShotTarget = { infantry, closeAssault: true, die: "battle" };
    if (ordered) {
      return this.recordShot(order!, dice, steps, [...COLLISION_NOTES], target, true, combatBonusDice(context, true) > 0);
    }

    const roll: StandingCollisionRoll = {
      from: { ...position },
      unitType: unit.getUnitType(),
      steps,
      dice,
      faces: this.rollFaces(dice, steps, target),
      notes: [...COLLISION_NOTES],
      collision: true,
      target,
      combatBonus: false,
      kept: null,
    };
    this.standingCollisions = [...this.standingCollisions, roll];
    return this.publish();
  }

  // --- BATTLE

  startBattle(): boolean {
    if (this.phase !== TurnPhase.MOVEMENT) return false;

    this.phase = TurnPhase.BATTLE;
    return this.publish();
  }

  /**
   * Move on to the final phase; units that haven't fired lose their shot. The
   * command card is drawn straight away (see `drawCard`), and the Reinforcements
   * card's unit arrives on its cross if the hex is still empty.
   */
  endBattle(): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;

    this.phase = TurnPhase.END_OF_TURN;
    if (this.chosenCard) this.draw();
    const crossSpan = this.markerSpans().find((span) => span.card.effect?.kind === "reinforcements");
    const cross = this.reinforcementUnit() && crossSpan && this.markers[crossSpan.start];
    if (cross) this.addReinforcement(cross);
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
    return summarizeOrders(
      this.orders,
      this.board,
      this.shots,
      this.unmovedFireSkipped,
      this.combatCardsPlayed,
      new Set(this.retreatFlags.keys())
    );
  }

  /** No unit of the first group (the units that didn't move) has a shot left, or the player skipped them */
  private unmovedFireDone(): boolean {
    return this.summaries().every((summary) => !summary.unmovedGroup || summary.shotsLeft === 0);
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

  /**
   * The extra dice the combat cards played give this order's unit on a shot from where it stands
   * now: all of a kind (Spotter), or the unit a card was given to (Explosives, Street Equipment)
   */
  combatBonusesFor(orderIndex: number): CombatBonus[] {
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    if (!order || !summary) return [];
    const unitType = order.unit.getUnitType();
    return this.combatCardsPlayed.flatMap((card) => {
      const effect = card.effect;
      if (effect?.kind !== "diceBonus" || !effect.unitTypes.includes(unitType)) return [];
      if (card.assign && !this.assignments.some((a) => a.card === card && a.unit === order.unit)) return [];
      if (effect.near && !this.isNear(summary.firingFrom, effect.near)) return [];
      return [
        {
          name: card.name,
          dice: effect.dice,
          ...(effect.closeAssault !== undefined && { closeAssault: effect.closeAssault }),
          ...(effect.face && { face: effect.face }),
        },
      ];
    });
  }

  // Attack combat cards: one roll per marked hex, before any other shot

  /** The marked hexes the attack cards played roll on, each with its card */
  private attackMarks(): AttackMark[] {
    return this.markerSpans().flatMap((span) => {
      const effect = span.card.effect;
      if (effect?.kind !== "attack") return [];
      return this.marksOf(span).map((position, i) => ({
        marker: span.start + i,
        position,
        card: span.card,
        dicePerHex: effect.dicePerHex,
      }));
    });
  }

  private attacksPending(): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    return this.attackMarks().some((mark) => !this.cardAttacks.some((attack) => attack.marker === mark.marker));
  }

  /**
   * Roll the attack combat card on a marked hex, on the attack die: `infantry`
   * says whether the enemy unit on it is infantry, or null when the hex was
   * empty (nothing to roll).
   */
  attackHex(marker: number, infantry: boolean | null): boolean {
    const mark = this.attackMarks().find((m) => m.marker === marker);
    if (this.phase !== TurnPhase.BATTLE || !mark) return false;
    if (this.cardAttacks.some((attack) => attack.marker === marker)) return false;
    if (infantry !== null && !this.canBeTarget(infantry)) return false;

    const attack: CardAttack =
      infantry === null
        ? { marker, target: null, dice: 0, faces: [] }
        : {
            marker,
            target: { infantry, closeAssault: false, die: "attack" },
            dice: mark.dicePerHex,
            faces: rollDice(mark.dicePerHex, this.random, ATTACK_DIE_SIDES),
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
      combatBonuses: this.combatBonusesFor(orderIndex),
      fromTerrain: this.board.getHex(summary.firingFrom)?.getType(),
      fromWire: this.board.getHex(summary.firingFrom)?.wire ?? false,
      // Pass and play knows each enemy unit's badge, so it's always answered
      enemyCamouflage: this.enemyView !== null || this.enemyCamouflage,
    };
  }

  /**
   * The hexes this unit can fire at from where it stands (or the hex it took
   * ground on): in range, and whether each is in sight and how many dice it gets.
   */
  fireTargetsFor(orderIndex: number): FireTarget[] {
    const context = this.fireContextFor(orderIndex);
    if (this.phase !== TurnPhase.BATTLE || !context) return [];
    const enemies = this.enemyView?.().map((enemy) => enemy.position);
    return fireTargets(this.board, this.summaries()[orderIndex]!.firingFrom, context, enemies);
  }

  /**
   * Pass and play: the match tells the session where the enemy units are. Then only they are
   * targets, they block the view, and a shot knows its target's type and sandbags
   */
  /**
   * Pass and play: both sides use the sections as `viewSide` (the main side, where the device
   * sits) sees them, so a card for the right orders the units on the screen's right for both
   */
  sectionsSeenFrom(viewSide: Faction) {
    this.board.sectionsSeenFrom(this.faction, viewSide);
    this.publish();
  }

  setEnemyView(view: () => readonly EnemyUnit[]) {
    this.enemyView = view;
  }

  /** Pass and play: the enemy unit on this hex (this side's view), if any */
  enemyAt(position: Position): EnemyUnit | null {
    return this.enemyView?.().find((enemy) => samePosition(enemy.position, position)) ?? null;
  }

  /** The battle's order summaries, as the snapshot's (for the pass and play match) */
  orderSummaries() {
    return this.summaries();
  }

  /** Fire answering the questionnaire by hand (the answers include the distance and the target's terrain) */
  fire(orderIndex: number, answers: FireAnswers): boolean {
    return this.fireWith(orderIndex, answers);
  }

  /**
   * Fire at a hex picked on the map: its distance and terrain answer those
   * questions. Only a hex in range and in sight, where the shot gets dice.
   * Sandbags are the player's answer: the enemy's aren't known here.
   */
  fireAt(orderIndex: number, choice: FireChoice): boolean {
    const aim = this.aimAnswers(orderIndex, choice);
    return !!aim && this.fireWith(orderIndex, aim.answers, choice.position);
  }

  /** The fire answers for a shot at a hex picked on the map; null when the hex can't be fired at */
  private aimAnswers(
    orderIndex: number,
    choice: FireChoice
  ): { answers: Record<string, string>; target: FireTarget; context: FireContext } | null {
    const { position } = choice;
    let { infantry, sandbags } = choice;
    let camouflaged = choice.camouflaged ?? false;
    const target = this.fireTargetsFor(orderIndex).find((t) => samePosition(t.position, position));
    if (!target || !target.lineOfSight || target.dice <= 0) return null;
    const context = this.fireContextFor(orderIndex)!;
    // Pass and play: the enemy unit there is known
    const enemy = this.enemyAt(position);
    if (enemy) {
      infantry = enemy.unitType === UnitType.INFANTRY;
      sandbags = enemy.sandbags;
      camouflaged = enemy.camouflaged;
    }
    const answers: Record<string, string> = {
      ...mapAnswers(target),
      targetType: infantry ? TARGET_INFANTRY : TARGET_OTHER,
      sandbags: sandbags ? "yes" : "no",
      camouflage: camouflaged ? "yes" : "no",
    };
    return { answers, target, context };
  }

  /**
   * Pass and play: the shot this unit would fire at the enemy unit on this hex, before it's
   * rolled: its dice and where they come from, and the die thrown. Null when it can't fire there.
   */
  aimAt(orderIndex: number, position: Position): ShotAim | null {
    const enemy = this.enemyAt(position);
    if (!enemy || this.shotsLeft(orderIndex) <= 0) return null;
    const aim = this.aimAnswers(orderIndex, { position, infantry: true, sandbags: false });
    if (!aim) return null;
    const { dice, steps, blocked } = calculateFireDice(FIRE_QUESTIONS, aim.context, aim.answers, fireBonusSteps);
    if (blocked || (aim.context.closeAssaultOnly && aim.target.distance !== 1)) return null;
    return {
      position,
      distance: aim.target.distance,
      terrain: aim.target.terrain,
      enemy,
      dice,
      steps,
      eightSided: this.longRangeDie && aim.target.distance > 1,
    };
  }

  private fireWith(orderIndex: number, answers: FireAnswers, targetPosition?: Position): boolean {
    if (!this.canFireNow(orderIndex)) return false;
    const context = this.fireContextFor(orderIndex)!;
    if (nextFireQuestion(FIRE_QUESTIONS, context, answers)) return false;
    if (context.closeAssaultOnly && answers.distance !== "1") return false;

    const { dice, steps, notes, blocked } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
    if (blocked) return false;
    const infantry = targetAnswer(answers.targetType);
    if (infantry === null || !this.canBeTarget(infantry)) return false;
    const target = this.targetFor(infantry, answers.distance === "1");
    const usedBonus = combatBonusDice(context, answers.distance === "1") > 0;
    return this.recordShot(orderIndex, dice, steps, notes, target, false, usedBonus, targetPosition);
  }

  /**
   * The unit's last shot was a close assault that pushed back or eliminated
   * its target, so it can take ground and fire once more: armour only
   * (infantry never overruns; pass and play's push-back is `groundRuleFor`).
   * Once per unit per turn; not after a collision.
   */
  canTakeGround(orderIndex: number): boolean {
    return this.groundRuleFor(orderIndex) !== null;
  }

  /**
   * How the unit may take ground after its last shot: an overrun (it fires once more) or, in
   * pass and play, infantry pushing back the unit its close assault made retreat (no more shot)
   */
  groundRuleFor(orderIndex: number): "overrun" | "pushBack" | null {
    if (this.phase !== TurnPhase.BATTLE) return null;
    const overrun = this.canOverrun(orderIndex);
    if (overrun) return "overrun";
    if (!this.figures) return null;
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    const last = this.shots.findLast((shot) => shot.orderIndex === orderIndex);
    if (!order || !summary || summary.removed || summary.tookGround || !last) return null;
    if (!last.target.closeAssault || last.collision || !last.targetPosition) return null;
    if (!PUSH_BACK_UNIT_TYPES.includes(order.unit.getUnitType())) return null;
    return readRoll(appliedFaces(last.faces, last.kept), last.target).retreats > 0 ? "pushBack" : null;
  }

  private canOverrun(orderIndex: number): boolean {
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    const last = this.shots.findLast((shot) => shot.orderIndex === orderIndex);
    if (!order || !summary || summary.removed || summary.tookGround || !last) return false;
    if (!last.target.closeAssault || last.collision || !last.targetPosition) return false;
    // Only when the target could have retreated (a flag) or been eliminated (a hit)
    const { hits, retreats } = readRoll(appliedFaces(last.faces, last.kept), last.target);
    if (hits === 0 && retreats === 0) return false;
    return TAKE_GROUND_UNIT_TYPES.includes(order.unit.getUnitType());
  }

  /**
   * The unit took ground after its last shot: it moves to the hex it fired at
   * (as a map edit, as the player would in the final phase) and gets one more
   * shot, in close assault, from there.
   */
  takeGround(orderIndex: number): boolean {
    const rule = this.groundRuleFor(orderIndex);
    if (!rule) return false;
    const last = this.shots.findLast((shot) => shot.orderIndex === orderIndex)!;
    const { end: from, unit } = this.orders[orderIndex]!;
    const to = last.targetPosition!;
    const sandbags = this.moveUnit(from, to);
    if (!sandbags) return false;
    const clearedWire = this.clearWire(unit, to);
    this.battleEdits = [
      ...this.battleEdits,
      { kind: "move", from, to, unit, ...(sandbags.length > 0 && { sandbags }), ...(clearedWire && { clearedWire }) },
    ];
    const taken = rule === "pushBack" ? { tookGround: true, pushedBack: true } : { tookGround: true };
    this.shots = this.shots.map((shot) => (shot === last ? { ...shot, ...taken } : shot));
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
    const moved = this.battleEdits[edit]!;
    if (moved.kind === "move") {
      this.restoreSandbags(moved.sandbags ?? []);
      if (moved.clearedWire) this.board.getHex(to)?.setWire(true);
    }
    this.battleEdits = this.battleEdits.filter((_, i) => i !== edit);
    this.shots = this.shots.map((shot) => (shot === last ? { ...shot, tookGround: false, pushedBack: undefined } : shot));
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
    const target: ShotTarget = { infantry: true, closeAssault: false, die: "battle" };
    const shot: Shot = { orderIndex, steps: [], dice: 0, faces: [], notes: [], collision: false, target, combatBonus: false, kept: null, removedWire: position };
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  // Fortify: in the battle, the side's ordered infantry may put sandbags on its hex instead of firing

  /** The unit of this order may fortify now, instead of its next shot (not on a hex that has sandbags) */
  private canFortify(orderIndex: number): boolean {
    const effect = this.playedEffect("fortify");
    const order = this.orders[orderIndex];
    const summary = this.summaries()[orderIndex];
    if (!effect || !order || !summary || !this.canFireNow(orderIndex)) return false;
    if (!effect.unitTypes.includes(order.unit.getUnitType())) return false;
    return !this.board.getHex(summary.firingFrom)?.sandbags;
  }

  /** Fortify instead of firing: sandbags on the unit's hex at once, against the enemy's later shots; it counts as the unit's shot */
  fortify(orderIndex: number): boolean {
    if (!this.canFortify(orderIndex)) return false;
    const position = { ...this.summaries()[orderIndex]!.firingFrom };
    this.board.getHex(position)!.setSandbags(true);
    const target: ShotTarget = { infantry: true, closeAssault: false, die: "battle" };
    const shot: Shot = { orderIndex, steps: [], dice: 0, faces: [], notes: [], collision: false, target, combatBonus: false, kept: null, fortified: position };
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  // Camouflage: the badge lets only a close assault hit the unit, until it moves or battles

  /**
   * This side's units with the camouflage badge now: those that had it and haven't moved or
   * battled this turn, and, from the final phase on, the unit given this turn's Camouflage card
   */
  private camouflagedUnits(): Unit[] {
    const onBoard = new Set(this.board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));
    const kept = [...this.camouflaged].filter((unit) => !this.movedOrBattled(unit));
    const given =
      this.phase === TurnPhase.END_OF_TURN
        ? this.assignments.filter((a) => a.card.effect?.kind === "camouflage").map((a) => a.unit)
        : [];
    return [...new Set([...kept, ...given])].filter((unit) => onBoard.has(unit));
  }

  /** The unit moved this turn (its order, or on the map) or battled (a roll of its own) */
  private movedOrBattled(unit: Unit): boolean {
    const moved =
      this.orders.some((order) => order.unit === unit && !samePosition(order.start, order.end)) ||
      this.battleEdits.some((edit) => edit.kind === "move" && edit.unit === unit);
    const fired = this.shots.some((shot) => shot.dice > 0 && this.orders[shot.orderIndex]?.unit === unit);
    const position = this.positionOf(unit);
    const collided = !!position && this.standingCollisions.some((roll) => samePosition(roll.from, position));
    return moved || fired || collided;
  }

  /** Pass and play: where the units that had the camouflage badge as the turn began stood then, for the enemy's eyes while the orders are secret */
  camouflagedAtStart(): Position[] {
    return [...this.camouflaged].flatMap((unit) => {
      const start = this.orders.find((order) => order.unit === unit)?.start;
      return start ? [start] : (this.positionOf(unit) ?? []);
    });
  }

  /** The unit on this hex has the camouflage badge: only a close assault can hit it */
  isCamouflaged(position: Position): boolean {
    const unit = this.board.getHex(position)?.unit;
    return !!unit && this.camouflagedUnits().includes(unit);
  }

  // Reposition: after the battle, the artillery given the card moves up to 2 hexes. On their
  // own tablets the player mirrors the table's move with "Actualizar mapa"; pass and play moves it here

  /** Pass and play, final phase: the unit given Reposition and the hexes it can move to, until it has moved */
  private repositioning(): { from: Position; options: Position[] } | null {
    if (!this.figures || this.phase !== TurnPhase.END_OF_TURN) return null;
    if (this.battleEdits.some((edit) => edit.kind === "move" && edit.reposition)) return null;
    const given = this.assignments.find((a) => a.card.effect?.kind === "reposition");
    const effect = given?.card.effect;
    const from = given && this.positionOf(given.unit);
    if (!from || effect?.kind !== "reposition") return null;
    const enemies = new Set((this.enemyView?.() ?? []).map((enemy) => positionKey(enemy.position)));
    const options = this.board
      .calculatePossibleMovesWithPaths(this.board.getHex(from)!, effect.hexes)
      .filter(({ position, path }) => !samePosition(position, from) && path.every((p) => !enemies.has(positionKey(p))))
      .map(({ position }) => position);
    return { from, options };
  }

  /** Pass and play: the unit given Reposition moves to one of its hexes, as a map edit */
  reposition(to: Position): boolean {
    const due = this.repositioning();
    if (!due || !includesPosition(due.options, to)) return false;
    const unit = this.board.getHex(due.from)!.unit!;
    const sandbags = this.moveUnit(due.from, to);
    if (!sandbags) return false;
    this.addBattleEdit({
      kind: "move",
      from: { ...due.from },
      to: { ...to },
      unit,
      reposition: true,
      ...(sandbags.length > 0 && { sandbags }),
    });
    return this.publish();
  }

  /** The target of a shot: rolled on the long-range die when the game uses it and the target isn't adjacent */
  private targetFor(infantry: boolean, closeAssault: boolean): ShotTarget {
    return { infantry, closeAssault, die: this.longRangeDie && !closeAssault ? "longRange" : "battle" };
  }

  /**
   * A target is infantry or not. Either is accepted, whatever the enemy
   * started with: the Reinforcements card can bring it a new kind of unit.
   */
  private canBeTarget(infantry: unknown): infantry is boolean {
    return typeof infantry === "boolean";
  }

  /**
   * Roll for a collision: the unit crossed or landed on a hex with an enemy
   * unit during the movement phase. Only a unit that moved, may fire and
   * hasn't fired yet; the roll uses up its shot. Collisions come before any
   * other shot, so they don't wait for the units that didn't move.
   */
  fireCollision(orderIndex: number, infantry: boolean): boolean {
    if (!this.canBeTarget(infantry)) return false;
    if (this.shotsLeft(orderIndex) <= 0) return false;
    const order = this.orders[orderIndex]!;
    if (samePosition(order.start, order.end)) return false;
    if (this.shots.some((shot) => shot.orderIndex === orderIndex)) return false;

    const context: FireContext = {
      unitType: order.unit.getUnitType(),
      card: this.cardFor(order),
      combatBonuses: this.combatBonusesFor(orderIndex),
    };
    const steps = collisionSteps(context);
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    const target: ShotTarget = { infantry, closeAssault: true, die: "battle" };
    return this.recordShot(orderIndex, dice, steps, [...COLLISION_NOTES], target, true, combatBonusDice(context, true) > 0);
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

    const { removedWire: wire, fortified } = this.shots[index]!;
    if (wire) this.board.getHex(wire)?.setWire(true);
    if (fortified) this.board.getHex(fortified)?.setSandbags(false);
    this.shots = this.shots.filter((_, i) => i !== index);
    return this.publish();
  }

  /**
   * Apply only some of the results of this unit's shot number `shotNumber`
   * (0 for its first shot this turn): `kept` are indexes into its faces, and
   * null applies them all again. The roll itself stays as it was.
   */
  keepResults(orderIndex: number, shotNumber: number, kept: readonly number[] | null): boolean {
    const shot = this.shots.filter((s) => s.orderIndex === orderIndex)[shotNumber];
    if (!shot) return false;
    // A collision is rolled in the movement phase (pass and play)
    if (this.phase !== TurnPhase.BATTLE && !(shot.collision && this.phase === TurnPhase.MOVEMENT)) return false;
    if (kept !== null && !isKeptList(kept, shot.faces.length)) return false;

    const sorted = kept && kept.length < shot.faces.length ? [...kept].sort((a, b) => a - b) : null;
    this.shots = this.shots.map((s) => (s === shot ? { ...s, kept: sorted } : s));
    return this.publish();
  }

  /** Pass and play: apply only some results of a collision roll of a unit without an order, as `keepResults` */
  keepStandingResults(index: number, kept: readonly number[] | null): boolean {
    const roll = this.standingCollisions[index];
    if (!roll || (kept !== null && !isKeptList(kept, roll.faces.length))) return false;
    const sorted = kept && kept.length < roll.faces.length ? [...kept].sort((a, b) => a - b) : null;
    this.standingCollisions = this.standingCollisions.map((r, i) => (i === index ? { ...r, kept: sorted } : r));
    return this.publish();
  }

  private recordShot(
    orderIndex: number,
    dice: number,
    steps: DiceStep[],
    notes: Localized[],
    target: ShotTarget,
    collision = false,
    combatBonus = false,
    targetPosition?: Position
  ): true {
    const shot: Shot = { orderIndex, steps, dice, faces: this.rollFaces(dice, steps, target), notes, collision, target, combatBonus, kept: null };
    if (targetPosition) shot.targetPosition = targetPosition;
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  /** A roll's faces: the dice thrown, then the ones its steps add already showing a face (Heat of Battle's flag) */
  private rollFaces(dice: number, steps: readonly DiceStep[], target: ShotTarget): DieFace[] {
    const set = setFaces(steps).slice(0, dice);
    return [...rollDice(dice - set.length, this.random, SIDES_OF[target.die]), ...set];
  }

  // --- coins: earned and spent through the turn; `turnCoins` works out the ledger

  private extraTurn(): boolean {
    return this.attacking && this.turn === 1;
  }

  private turnCoinEntries(): CoinEntry[] {
    const endOfTurn = this.phase === TurnPhase.END_OF_TURN;
    return turnCoins({
      orders: this.orders,
      combatCards: this.combatCardsPlayed,
      shots: this.shots,
      standingCollisions: this.standingCollisions,
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
   * Final phase: take 2 coins or a combat card (drawn at once). The player
   * weighs the two in the view; once taken, the choice stays.
   */
  chooseReward(choice: RewardChoice): boolean {
    if (!this.needsRewardChoice() || !isRewardChoice(choice)) return false;
    if (this.rewardChoice) return false;

    this.rewardChoice = choice;
    if (choice === "combatCard") this.drawCombat();
    return this.publish();
  }

  // --- combat cards: order cards are played with the command card, battle
  // cards at any time in the battle (one each per turn), paid when played

  private hasCombatCards(): boolean {
    return this.combatDeck.getDrawPileCount() + this.combatDeck.getDiscardPileCount() > 0;
  }

  /** The effect of a combat card played this turn, of this kind */
  private playedEffect<K extends CombatEffect["kind"]>(kind: K): Extract<CombatEffect, { kind: K }> | null {
    const card = this.combatCardsPlayed.find((c) => c.effect?.kind === kind);
    return (card?.effect as Extract<CombatEffect, { kind: K }> | undefined) ?? null;
  }

  /**
   * Take back a combat card while giving orders, before they're confirmed; its coins come back.
   * Not one whose movement an order used: undo that order first
   */
  cancelCombatCard(card: CombatCard): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || !this.combatCardsPlayed.includes(card)) return false;
    if (this.orders.some((order) => order.boostCard === card.id)) return false;

    // Its marks go, and the marks of the cards after it (each card's are marked in turn)
    const span = this.markerSpans().find((s) => s.card === card);
    if (span) this.markers = this.markers.slice(0, span.start);
    this.combatCardsPlayed = this.combatCardsPlayed.filter((c) => c !== card);
    this.assignments = this.assignments.filter((a) => a.card !== card);
    this.combatHand = [...this.combatHand, card];
    return this.publish();
  }

  // Map markers: the hexes the combat cards played target, or where their unit appears.
  // Each card's are marked in turn, so the markers are one list and each card owns a span of it

  /** Each played card that marks hexes, and where its marks start in `markers` */
  private markerSpans(): { card: CombatCard; rule: MarkerRule; start: number }[] {
    let start = 0;
    return this.combatCardsPlayed.flatMap((card) => {
      if (!card.marker) return [];
      const span = { card, rule: card.marker, start };
      start += card.marker.count;
      return [span];
    });
  }

  private marksOf(span: { rule: MarkerRule; start: number }): Position[] {
    return this.markers.slice(span.start, span.start + span.rule.count);
  }

  /** The card whose hexes are marked next: the first one not fully marked, while giving orders */
  private markingSpan() {
    if (this.phase !== TurnPhase.ORDER_UNITS) return null;
    return this.markerSpans().find((span) => this.markers.length < span.start + span.rule.count) ?? null;
  }

  /** A unit ending its move here would stand on a marked hex (or next to one, for Air Bombardment) */
  private breaksMark(position: Position): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS) return false;
    return this.markerSpans().some((span) => firstConflictingMark(span.rule, this.board, this.marksOf(span), position) !== -1);
  }

  private markersLeft(): number {
    return this.markerSpans().reduce((sum, span) => sum + span.rule.count, 0) - this.markers.length;
  }

  /** Mark a hex for the card being marked; see markerRules.ts for where */
  markHex(position: Position): boolean {
    const span = this.markingSpan();
    if (!span || !canMark(span.rule, this.board, this.marksOf(span), position)) return false;

    this.markers = [...this.markers, { row: position.row, col: position.col }];
    return this.publish();
  }

  private markableNow(): Position[] {
    const span = this.markingSpan();
    return span ? markablePositions(span.rule, this.board, this.marksOf(span)) : [];
  }

  undoMarker(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || this.markers.length === 0) return false;

    this.markers = this.markers.slice(0, -1);
    return this.publish();
  }

  private markingSnapshot(): GameSnapshot["marking"] {
    const span = this.markingSpan();
    return span && { card: span.card, rule: span.rule, marked: this.markers.length - span.start };
  }

  /** What each marked hex is for: its card's kind of mark */
  private markerKinds(): MarkerRule["kind"][] {
    return this.markers.map((_, i) => this.markerSpans().find((span) => i >= span.start && i < span.start + span.rule.count)?.rule.kind ?? "target");
  }

  // Cards given to a unit while ordering (Explosives, Personal Armor…)

  /** This side's units the card can go to now: of its types, with an order if it needs one */
  private assignableFor(card: CombatCard): Position[] {
    const rule = card.assign;
    if (!rule || this.phase !== TurnPhase.ORDER_UNITS) return [];
    return this.board
      .getAllHexes()
      .filter((hex) => {
        const unit = hex.unit;
        if (!unit || !rule.unitTypes.includes(unit.getUnitType())) return false;
        return !rule.ordered || this.orders.some((order) => order.unit === unit);
      })
      .map((hex) => hex.getPosition());
  }

  /** The next played card to give to a unit, and the units it can go to */
  private assigning(): { card: CombatCard; positions: Position[] } | null {
    if (this.phase !== TurnPhase.ORDER_UNITS) return null;
    const card = this.combatCardsPlayed.find((c) => c.assign && !this.assignments.some((a) => a.card === c));
    return card ? { card, positions: this.assignableFor(card) } : null;
  }

  /** A card still waits for its unit, and some unit can take it: the orders can't be confirmed yet */
  private assignmentDue(): boolean {
    return this.combatCardsPlayed.some(
      (card) => card.assign && !this.assignments.some((a) => a.card === card) && this.assignableFor(card).length > 0
    );
  }

  /** Give the next card waiting for a unit to the unit on this hex */
  assignCard(position: Position): boolean {
    const next = this.assigning();
    const unit = this.board.getHex(position)?.unit;
    if (!next || !unit || !includesPosition(next.positions, position)) return false;

    this.assignments = [...this.assignments, { card: next.card, unit }];
    return this.publish();
  }

  /** Take a card back from its unit while giving orders, to give it to another */
  unassignCard(card: CombatCard): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS || !this.assignments.some((a) => a.card === card)) return false;

    this.assignments = this.assignments.filter((a) => a.card !== card);
    return this.publish();
  }

  /** Where the unit stands now, or null if it was removed */
  private positionOf(unit: Unit): Position | null {
    return this.board.getAllHexes().find((hex) => hex.unit === unit)?.getPosition() ?? null;
  }

  /** False for a card that needs an ordered unit of some type (Spotter: artillery) when none has an order: confirming warns */
  hasOrderedUnitFor(card: CombatCard): boolean {
    const types = card.needsOrdered;
    return !types || this.orders.some((order) => types.includes(order.unit.getUnitType()));
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
    return this.phase === TurnPhase.ORDER_UNITS && this.orders.length === 0 && this.markers.length === 0;
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

  /**
   * Whether removing the unit on this hex leaves an infantry unit in its place: with the
   * `artilleryCrew` rule, artillery destroyed in the battle (not a fix to the map in Órdenes)
   */
  leavesCrew(position: Position): boolean {
    return (
      this.artilleryCrew &&
      this.phase === TurnPhase.END_OF_TURN &&
      this.board.getHex(position)?.unit?.getUnitType() === UnitType.ARTILLERY
    );
  }

  /** Remove a unit destroyed on the table (an artillery's crew may stay as infantry: `leavesCrew`) */
  removeUnit(position: Position): boolean {
    if (!this.canEditMap()) return false;
    const crew = this.leavesCrew(position);
    const unit = this.board.removeUnitAt(position);
    if (!unit) return false;

    const replacement = crew ? new Unit(UnitType.INFANTRY) : undefined;
    if (replacement) this.board.placeUnitAt(position, replacement);
    // The sandbags go with the unit; a crew left behind stays behind them
    const hex = this.board.getHex(position)!;
    const sandbags = hex.sandbags && !replacement;
    if (sandbags) hex.setSandbags(false);
    this.addBattleEdit({ kind: "remove", position, unit, ...(replacement && { replacement }), ...(sandbags && { sandbags }) });
    return this.publish();
  }

  /** Move a unit to any empty hex, to mirror a retreat or taking ground */
  relocateUnit(from: Position, to: Position): boolean {
    if (!this.canEditMap() || samePosition(from, to)) return false;
    if (!this.board.getHex(to)?.isPassable()) return false;
    const unit = this.board.getHex(from)?.unit;
    const sandbags = this.moveUnit(from, to);
    if (!unit || !sandbags) return false;

    this.addBattleEdit({ kind: "move", from, to, unit, ...(sandbags.length > 0 && { sandbags }) });
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

  // Sandbags: only this side's (the enemy's can't be known here). They go by themselves
  // when the unit moves off them (`moveUnit`); these mirror the rest

  /** Take away sandbags that aren't on the table any more (to fix the map) */
  removeSandbagsAt(position: Position): boolean {
    if (!this.canEditMap()) return false;
    const hex = this.board.getHex(position);
    if (!hex?.sandbags) return false;

    hex.setSandbags(false);
    this.addBattleEdit({ kind: "sandbags", position: { ...position }, placed: false });
    return this.publish();
  }

  /**
   * Move a unit on the board. Sandbags stay only while their unit stays, so the
   * ones on the hex it leaves go. Returns the hexes whose sandbags went, to put
   * back on an undo, or null if the unit couldn't move.
   */
  private moveUnit(from: Position, to: Position): Position[] | null {
    if (!this.board.moveUnit(from, to)) return null;
    const hex = this.board.getHex(from)!;
    if (!hex.sandbags) return [];
    hex.setSandbags(false);
    return [{ ...from }];
  }

  /**
   * A tank that enters barbed wire removes it (official rule; WIRE_CLEARING_UNIT_TYPES).
   * Returns whether it did, to put the wire back on an undo
   */
  private clearWire(unit: Unit, position: Position): boolean {
    const hex = this.board.getHex(position);
    if (!hex?.wire || !WIRE_CLEARING_UNIT_TYPES.includes(unit.getUnitType())) return false;
    hex.setWire(false);
    return true;
  }

  private restoreSandbags(positions: readonly Position[]) {
    positions.forEach((position) => this.board.getHex(position)?.setSandbags(true));
  }

  undoBattleEdit(): boolean {
    if (!this.canUndoMapEdit()) return false;
    const edit = this.battleEdits.at(-1)!;

    if (edit.kind === "remove") {
      if (edit.replacement) this.board.removeUnitAt(edit.position);
      this.board.placeUnitAt(edit.position, edit.unit);
      if (edit.sandbags) this.restoreSandbags([edit.position]);
    } else if (edit.kind === "add") {
      this.board.removeUnitAt(edit.position);
    } else if (edit.kind === "wire") {
      this.board.getHex(edit.position)?.setWire(true);
    } else if (edit.kind === "sandbags") {
      this.board.getHex(edit.position)?.setSandbags(!edit.placed);
    } else {
      this.board.moveUnit(edit.to, edit.from);
      this.restoreSandbags(edit.sandbags ?? []);
      if (edit.clearedWire) this.board.getHex(edit.to)?.setWire(true);
    }
    this.battleEdits = this.battleEdits.slice(0, -1);
    return this.publish();
  }

  // Reinforcements: as the final phase starts, the card's unit appears on the
  // hex marked with the cross (`endBattle`), with no roll

  /** The unit the Reinforcements card played this turn brings */
  private reinforcementUnit(): UnitType | null {
    return this.playedEffect("reinforcements")?.unitType ?? null;
  }

  private reinforcementToPlace(): UnitType | null {
    if (this.phase !== TurnPhase.END_OF_TURN) return null;
    const unitType = this.reinforcementUnit();
    return unitType && !this.battleEdits.some((edit) => edit.kind === "add") ? unitType : null;
  }

  /** Put the unit on an empty hex, when its marked hex was taken (or the placing was undone) */
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
   * Discard the played card and draw a command card (once per turn).
   * `endBattle` already does it; this is for a save from before then.
   */
  drawCard(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN || !this.chosenCard) return false;
    if (this.drawnCard || this.drawOptions.length > 0) return false;

    this.draw();
    return this.publish();
  }

  /**
   * A single card goes straight to the hand, and the player may swap it with
   * `drawAgain`; a card that draws more (Preparations: 2) leaves them in
   * `drawOptions` and `keepCard` puts one in the hand. A card with a
   * `rewardCard` (Refuel) gives that card instead, from out of the deck.
   */
  private draw() {
    if (!this.chosenCard) return;
    // Discard first so a reshuffle on an empty deck can bring the card back,
    // so there is always a card to draw. A card kept out of the deck goes back out
    const playedCard = this.chosenCard;
    if (!playedCard.reserve) this.deck.discard(playedCard);
    this.hand = this.hand.filter((c) => c !== playedCard);
    const reward = this.rewardCardFor(playedCard);
    if (reward) {
      this.keep(reward);
    } else {
      const drawn = this.deck.draw(playedCard.drawChoice);
      if (drawn.length === 0) throw new Error("No command card to draw");
      // A single card is kept unless the player swaps it (drawAgain)
      if (playedCard.drawChoice === 1) this.keep(drawn[0]!);
      else this.drawOptions = drawn;
    }
    // The scenario's extra card goes straight to the hand
    if (this.drawsExtra()) {
      const [extra] = this.deck.draw(1);
      if (extra) {
        this.hand = [...this.hand, extra];
        this.extraDrawn = extra;
      }
    }
  }

  /** The cards kept out of the deck that aren't in the hand, being played or drawn */
  private reserve(): CommandCard[] {
    const out = new Set([...this.hand, ...this.drawOptions, this.chosenCard, this.drawnCard]);
    return this.commandCards.filter((card) => card.reserve && !out.has(card));
  }

  /**
   * The card a played card gives instead of the draw (Refuel: Armor Assault, or Direct from HQ
   * with no armour left on the board); null to draw as usual, also when it's already in the hand
   */
  private rewardCardFor(played: CommandCard): CommandCard | null {
    const reward = played.rewardCard;
    if (!reward) return null;
    const has = this.board.getAllHexes().some((hex) => hex.unit?.getUnitType() === reward.needs);
    const template = has ? reward.card : reward.otherwise;
    return this.reserve().find((card) => card.templateId === template) ?? null;
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
    if (this.chosenCard?.drawChoice !== 1 || this.drewAgain || this.drawnCard?.reserve) return false;
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
    if (this.reinforcementToPlace()) return false;

    const playedCard = this.chosenCard;
    const coins = this.coins();
    const record = recordTurn({
      turn: this.turn,
      card: playedCard,
      orders: this.orders,
      shots: this.shots,
      battleEdits: this.battleEdits,
      coins: this.turnCoinEntries(),
      coinsAfter: coins,
      reward: this.rewardChoice,
      combatCardsPlayed: this.combatCardsPlayed,
      assignments: this.assignments.map(({ card, unit }) => ({ card: card.name, unit: unit.getUnitType(), position: this.positionOf(unit) })),
      combatCardDrawn: this.drawnCombatCard,
      markers: this.markers,
      cardAttacks: this.cardAttacks,
    });
    this.log = [...this.log, record];
    this.camouflaged = new Set(this.camouflagedUnits());
    this.startCoins = this.testMode ? Math.max(coins, TEST_MODE_COINS) : coins;
    this.coinAdjustments = [];
    this.rewardChoice = null;
    const played = this.combatCardsPlayed;
    // Test mode: played cards come back to the hand so they can be tried again
    if (this.testMode) this.combatHand = [...this.combatHand, ...played];
    else played.forEach((card) => this.combatDeck.discard(card));
    this.combatCardsPlayed = [];
    this.markers = [];
    this.cardAttacks = [];
    this.assignments = [];
    this.standingCollisions = [];
    this.retreatFlags = new Map();
    this.turnHits = new Map();
    this.armorHits = new Map();
    this.drawnCombatCard = null;

    this.chosenCard = null;
    this.chosenSection = null;
    this.drawnCard = null;
    this.extraDrawn = null;
    this.drewAgain = false;
    this.orders = [];
    this.battleEdits = [];
    this.shots = [];
    this.unmovedFireSkipped = false;
    this.turn++;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  // --- saving

  save(): SavedGame {
    return writeSave(this.scenario.id, this.faction, {
      longRangeDie: this.longRangeDie,
      testMode: this.testMode,
      artilleryCrew: this.artilleryCrew,
      figures: this.figures,
    }, this.board, {
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
      combatCardsPlayed: this.combatCardsPlayed,
      markers: this.markers,
      cardAttacks: this.cardAttacks,
      assignments: this.assignments,
      standingCollisions: this.standingCollisions,
      hits: this.hits,
      retreatFlags: this.retreatFlags,
      turnHits: this.turnHits,
      armorHits: this.armorHits,
      camouflaged: this.camouflaged,
      drawnCombatCard: this.drawnCombatCard,
      drops: this.drops,
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
      artilleryCrew: saved.artilleryCrew,
      figures: saved.figures,
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
    session.unmovedFireSkipped = state.unmovedFireSkipped;
    session.battleEdits = state.battleEdits;
    session.shots = state.shots;
    session.log = state.log;
    session.startCoins = state.startCoins;
    session.coinAdjustments = state.coinAdjustments;
    session.rewardChoice = state.rewardChoice;
    session.combatDeck.restorePiles([...state.combatDrawPile], [...state.combatDiscardPile]);
    session.combatHand = state.combatHand;
    session.combatCardsPlayed = state.combatCardsPlayed;
    session.markers = state.markers;
    session.cardAttacks = state.cardAttacks;
    session.assignments = state.assignments;
    session.standingCollisions = [...state.standingCollisions];
    session.hits = new Map(state.hits);
    session.retreatFlags = new Map(state.retreatFlags);
    session.turnHits = new Map(state.turnHits);
    session.armorHits = new Map(state.armorHits);
    session.camouflaged = new Set(state.camouflaged);
    session.drawnCombatCard = state.drawnCombatCard;
    session.drops = state.drops;
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
      combatCardsPlayed: [...this.combatCardsPlayed],
      markers: this.markers,
      markerKinds: this.markerKinds(),
      marking: this.markingSnapshot(),
      markable: this.markableNow(),
      attackMarks: this.attackMarks(),
      cardAttacks: this.cardAttacks,
      attacksPending: this.attacksPending(),
      assignments: this.assignments.map(({ card, unit }) => ({ card, unitType: unit.getUnitType(), position: this.positionOf(unit) })),
      assigning: this.assigning(),
      standingCollisions: this.standingCollisions,
      strength: this.strength(),
      drawnCombatCard: this.drawnCombatCard,
      combatCardDue: this.combatCardDue(),
      mustDiscardCombatCard: this.mustDiscardCombatCard(),
      canRemoveWire: this.orders.map((_, i) => this.canRemoveWire(i)),
      canFortify: this.orders.map((_, i) => this.canFortify(i)),
      camouflaged: this.camouflagedUnits().flatMap((unit) => this.positionOf(unit) ?? []),
      repositioning: this.repositioning(),
      drops: this.drops,
      dropsLeft: this.dropsLeft(),
      canUnpickCard: this.canUnpickCard(),
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
