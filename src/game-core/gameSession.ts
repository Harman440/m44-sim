// game-core/gameSession.ts
import BoardManager from "./BoardManager";
import Order from "./order";
import Unit, { UnitType } from "./unit";
import { ShotTarget, TargetKinds, enemyTargetKinds, faceHits } from "../data/hitRules";
import { ATTACK_DIE_SIDES, DieFace, DieKind, SIDES_OF, rollDice, suppressed } from "./dice";
import { appliedFaces, isKeptList, readRoll } from "./rollResult";
import { CombatBonus, DiceStep, FireAnswers, FireContext, calculateFireDice, nextFireQuestion, setFaces } from "./fireRules";
import { FireTarget, fireTargets, hasFireTarget, hexDistance, mapAnswers } from "./fireTargets";
import {
  COLLISION_NOTES,
  FIRE_QUESTIONS,
  collisionSteps,
  PINNED_ANSWER,
  ADJACENT_ENEMY_ANSWER,
  TAKE_GROUND_UNIT_TYPES,
  PUSH_BACK_UNIT_TYPES,
  TARGET_INFANTRY,
  TARGET_OTHER,
  BASE_DICE_BY_DISTANCE,
  combatBonusDice,
  fireBonusSteps,
  targetAnswer,
  wireChoiceFor,
  WIRE_CLEARING_UNIT_TYPES,
} from "../data/fireQuestions";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { HexType } from "../types/hex";
import { Faction } from "../types/faction";
import { fromKey, includesPosition, positionKey, samePosition } from "./position";
import Hex from "./hex";
import { MoveLimits, orderablePositions } from "./orderRules";
import {
  ActionRefusal,
  actionCost,
  actionRefusal,
  actionsFor,
  canFireAShot,
  fireOptionRefusal,
  fireOptionsFor,
  moveLimitsOf,
  moveRulesOf,
  plainActionForMove,
  plainActionsFor,
  plainFireOption,
  shotsOf,
} from "./actionRules";
import type { FireOption, UnitAction } from "./unitAction";
import { SupplyCost, TurnSpent, UnitSupplies, amountOf, endOfTurn, fullSupplies, pay, refill, refund, reload, startingSupplies } from "./unitSupplies";
import { actionById, fireOptionById } from "../data/unitActions";
import { Supply } from "../data/unitSupplies";
import { TAKE_COVER_HITS } from "../data/unitActions";
import { CoinEntry, sumCoins, turnCoins } from "./coins";
import { STARTING_COINS, TEST_MODE_COINS } from "../data/coinRules";
import { ARTILLERY_CREW_FIGURES, damagedFigures, FIGURES, freshFigures, healFigure, hitsPerFigure, mendFigure, takeHits, type Figures } from "../data/figures";
import type { MarkerRule } from "./actionCard";
import { ActionCard, ActionCardEffect, HeldCard, cardsOf, isReady, turnsLeft } from "./actionCard";
import { canMark, firstConflictingMark, markablePositions } from "./markerRules";
import { SavedGame, SessionState, readSave, writeSave } from "./saveGame";
import { TurnRecord, recordTurn } from "./turnLog";
import { OrderSummary, summarizeOrders } from "./turnSummary";
import { rollWithLuck } from "./luck";
import { Localized } from "../i18n/lang";

export interface GameSnapshot {
  turn: number;
  phase: TurnPhase;
  /** The command cards this side holds, with their cost, the turns left of their cooldown and whether one can be played now */
  cards: readonly { card: ActionCard; cost: number; turnsLeft: number; playable: boolean }[];
  /** The command card played this turn, or null for none (or not picked yet) */
  playedCard: ActionCard | null;
  orders: readonly Order[];
  /** Units with no order yet that can be given an action (empty outside giving orders) */
  orderable: readonly Position[];
  /** What each of this side's units has left to spend on its actions, by hex (costs are paid when the orders are confirmed) */
  supplies: readonly { position: Position; supplies: UnitSupplies }[];
  /**
   * What this side's units have lost or gained since the orders were confirmed: morale lost to
   * flags, ammo and shells spent, luck moved. Only units with a change; never the enemy's
   */
  changes: readonly UnitChange[];
  /**
   * The final phase: the energy each unit gets back when the turn ends (more if it rested), and
   * the cards whose cooldown is over next turn. Null in the other phases
   */
  turnEnd: { energy: readonly { position: Position; amount: number; spent: TurnSpent }[]; cardsBack: readonly ActionCard[] } | null;
  /** Board changes made to mirror the table: after the battle, or in Órdenes before any order */
  battleEdits: number;
  /** The map can be changed by hand now: in the final phase, or in Órdenes before any order or mark */
  canEditMap: boolean;
  /** The last map change can be taken back now */
  canUndoMapEdit: boolean;
  /** Shots fired this turn, in the order they were rolled */
  shots: readonly Shot[];
  /** The player gave up the unfired shots of the units that didn't move, so the moved units can fire */
  unmovedFireSkipped: boolean;
  /** Finished turns, oldest first */
  log: readonly TurnRecord[];
  /** Coins the player has now */
  coins: number;
  /** How this turn earned and spent coins, in the order of the ledger */
  coinEntries: readonly CoinEntry[];
  /** Hexes marked on the map for the card played (Barrage, Air Power…), in the order marked */
  markers: readonly Position[];
  /** What each marked hex is for: a target or a cross */
  markerKinds: readonly MarkerRule["kind"][];
  /** The card whose hexes are marked, its rule and how many are marked; null once all are */
  marking: { card: ActionCard; rule: MarkerRule; marked: number } | null;
  /** Hexes that can be marked next (empty outside giving orders, or when all are marked) */
  markable: readonly Position[];
  /** The marked hexes an attack card rolls on, with the card (Barrage, Air Power…) */
  attackMarks: readonly AttackMark[];
  /** The attack card's rolls, one per marked hex (Barrage, Air Power…) */
  cardAttacks: readonly CardAttack[];
  /** The attack card still has hexes to roll: no unit fires until they're done */
  attacksPending: boolean;
  /** Pass and play: collision rolls of units without an order */
  standingCollisions: readonly StandingCollisionRoll[];
  /** Pass and play: each unit's figures left and the flags it must retreat, by hex (none in the one-side game) */
  strength: readonly UnitStrength[];
  /** The unit of each order fires from a hex with barbed wire and may remove it instead (infantry), by order index */
  canRemoveWire: readonly boolean[];
  /** This side's units with the camouflage badge: only a close assault can hit them */
  camouflaged: readonly Position[];
  /** Pass and play, final phase: the next unit that moves after the battle (Behind Enemy Lines), why, and the hexes it can go to; null once each has moved */
  finalMove: { from: Position; options: readonly Position[]; name: Localized } | null;
  /**
   * Own tablets, which don't track figures: the actions given this turn that the table carries
   * out (Medic, Mechanic, Take Cover, Behind Enemy Lines' move after the battle), where each unit ended
   */
  tableReminders: readonly TableReminder[];
  /** Paratroopers placed so far, in order (PARADROP) */
  drops: readonly Position[];
  /** Paratroopers that can still be placed (PARADROP) */
  dropsLeft: number;
  /** Giving orders with none given nor hexes marked yet: the card can be taken back (`unpickCard`) */
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
  /**
   * Out of this side's sight (fog of war, game-core/fogOfWar.ts): it isn't a target and doesn't
   * block the view, but it's still there, so retreats and moves can't end on it
   */
  hidden?: boolean;
}

/** A unit's changes this turn, since the orders were confirmed (`GameSnapshot.changes`) */
export interface UnitChange {
  position: Position;
  /** Morale gained (negative: lost to flags) */
  morale: number;
  /** Ammo and shells gained (negative: spent firing and in collisions) */
  ammo: number;
  /** How far its luck moved */
  luck: number;
}

/** An action the table carries out on own tablets: the unit's hex and the action */
export interface TableReminder {
  position: Position;
  action: UnitAction;
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
  /** It took a flag this turn: pinned (infantry fires with a die less) */
  pinned: boolean;
  /** Hexes it must retreat now (a flag after its first); then it doesn't battle any more this turn */
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
  /** It used the card's extra dice (Finest Hour): limited damage keeps one more result */
  combatBonus: boolean;
  /**
   * The dice whose results are applied, as indexes into `faces` in the order
   * rolled, when the player applies fewer results than were rolled (a unit
   * with few figures); null applies them all. Hits and coins count only these.
   */
  kept: readonly number[] | null;
  /** The hex fired at, when it was picked on the map */
  targetPosition?: Position;
  /** How many of the last dice were added already showing their face, when the steps don't say */
  placed?: number;
  /** The ammo or shells (and equipment) it spent, given back if it's taken back */
  spent?: SupplyCost;
}

/** What the player says about the hex fired at (pass and play knows it from the enemy unit there) */
export interface FireChoice {
  position: Position;
  infantry: boolean;
  sandbags: boolean;
  /** The target has the camouflage badge: only a close assault can hit it */
  camouflaged?: boolean;
  /** Own tablets: the firing unit is pinned (it took a flag this turn); pass and play knows */
  pinned?: boolean;
  /** Own tablets: an enemy unit is next to the firing unit, so it can't fire at range; pass and play knows */
  adjacentEnemy?: boolean;
  /** How the unit fires (a fire option's id, data/unitActions.ts); left out, its plain fire */
  option?: string;
}

/** One unit's part of a shot: its dice, how they add up, the die it throws and how it fires */
interface ShotPart {
  dice: number;
  steps: DiceStep[];
  notes: Localized[];
  target: ShotTarget;
  usedBonus: boolean;
  option: FireOption;
}

/** A fire option offered to a unit, and what it lacks for it (null when it can fire so) */
export interface FireOptionChoice {
  option: FireOption;
  refusal: Supply | "equipment" | null;
}

/** What a shot is, for recording it */
interface ShotRecord {
  dice: number;
  steps: DiceStep[];
  notes: Localized[];
  target: ShotTarget;
  collision?: boolean;
  combatBonus?: boolean;
  targetPosition?: Position;
  /** How it fired; a collision fires plainly */
  option: FireOption;
}

/** A unit's shot this turn. Once rolled it stands; only a deliberate undo removes it. */
export interface Shot extends ShotRoll {
  /** Index of the firing unit's order in this turn's orders */
  orderIndex: number;
  /** How it fired: a fire option's id (data/unitActions.ts); left out in a collision or removing wire */
  option?: string;
  /** The unit's luck before this roll, put back if the shot is taken back */
  luckBefore?: number;
  /** After this close assault the unit took ground (the target retreated or was eliminated) and gets one more shot */
  tookGround?: boolean;
  /** Pass and play: infantry took ground by pushing back the unit its close assault made retreat; no more shot */
  pushedBack?: boolean;
  /** Instead of firing, the unit removed the barbed wire on this hex (no dice) */
  removedWire?: Position;
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

/** The roll of an attack card on one marked hex (Barrage, Air Power, Air Bombardment) */
export interface CardAttack {
  /** Index of the hex in the turn's markers */
  marker: number;
  /** The enemy unit on the hex, or null when it was empty (no roll) */
  target: ShotTarget | null;
  dice: number;
  faces: readonly DieFace[];
}

/** Reminder kept with every attack card roll */
export const CARD_ATTACK_NOTE: Localized = {
  es: "Las retiradas no se pueden ignorar.",
  en: "Retreats can't be ignored.",
};

export interface MoveOptions {
  moves: Position[];
  moveAndFire: Position[];
  /** How far it moves with this order, and its shots if it holds */
  limits: MoveLimits;
}

/** An action offered to a unit, and why it can't be given it (null when it can) */
export interface ActionOption {
  action: UnitAction;
  refusal: ActionRefusal | null;
  /** What it costs this unit: no morale on own tablets (`actionCost`) */
  cost: SupplyCost;
}

/** A hex marked for the attack card, which rolls there before anyone fires */
export interface AttackMark {
  /** Its index in the turn's markers */
  marker: number;
  position: Position;
  card: ActionCard;
  dicePerHex: number;
}

/** `kept` names distinct dice of the roll and leaves out only hits: flags and supplies always count */
const keepsAllButHits = (kept: readonly number[], roll: { faces: readonly DieFace[]; target: ShotTarget }): boolean =>
  isKeptList(kept, roll.faces.length) && roll.faces.every((face, i) => faceHits(face, roll.target) || kept.includes(i));

interface GameSessionOptions {
  scenario: Scenario;
  faction: Faction;
  /** Shots at range roll the 8-sided long-range die (an experiment, chosen per game) */
  longRangeDie?: boolean;
  /** Test mode, to try every card: each turn starts with plenty of coins, and cards have no cooldown */
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
   * `sandbags`: hexes whose sandbags went with the move (the unit left them); `clearedWire`: a tank removed the wire on `to`;
   * `reposition`: a card's move after the battle (Reposition, Behind Enemy Lines)
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
 * PICK_CARDS -> ORDER_UNITS -> MOVEMENT -> BATTLE -> END_OF_TURN -> (next turn). Both sides start
 * on turn 1; the defender's units start a shot short instead (`startingSupplies`). A side with a
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
  /** This device's side attacks: it fires first, and its units start with all their ammo and shells */
  readonly attacking: boolean;
  /** Shots at range roll the 8-sided long-range die */
  readonly longRangeDie: boolean;
  /** What the enemy starts with (from the scenario), so a shot only asks whether its target is infantry when it has both */
  readonly targetKinds: TargetKinds;
  /** The enemy has infantry, which can camouflage: a shot at range asks whether the target is camouflaged */
  readonly enemyCamouflage: boolean;
  /** Test mode: plenty of coins, and cards have no cooldown */
  readonly testMode: boolean;
  /** Experimental rule: artillery destroyed in the battle turns into an infantry unit */
  readonly artilleryCrew: boolean;
  /** Pass and play: units have figures and take hits */
  readonly figures: boolean;
  readonly board: BoardManager;
  /** The command cards this side holds all game, at its cost (the scenario's air, big guns and prices) */
  readonly cards: readonly HeldCard[];

  private turn = 1;
  private phase: TurnPhase;
  /** The card played this turn, or null for none */
  private playedCard: ActionCard | null = null;
  /** The turn each card was last played, by id, for its cooldown */
  private cardsPlayedOn: Record<string, number> = {};
  private orders: Order[] = [];
  private battleEdits: BattleEdit[] = [];
  private shots: Shot[] = [];
  private unmovedFireSkipped = false;
  private log: TurnRecord[] = [];
  /** Coins at the start of this turn; this turn's ledger adds to it */
  private startCoins = STARTING_COINS;
  private coinAdjustments: number[] = [];
  private markers: Position[] = [];
  private cardAttacks: CardAttack[] = [];
  private standingCollisions: StandingCollisionRoll[] = [];
  /** Pass and play: each unit's figures and the hits each has taken (kept from turn to turn); a unit missing is at full strength */
  private figureHits = new Map<Unit, Figures>();
  /** Pass and play: flags each unit took this turn: one pins it, each more makes it retreat a hex at once */
  private retreatFlags = new Map<Unit, number>();
  /** Pass and play: hexes each unit must still retreat now */
  private retreatsDue = new Map<Unit, number>();
  /** Pass and play: hits each unit has taken this turn, shown on the map until the turn ends */
  private turnHits = new Map<Unit, number>();
  /** Pass and play: infantry-symbol hits each unit given Take Cover has ignored this turn */
  private coverHits = new Map<Unit, number>();
  /** Units with the camouflage badge, kept from turn to turn until they move or battle (`camouflagedUnits`) */
  private camouflaged = new Set<Unit>();
  /** Each unit's luck meter (game-core/luck.ts), kept from turn to turn; a unit missing here is at 0 */
  private luck = new Map<Unit, number>();
  /** Each unit's supplies and luck as the orders were confirmed, to show what the turn changed; null before */
  private turnStart: { supplies: Map<Unit, UnitSupplies>; luck: Map<Unit, number> } | null = null;
  /** What each unit has left, kept from turn to turn; a unit missing here is full (`suppliesOf`) */
  private supplies = new Map<Unit, UnitSupplies>();
  /** Pass and play: where the enemy units are, from the match; null in the one-side game */
  private enemyView: (() => readonly EnemyUnit[]) | null = null;
  private drops: Position[] = [];
  private readonly random: () => number;

  private readonly listeners = new Set<() => void>();
  private snapshot: GameSnapshot;

  constructor({
    scenario,
    faction,
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
    this.enemyCamouflage = this.targetKinds.infantry;
    this.phase = this.paradrop() ? TurnPhase.PARADROP : TurnPhase.PICK_CARDS;
    this.board = new BoardManager(scenario, faction);
    for (const hex of this.board.getAllHexes()) if (hex.unit) this.fillSupplies(hex.unit);
    this.cards = cardsOf(scenario, faction);
    if (testMode) this.startCoins = TEST_MODE_COINS;
    this.snapshot = this.createSnapshot();
  }

  // --- subscription (arrow functions so they can be passed around unbound)

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GameSnapshot => this.snapshot;

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
    const unit = this.placeNewUnit(position, paradrop.unitType);
    if (!unit) return false;

    this.fillSupplies(unit);
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

  /** A unit that starts the game gets its supplies: the defender's a shot short (`startingSupplies`) */
  private fillSupplies(unit: Unit) {
    this.supplies.set(unit, startingSupplies(unit.getUnitType(), unit.elite, !this.attacking));
  }

  undoDrop(): boolean {
    const last = this.drops.at(-1);
    if (this.phase !== TurnPhase.PARADROP || !last) return false;

    const unit = this.board.removeUnitAt(last);
    if (unit) this.supplies.delete(unit);
    this.drops = this.drops.slice(0, -1);
    return this.publish();
  }

  /** All the paratroopers that landed are placed (the others missed the board or hit a unit): start */
  finishParadrop(): boolean {
    if (this.phase !== TurnPhase.PARADROP) return false;

    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  /** What the units suffered and rolled in this turn's battle, which lasts until the turn ends */
  private clearTurnDamage() {
    this.standingCollisions = [];
    this.retreatFlags = new Map();
    this.retreatsDue = new Map();
    this.turnHits = new Map();
    this.coverHits = new Map();
  }

  // --- PICK_CARDS

  /** What the card costs this side (the scenario may make it cheaper) */
  private costOf(card: ActionCard): number {
    return this.cards.find((held) => held.card.id === card.id)?.cost ?? card.cost;
  }

  /** The side holds the card, it's past its cooldown and the side has the coins for it */
  private canPlay(card: ActionCard): boolean {
    if (!this.cards.some((held) => held.card.id === card.id)) return false;
    if (!this.testMode && !isReady(this.cardsPlayedOn[card.id], this.turn)) return false;
    return this.costOf(card) <= this.coins();
  }

  /** Play a command card, paid now, or none (null): either way the orders come next */
  pickCard(card: ActionCard | null): boolean {
    if (this.phase !== TurnPhase.PICK_CARDS) return false;
    if (card && !this.canPlay(card)) return false;

    this.playedCard = card;
    this.phase = TurnPhase.ORDER_UNITS;
    return this.publish();
  }

  /** The card picked can still be taken back: giving orders, none given nor hexes marked yet */
  private canUnpickCard(): boolean {
    return this.phase === TurnPhase.ORDER_UNITS && this.orders.length === 0 && this.markers.length === 0;
  }

  /** Go back to choosing a card, before any order is given or hex marked; its coins come back */
  unpickCard(): boolean {
    if (!this.canUnpickCard()) return false;

    this.playedCard = null;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  // --- ORDER_UNITS: any unit can be given one of its actions; a unit with no order rests

  /** Own tablets: no morale is tracked, so only the actions they offer (pass and play has figures) */
  private get ownTablets(): boolean {
    return !this.figures;
  }

  /** What the unit has left: full until it first spends something */
  private suppliesOf(unit: Unit): UnitSupplies {
    return this.supplies.get(unit) ?? fullSupplies(unit.getUnitType(), unit.elite);
  }

  private refusalOf(unit: Unit, action: UnitAction): ActionRefusal | null {
    const position = this.positionOf(unit);
    return actionRefusal(action, {
      unitType: unit.getUnitType(),
      supplies: this.suppliesOf(unit),
      ownTablets: this.ownTablets,
      ...(this.figures && { wounds: this.woundsOf(unit) }),
      elite: unit.elite,
      sandbags: !!position && !!this.board.getHex(position)?.sandbags,
      camouflaged: this.camouflaged.has(unit),
    });
  }

  /** Pass and play: whether the unit has lost a figure (for Medic) and has one hit but not lost (for Mechanic) */
  private woundsOf(unit: Unit): { lost: boolean; damaged: boolean } {
    const figures = this.figuresOf(unit);
    return { lost: figures.length < FIGURES[unit.getUnitType()].figures, damaged: damagedFigures(figures) > 0 };
  }

  /** Pass and play: the unit's figures, each with the hits it has taken */
  private figuresOf(unit: Unit): Figures {
    return this.figureHits.get(unit) ?? freshFigures(unit.getUnitType());
  }

  /** The unit has an action it can be given */
  private canOrder(unit: Unit): boolean {
    return actionsFor(unit.getUnitType(), this.ownTablets).some((action) => this.refusalOf(unit, action) === null);
  }

  /** Where the unit's order is in the turn's list, -1 with none */
  private orderIndexOf(unit: Unit): number {
    return this.orders.findIndex((order) => order.unit === unit);
  }

  /**
   * Whether the unit at `hex` can be given an action now, and whether that action may move it:
   * no order yet, or an order that holds, which the new one replaces. It may move then only when
   * that order is the last one, since a later order may have moved through the hex it would leave
   * free (and undoing that one moves it back there). An order that moved is changed by undoing it
   */
  private orderableAt(hex: Hex | null | undefined): { unit: Unit; canMove: boolean } | null {
    const unit = hex?.unit;
    if (this.phase !== TurnPhase.ORDER_UNITS || !unit) return null;
    const index = this.orderIndexOf(unit);
    if (index === -1) return { unit, canMove: true };
    const order = this.orders[index]!;
    if (!samePosition(order.start, order.end)) return null;
    return { unit, canMove: index === this.orders.length - 1 };
  }

  /** The unit's actions and why it can't be given each one, or null if it can't be ordered now */
  getActions(position: Position): ActionOption[] | null {
    const found = this.orderableAt(this.board.getHex(position));
    if (!found) return null;
    return actionsFor(found.unit.getUnitType(), this.ownTablets).map((action) => ({
      action,
      refusal: this.refusalOf(found.unit, action),
      cost: actionCost(action, this.ownTablets),
    }));
  }

  /**
   * Where the unit at `position` can move with the action, or null if it can't be given it now.
   * With no action, the moves of the plain actions it can be given (Firefight, Assault, Move Out…:
   * the computer's moves, `issueOrder`)
   */
  getMoveOptions(position: Position, actionId?: string): MoveOptions | null {
    const hex = this.board.getHex(position);
    const found = this.orderableAt(hex);
    if (!hex || !found) return null;
    const actions = actionId === undefined ? this.plainActions(found.unit) : [actionById(actionId)];
    const plans = actions.flatMap((action) =>
      action && this.refusalOf(found.unit, action) === null ? [this.movePlan(hex, action, found.canMove)] : []
    );
    if (plans.length === 0) return null;

    const keys = (range: (plan: (typeof plans)[number]) => Map<string, Position[]>) =>
      new Set(plans.flatMap((plan) => [...range(plan).keys()]));
    return {
      moves: [...keys((plan) => plan.paths(plan.limits.maxMove))].map(fromKey),
      moveAndFire: [...keys((plan) => plan.paths(plan.limits.moveAndFire, true))].map(fromKey),
      limits: {
        maxMove: Math.max(...plans.map((plan) => plan.limits.maxMove)),
        moveAndFire: Math.max(...plans.map((plan) => plan.limits.moveAndFire)),
        holdShots: Math.max(...plans.map((plan) => plan.limits.holdShots)),
      },
    };
  }

  /** The plain actions the unit can be given, in the order they're tried */
  private plainActions(unit: Unit): UnitAction[] {
    return plainActionsFor(unit.getUnitType()).filter((action) => this.refusalOf(unit, action) === null);
  }

  /**
   * The action's move limits and paths (none when it may not move); it can't end on (or next to)
   * a hex marked for an attack. A unit with nothing left to fire moves but doesn't fire (armour).
   * `follows` checks a path the player picked hex by hex
   */
  private movePlan(hex: Hex, action: UnitAction, canMove = true) {
    const unit = hex.unit;
    const dry = !!unit && !canFireAShot(unit.getUnitType(), this.suppliesOf(unit));
    const full = moveLimitsOf(action);
    const fires = dry ? { ...full, moveAndFire: 0, holdShots: 0 } : full;
    const limits = canMove ? fires : { ...fires, maxMove: 0, moveAndFire: 0 };
    const rules = moveRulesOf(action);
    const endsOk = (key: string) => !this.breaksMark(fromKey(key));
    return {
      limits,
      paths: (range: number, forFire = false) =>
        new Map([...this.board.getAllPaths(hex, range, forFire, rules)].filter(([key]) => endsOk(key))),
      follows: (path: readonly Position[], range: number, forFire = false) => this.board.followsPath(hex, path, range, forFire, rules),
      endsOk: (position: Position) => endsOk(positionKey(position)),
    };
  }

  /**
   * Pass and play, a path picked hex by hex: the hexes the unit at `position` can step to next
   * after `path` (which starts on its hex), and those it could still fire from if it stopped there
   */
  getNextSteps(position: Position, actionId: string, path: readonly Position[]): { moves: Position[]; moveAndFire: Position[] } | null {
    const hex = this.board.getHex(position);
    const found = this.orderableAt(hex);
    const action = actionById(actionId);
    if (!hex || !found || !action || this.refusalOf(found.unit, action) !== null) return null;
    const plan = this.movePlan(hex, action, found.canMove);
    const last = this.board.getHex(path.at(-1) ?? position);
    if (!last) return null;
    const next = last.getNeighbors().filter((step) => plan.follows([...path, step], plan.limits.maxMove));
    return {
      moves: next,
      moveAndFire: next.filter((step) => plan.endsOk(step) && plan.follows([...path, step], plan.limits.moveAndFire, true)),
    };
  }

  /**
   * Give the unit at `from` an action, moving to `to` (holding when `to` equals `from`). A unit
   * whose order holds gets the new action in its place. Its cost is paid when the orders are
   * confirmed
   */
  giveAction(from: Position, actionId: string, to: Position, path?: readonly Position[]): boolean {
    const hex = this.board.getHex(from);
    const found = this.orderableAt(hex);
    const action = actionById(actionId);
    if (!hex || !found || !action || this.refusalOf(found.unit, action) !== null) return false;
    const { unit, canMove } = found;
    const plan = this.movePlan(hex, action, canMove);

    let order: Order;
    const props = { unit, action: action.id, start: from, end: to };
    // A unit in the ocean can't fire (house rule)
    const noFire = !!this.board.getHex(to)?.getTerrain().noFire;
    if (samePosition(from, to)) {
      order = new Order({ ...props, path: [from], shots: noFire ? 0 : plan.limits.holdShots });
    } else {
      // Paths must be found before moving: afterwards the start hex is empty and the destination taken.
      // A path the player picked (pass and play) must end on `to` and keep to the move's rules
      const picked = !!path && samePosition(path.at(-1) ?? from, to) && plan.endsOk(to) && plan.follows(path!, plan.limits.maxMove) ? [...path!] : null;
      if (path && !picked) return false;
      const route = picked ?? plan.paths(plan.limits.maxMove).get(positionKey(to));
      const canFire = !noFire && (picked ? plan.follows(picked, plan.limits.moveAndFire, true) : plan.paths(plan.limits.moveAndFire, true).has(positionKey(to)));
      if (!route) return false;
      const lostSandbags = this.moveUnit(from, to);
      if (!lostSandbags) return false;
      const clearedWire = this.clearWire(unit, to);
      order = new Order({ ...props, path: route, shots: canFire ? shotsOf(action) : 0, lostSandbags, clearedWire });
    }

    const index = this.orderIndexOf(unit);
    this.orders = index === -1 ? [...this.orders, order] : this.orders.map((each, i) => (i === index ? order : each));
    return this.publish();
  }

  /**
   * Order the unit at `from` to move to `to`, or to hold when `to` equals `from`, with the plain
   * action for that move: one that can fire there if any, else the cheapest that gets there
   * (Firefight to hold; Assault, Move Out, Motorized to move). False when none it can pay for does
   */
  issueOrder(from: Position, to: Position): boolean {
    const hex = this.board.getHex(from);
    const found = this.orderableAt(hex);
    if (!hex || !found) return false;
    const options = this.plainActions(found.unit).map((action) => {
      const plan = this.movePlan(hex, action, found.canMove);
      const holds = samePosition(from, to);
      return {
        action,
        // A hold is an action that doesn't move (Firefight), not a move of 0 paid for
        reaches: holds ? action.move === 0 : plan.paths(plan.limits.maxMove).has(positionKey(to)),
        fires: holds ? plan.limits.holdShots > 0 : plan.paths(plan.limits.moveAndFire, true).has(positionKey(to)),
      };
    });
    const chosen = plainActionForMove(options);
    return !!chosen && this.giveAction(from, chosen.action.id, to);
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
    return this.publish();
  }

  // --- MOVEMENT: the orders are shown to the opponent and carried out on the table

  /** Confirm the orders and move on to the movement phase; from here on they can't change. Each action is paid now */
  commitOrders(): boolean {
    if (this.phase !== TurnPhase.ORDER_UNITS) return false;
    if (this.markersLeft() > 0) return false;

    this.phase = TurnPhase.MOVEMENT;
    for (const order of this.orders) {
      const action = actionById(order.action);
      const paid = action && pay(this.suppliesOf(order.unit), actionCost(action, this.ownTablets));
      if (!paid) continue;
      this.supplies.set(order.unit, paid);
      this.carryOut(order, action);
    }
    this.refillByCard();
    this.markTurnStart();
    return this.publish();
  }

  /** Each unit's supplies and luck now, the orders paid: what the turn's changes are counted from */
  private markTurnStart() {
    const units = this.board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : []));
    this.turnStart = {
      supplies: new Map(units.map((unit) => [unit, this.suppliesOf(unit)])),
      luck: new Map(units.map((unit) => [unit, this.luckOf(unit)])),
    };
  }

  /** What this side's units lost or gained since the orders were confirmed */
  private turnChanges(): UnitChange[] {
    const start = this.turnStart;
    if (!start) return [];
    return this.board.getAllHexes().flatMap((hex) => {
      const unit = hex.unit;
      const before = unit && start.supplies.get(unit);
      if (!unit || !before) return [];
      const now = this.suppliesOf(unit);
      const shots = (supplies: UnitSupplies) => amountOf(supplies, Supply.AMMO) + amountOf(supplies, Supply.SHELLS);
      const change = {
        position: hex.getPosition(),
        morale: amountOf(now, Supply.MORALE) - amountOf(before, Supply.MORALE),
        ammo: shots(now) - shots(before),
        luck: this.luckOf(unit) - (start.luck.get(unit) ?? 0),
      };
      return change.morale !== 0 || change.ammo !== 0 || Math.abs(change.luck) > 1e-9 ? [change] : [];
    });
  }

  /**
   * What the action does as the orders are revealed, besides moving and firing: Reload, Morale Up,
   * sandbags for Fortify, and in pass and play Medic and Mechanic (on own tablets the table does
   * those, `tableReminders`). Camouflage, Take Cover and Behind Enemy Lines' move come later
   */
  private carryOut(order: Order, action: UnitAction) {
    const { unit } = order;
    const full = fullSupplies(unit.getUnitType(), unit.elite);
    const supplies = this.suppliesOf(unit);
    switch (action.effect) {
      case "reload":
        this.supplies.set(unit, reload(supplies, full));
        break;
      case "moraleUp":
        this.supplies.set(unit, refill(supplies, full, [Supply.MORALE]));
        break;
      case "medic":
        if (this.figures) this.setFigures(unit, healFigure(this.figuresOf(unit), unit.getUnitType()));
        break;
      case "mechanic":
        if (this.figures) this.setFigures(unit, mendFigure(this.figuresOf(unit)));
        break;
      case "fortify": {
        const hex = this.board.getHex(order.end);
        if (hex && !hex.sandbags) {
          hex.setSandbags(true);
          this.addBattleEdit({ kind: "sandbags", position: { ...order.end }, placed: true, fortify: true });
        }
        break;
      }
    }
  }

  private setFigures(unit: Unit, figures: Figures) {
    this.figureHits = new Map(this.figureHits).set(unit, figures);
  }

  /**
   * The card played refills as the orders are revealed: Resupply gives all infantry its morale,
   * ammo and equipment back (a unit at morale 0 too), Refuel tops up the fuel of tanks and artillery
   */
  private refillByCard() {
    const kind = this.playedCard?.effect.kind;
    if (kind !== "resupply" && kind !== "refuel") return;
    for (const hex of this.board.getAllHexes()) {
      const unit = hex.unit;
      if (!unit) continue;
      const infantry = unit.getUnitType() === UnitType.INFANTRY;
      if (infantry !== (kind === "resupply")) continue;
      const full = fullSupplies(unit.getUnitType(), unit.elite);
      const refilled = kind === "resupply" ? refill(this.suppliesOf(unit), full, [Supply.MORALE, Supply.AMMO], { equipment: true }) : refill(this.suppliesOf(unit), full, [Supply.FUEL]);
      this.supplies.set(unit, refilled);
    }
  }

  // --- Pass and play: figures, hits and retreats

  /** Figures left of the unit on this hex; null without one, or in the one-side game */
  figuresAt(position: Position): number | null {
    const unit = this.board.getHex(position)?.unit;
    if (!this.figures || !unit) return null;
    return this.figuresOf(unit).length;
  }

  /** Pass and play: the unit on this hex took a flag this turn: it's pinned (infantry fires with a die less) */
  isPinned(position: Position): boolean {
    const unit = this.board.getHex(position)?.unit;
    return !!unit && (this.retreatFlags.get(unit) ?? 0) > 0;
  }

  /** Pass and play: the unit on this hex was made to retreat this turn (a second flag), so it doesn't battle any more */
  hasRetreated(position: Position): boolean {
    const unit = this.board.getHex(position)?.unit;
    return !!unit && this.retreated(unit);
  }

  private retreated(unit: Unit): boolean {
    return (this.retreatFlags.get(unit) ?? 0) > 1;
  }

  /** Pass and play: the unit on this hex must retreat now, a hex per flag after its first */
  mustRetreat(position: Position): boolean {
    const unit = this.board.getHex(position)?.unit;
    return !!unit && (this.retreatsDue.get(unit) ?? 0) > 0;
  }

  /**
   * The enemy's roll hit the unit on this hex (pass and play): it takes `hits` (`hitFaces` are
   * the faces that hit) and, if it survives, `flags`. Its first flag this turn pins it; each flag
   * after that is a hex it must retreat at once (`retreatOptions`), and it doesn't battle any
   * more this turn. A unit that loses its last figure is removed; artillery leaves its crew
   * behind, `ARTILLERY_CREW_FIGURES` infantry figures
   */
  sufferHits(position: Position, rolledHits: number, flags: number, hitFaces: readonly DieFace[] = []): boolean {
    const unit = this.board.getHex(position)?.unit;
    if (!this.figures || !unit || rolledHits < 0 || flags < 0) return false;
    const hits = rolledHits - this.takeCover(unit, hitFaces);
    // Each flag on infantry costs it a point of morale, besides pinning it or making it retreat
    if (flags > 0 && unit.getUnitType() === UnitType.INFANTRY) {
      const supplies = this.suppliesOf(unit);
      const morale = Math.max(0, amountOf(supplies, Supply.MORALE) - flags);
      this.supplies.set(unit, { ...supplies, amounts: { ...supplies.amounts, [Supply.MORALE]: morale } });
    }
    const left = takeHits(this.figuresOf(unit), hits, hitsPerFigure(unit.getUnitType(), unit.elite));
    if (left.length > 0) {
      if (hits > 0) {
        this.setFigures(unit, left);
        this.turnHits = new Map(this.turnHits).set(unit, (this.turnHits.get(unit) ?? 0) + hits);
      }
      if (flags > 0) {
        const before = this.retreatFlags.get(unit) ?? 0;
        const after = before + flags;
        this.retreatFlags = new Map(this.retreatFlags).set(unit, after);
        // The first flag only pins it: the rest are hexes to retreat
        const hexes = Math.max(0, after - 1) - Math.max(0, before - 1);
        if (hexes > 0) this.retreatsDue = new Map(this.retreatsDue).set(unit, (this.retreatsDue.get(unit) ?? 0) + hexes);
      }
      return this.publish();
    }

    this.board.removeUnitAt(position);
    const damage = new Map(this.figureHits);
    damage.delete(unit);
    const flagged = new Map(this.retreatFlags);
    flagged.delete(unit);
    const due = new Map(this.retreatsDue);
    due.delete(unit);
    const crew = unit.getUnitType() === UnitType.ARTILLERY ? new Unit(UnitType.INFANTRY) : undefined;
    if (crew) {
      this.board.placeUnitAt(position, crew);
      damage.set(crew, freshFigures(UnitType.INFANTRY, ARTILLERY_CREW_FIGURES));
    }
    this.figureHits = damage;
    this.retreatFlags = flagged;
    this.retreatsDue = due;
    const hitThisTurn = new Map(this.turnHits);
    hitThisTurn.delete(unit);
    this.turnHits = hitThisTurn;
    const covered = new Map(this.coverHits);
    covered.delete(unit);
    this.coverHits = covered;
    // The sandbags go with the unit; a crew left behind stays behind them
    const hex = this.board.getHex(position)!;
    const sandbags = hex.sandbags && !crew;
    if (sandbags) hex.setSandbags(false);
    this.addBattleEdit({ kind: "remove", position, unit, ...(crew && { replacement: crew }), ...(sandbags && { sandbags }) });
    return this.publish();
  }

  /**
   * Take Cover: of the hits on a unit given it, the infantry-symbol ones are ignored, up to
   * `TAKE_COVER_HITS` this turn (grenades still hit). Returns how many of these it ignores
   */
  private takeCover(unit: Unit, hitFaces: readonly DieFace[]): number {
    const covering = this.orders.some((order) => order.unit === unit && actionById(order.action)?.effect === "takeCover");
    if (!covering) return 0;
    const used = this.coverHits.get(unit) ?? 0;
    const ignored = Math.min(TAKE_COVER_HITS - used, hitFaces.filter((face) => face === DieFace.INFANTRY).length);
    if (ignored > 0) this.coverHits = new Map(this.coverHits).set(unit, used + ignored);
    return Math.max(0, ignored);
  }

  /**
   * Pass and play: where the unit on this hex can retreat one hex, toward its own edge (the
   * bottom of this side's view): the two hexes behind it that are free and passable. None from
   * the ocean, where each hex to retreat is a hit (`retreatBlocked`)
   */
  retreatOptions(position: Position): Position[] {
    if (!this.mustRetreat(position) || this.board.getHex(position)!.getTerrain().noRetreat) return [];
    const enemies = new Set((this.enemyView?.() ?? []).map((enemy) => positionKey(enemy.position)));
    return this.board
      .getHex(position)!
      .getNeighbors()
      .filter((next) => next.row === position.row + 1)
      .filter((next) => !!this.board.getHex(next)?.isPassable() && !enemies.has(positionKey(next)));
  }

  /** Pass and play: the unit retreats one hex, one of `retreatOptions`; it has a hex less to go */
  retreatTo(position: Position, to: Position): boolean {
    if (!includesPosition(this.retreatOptions(position), to)) return false;
    const unit = this.board.getHex(position)!.unit!;
    const sandbags = this.moveUnit(position, to);
    if (!sandbags) return false;
    this.retreatsDue = this.countDown(this.retreatsDue, unit);
    this.addBattleEdit({ kind: "move", from: { ...position }, to: { ...to }, unit, ...(sandbags.length > 0 && { sandbags }) });
    return this.publish();
  }

  /** Pass and play: the unit can't retreat this hex (nowhere free behind it): it takes a hit instead */
  retreatBlocked(position: Position): boolean {
    if (!this.mustRetreat(position) || this.retreatOptions(position).length > 0) return false;
    const unit = this.board.getHex(position)!.unit!;
    this.retreatsDue = this.countDown(this.retreatsDue, unit);
    // One hit per hex it can't retreat: a figure of infantry, half an armour figure
    return this.sufferHits(position, 1, 0);
  }

  private countDown(counts: ReadonlyMap<Unit, number>, unit: Unit): Map<Unit, number> {
    const next = new Map(counts);
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
      const figures = this.figuresOf(unit).length;
      const damaged = damagedFigures(this.figuresOf(unit)) > 0;
      const hitThisTurn = this.turnHits.get(unit) ?? 0;
      const pinned = (this.retreatFlags.get(unit) ?? 0) > 0;
      const retreats = this.retreatsDue.get(unit) ?? 0;
      return [{ position: hex.getPosition(), figures, pinned, retreats, damaged, hitThisTurn }];
    });
  }

  // --- Pass and play: the app carries out both sides' moves at once (PassAndPlayMatch)

  /**
   * Cut orders short where their units stopped: a collision, or one of their own units on the
   * hex it was to end on. Each stop is a hex of the order's path before its end. Only in the movement phase
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
   * (it moved too far, or into terrain it can't fire from), nor once it's been made to retreat,
   * nor with no ammo or shells left for the roll, nor at morale 0
   */
  canRollCollision(position: Position, order: number | null): boolean {
    if (order !== null && !this.orders[order]?.canFire) return false;
    const unit = this.board.getHex(position)?.unit;
    if (unit && !this.canPayCollision(unit)) return false;
    return !this.hasRetreated(position);
  }

  /** The unit has the ammo or shell a collision spends, and some morale (a type without morale always does) */
  private canPayCollision(unit: Unit): boolean {
    const supplies = this.suppliesOf(unit);
    if (supplies.amounts[Supply.MORALE] === 0) return false;
    return pay(supplies, plainFireOption(unit.getUnitType()).cost) !== null;
  }

  /**
   * Pass and play: this side's unit at `position` rolls in a collision against an enemy unit
   * that is or isn't infantry: its close assault dice minus 1, terrain ignored. `order` is its
   * order's index (the roll is then its shot this turn), or null for a unit without an order
   */
  rollCollision(position: Position, infantry: boolean, order: number | null): boolean {
    if (this.phase !== TurnPhase.MOVEMENT) return false;
    const unit = this.board.getHex(position)?.unit;
    if (!unit) return false;
    const ordered = order === null ? null : this.orders[order];
    if (ordered === undefined || (ordered && ordered.unit !== unit)) return false;
    if (!ordered && this.orders.some((o) => o.unit === unit)) return false;
    if (!this.canRollCollision(position, order)) return false;

    const context: FireContext = {
      unitType: unit.getUnitType(),
      combatBonuses: ordered ? this.combatBonusesFor(order!) : [],
      pinned: this.isPinned(position),
    };
    const steps = collisionSteps(context);
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    const target: ShotTarget = { infantry, closeAssault: true, die: "battle" };
    const option = plainFireOption(unit.getUnitType());
    if (ordered) {
      const combatBonus = combatBonusDice(context, true) > 0;
      return this.recordShot(order!, { dice, steps, notes: [...COLLISION_NOTES], target, collision: true, combatBonus, option });
    }

    this.spend(unit, option.cost);
    const roll: StandingCollisionRoll = {
      from: { ...position },
      unitType: unit.getUnitType(),
      steps,
      dice,
      faces: this.rollFaces(dice, steps, target, unit),
      notes: [...COLLISION_NOTES],
      collision: true,
      target,
      combatBonus: false,
      kept: null,
      spent: option.cost,
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
   * Move on to the final phase; units that haven't fired lose their shot. The Reinforcements
   * card's unit arrives on its cross if the hex is still empty.
   */
  endBattle(): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;

    this.phase = TurnPhase.END_OF_TURN;
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
      new Set([...this.retreatFlags.keys()].filter((unit) => this.retreated(unit))),
      new Set(this.orders.flatMap((order) => (canFireAShot(order.unit.getUnitType(), this.suppliesOf(order.unit)) ? [] : [order.unit])))
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

  /** The extra dice the card played gives this order's unit on every shot (Finest Hour) */
  combatBonusesFor(orderIndex: number): CombatBonus[] {
    const extra = this.playedEffect("extraDice");
    if (!this.orders[orderIndex] || !extra) return [];
    return [{ name: this.playedCard!.name, dice: extra.dice }];
  }

  /** The effect of the card played this turn, if it's of this kind */
  private playedEffect<K extends ActionCardEffect["kind"]>(kind: K): Extract<ActionCardEffect, { kind: K }> | null {
    const effect = this.playedCard?.effect;
    return effect?.kind === kind ? (effect as Extract<ActionCardEffect, { kind: K }>) : null;
  }

  // Attack cards: one roll per marked hex, before any other shot

  /** The marked hexes the attack card played rolls on */
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
   * Roll the attack card on a marked hex, on the attack die: `infantry`
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
  /** What the fire questions need to know about this unit's next shot, fired with this option */
  private fireContextFor(
    orderIndex: number,
    option?: FireOption,
    /** The order's summary and the enemy units, when the caller has them already */
    known: { summary?: OrderSummary; enemies?: readonly EnemyUnit[] } = {},
  ): FireContext | null {
    const order = this.orders[orderIndex];
    const summary = known.summary ?? this.summaries()[orderIndex];
    if (!order || !summary) return null;
    return {
      unitType: order.unit.getUnitType(),
      closeAssaultOnly: summary.closeAssaultOnly || !!option?.closeAssaultOnly,
      combatBonuses: this.combatBonusesFor(orderIndex),
      ...(option && { fireOption: option }),
      moved: !samePosition(order.start, order.end) || summary.tookGround,
      fromTerrain: this.board.getHex(summary.firingFrom)?.getType(),
      fromWire: this.board.getHex(summary.firingFrom)?.wire ?? false,
      fromFord: !!this.board.getHex(summary.firingFrom)?.getTerrain().ford,
      // Pass and play knows each enemy unit's badge, so it's always answered
      enemyCamouflage: this.enemyView !== null || this.enemyCamouflage,
      // Pass and play knows whether the unit is pinned; on own tablets the player says
      ...(this.figures && { pinned: this.isPinned(summary.firingFrom) }),
      // Pass and play knows whether an enemy is next to the unit; on own tablets the player says
      ...(this.enemyView && {
        adjacentEnemy: (known.enemies ?? this.enemyView()).some((enemy) => hexDistance(enemy.position, summary.firingFrom) === 1),
      }),
    };
  }

  /**
   * How the unit of this order may fire its next shot: each of its type's fire options, and what
   * it lacks for it. Empty when it can't fire now
   */
  fireOptions(orderIndex: number): FireOptionChoice[] {
    const order = this.orders[orderIndex];
    if (!order || this.shotsLeft(orderIndex) <= 0) return [];
    const supplies = this.suppliesOf(order.unit);
    return fireOptionsFor(order.unit.getUnitType()).map((option) => ({ option, refusal: fireOptionRefusal(option, supplies) }));
  }

  /**
   * What the fire questions know about this unit's next shot fired with this option (its plain
   * one when left out), for the dialog to work out the dice as the session will; null when it
   * can't fire so
   */
  fireContextOf(orderIndex: number, optionId?: string): FireContext | null {
    const option = this.fireOptionFor(orderIndex, optionId);
    return option && this.fireContextFor(orderIndex, option);
  }

  /** The fire option named for this order's next shot (its plain one when left out), or null when it can't fire so */
  private fireOptionFor(orderIndex: number, optionId?: string): FireOption | null {
    const order = this.orders[orderIndex];
    if (!order) return null;
    const unitType = order.unit.getUnitType();
    const option = optionId === undefined ? plainFireOption(unitType) : fireOptionById(optionId);
    if (!option || option.unitType !== unitType) return null;
    return fireOptionRefusal(option, this.suppliesOf(order.unit)) === null ? option : null;
  }

  /**
   * The hexes this unit can fire at from where it stands (or the hex it took
   * ground on): in range, and whether each is in sight and how many dice it gets.
   * With a fire option, as it fires so (Explosives: only in close assault)
   */
  fireTargetsFor(orderIndex: number, optionId?: string): FireTarget[] {
    const option = this.fireOptionFor(orderIndex, optionId);
    const context = option && this.fireContextFor(orderIndex, option);
    if (this.phase !== TurnPhase.BATTLE || !context) return [];
    const enemies = this.seenEnemies()?.map((enemy) => enemy.position);
    return fireTargets(this.board, this.summaries()[orderIndex]!.firingFrom, context, enemies);
  }

  /**
   * Pass and play: the match tells the session where the enemy units are. Then only they are
   * targets, they block the view, and a shot knows its target's type and sandbags
   */
  setEnemyView(view: () => readonly EnemyUnit[]) {
    this.enemyView = view;
  }

  /** Pass and play: the enemy units this side can see (all of them without fog of war) */
  private seenEnemies(): EnemyUnit[] | undefined {
    return this.enemyView?.().filter((enemy) => !enemy.hidden);
  }

  /** Pass and play: the enemy unit this side sees on this hex (this side's view), if any; `hidden` finds one in the fog too */
  enemyAt(position: Position, { hidden = false }: { hidden?: boolean } = {}): EnemyUnit | null {
    return this.enemyView?.().find((enemy) => samePosition(enemy.position, position) && (hidden || !enemy.hidden)) ?? null;
  }

  /**
   * Pass and play: this side's units destroyed so far, by type (an artillery whose crew stayed
   * counts), from the finished turns' logs and this turn's map changes
   */
  unitsLost(): UnitType[] {
    const logged = this.log.flatMap((turn) => turn.battleEdits.flatMap((edit) => (edit.kind === "remove" ? [edit.unit] : [])));
    const now = this.battleEdits.flatMap((edit) => (edit.kind === "remove" ? [edit.unit.getUnitType()] : []));
    return [...logged, ...now];
  }

  /** The battle's order summaries, as the snapshot's (for the pass and play match) */
  orderSummaries() {
    return this.summaries();
  }

  /**
   * Fire answering the questionnaire by hand (the answers include the distance and the target's
   * terrain). Left out, the answer about an enemy next to the unit is no
   */
  fire(orderIndex: number, answers: FireAnswers, optionId?: string): boolean {
    return this.fireWith(orderIndex, { [ADJACENT_ENEMY_ANSWER]: "no", ...answers }, optionId);
  }

  /**
   * Fire at a hex picked on the map: its distance and terrain answer those
   * questions. Only a hex in range and in sight, where the shot gets dice.
   * Sandbags are the player's answer: the enemy's aren't known here.
   */
  fireAt(orderIndex: number, choice: FireChoice): boolean {
    const aim = this.aimAnswers(orderIndex, choice);
    if (!aim) return false;
    return this.fireWith(orderIndex, aim.answers, choice.option, choice.position);
  }

  /** The fire answers for a shot at a hex picked on the map; null when the hex can't be fired at */
  private aimAnswers(
    orderIndex: number,
    choice: FireChoice
  ): { answers: Record<string, string>; target: FireTarget; context: FireContext } | null {
    const { position } = choice;
    let { infantry, sandbags } = choice;
    let camouflaged = choice.camouflaged ?? false;
    const target = this.fireTargetsFor(orderIndex, choice.option).find((t) => samePosition(t.position, position));
    if (!target || !target.lineOfSight || target.dice <= 0) return null;
    const context = this.fireContextFor(orderIndex, this.fireOptionFor(orderIndex, choice.option)!)!;
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
      [PINNED_ANSWER]: choice.pinned ? "yes" : "no",
      [ADJACENT_ENEMY_ANSWER]: choice.adjacentEnemy ? "yes" : "no",
    };
    return { answers, target, context };
  }

  /**
   * Pass and play: the shot this unit would fire at the enemy unit on this hex, before it's
   * rolled: its dice and where they come from, and the die thrown. Null when it can't fire there.
   */
  aimAt(orderIndex: number, position: Position, optionId?: string): ShotAim | null {
    const enemy = this.enemyAt(position);
    if (!enemy || this.shotsLeft(orderIndex) <= 0) return null;
    const aim = this.aimAnswers(orderIndex, { position, infantry: true, sandbags: false, option: optionId });
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

  private fireWith(orderIndex: number, answers: FireAnswers, optionId?: string, targetPosition?: Position): boolean {
    const part = this.shotPart(orderIndex, answers, optionId);
    if (!part) return false;
    const { usedBonus, ...shot } = part;
    return this.recordShot(orderIndex, { ...shot, combatBonus: usedBonus, targetPosition });
  }

  /** The unit's part of a shot with these answers and fire option, or null when it can't fire so now */
  private shotPart(orderIndex: number, answers: FireAnswers, optionId?: string): ShotPart | null {
    if (!this.canFireNow(orderIndex)) return null;
    const option = this.fireOptionFor(orderIndex, optionId);
    if (!option) return null;
    const context = this.fireContextFor(orderIndex, option)!;
    if (nextFireQuestion(FIRE_QUESTIONS, context, answers)) return null;
    if (context.closeAssaultOnly && answers.distance !== "1") return null;

    const { dice, steps, notes, blocked } = calculateFireDice(FIRE_QUESTIONS, context, answers, fireBonusSteps);
    if (blocked) return null;
    const infantry = targetAnswer(answers.targetType);
    if (infantry === null || !this.canBeTarget(infantry)) return null;
    const plain = this.targetFor(infantry, answers.distance === "1");
    // Suppressive Fire rolls the suppressive die of the same shape
    const target = option.die ? { ...plain, die: suppressed(plain.die) } : plain;
    const usedBonus = combatBonusDice(context, answers.distance === "1") > 0;
    return { dice, steps, notes, target, usedBonus, option };
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

  /**
   * The orders whose units have something to do with a shot: an enemy in sight they roll dice at,
   * or barbed wire to remove. A unit with neither is passed over in pass and play's battle. Every
   * order on own tablets, where the app doesn't know where the enemy is. In one pass, as the
   * match asks on every snapshot: an enemy out of range rules a unit out before any line of sight
   */
  ordersWithShotToTake(): ReadonlySet<number> {
    const summaries = this.summaries();
    const enemies = this.seenEnemies();
    if (!enemies) return new Set(summaries.map((summary) => summary.index));
    const all = this.enemyView!();
    const positions = enemies.map((enemy) => enemy.position);
    const hasShot = (summary: OrderSummary) => {
      if (this.board.getHex(summary.firingFrom)?.wire && this.canRemoveWire(summary.index)) return true;
      const range = BASE_DICE_BY_DISTANCE[summary.unitType].length;
      if (!positions.some((position) => hexDistance(position, summary.firingFrom) <= range)) return false;
      const option = this.fireOptionFor(summary.index);
      const context = option && this.fireContextFor(summary.index, option, { summary, enemies: all });
      return !!context && hasFireTarget(this.board, summary.firingFrom, context, positions);
    };
    return new Set(summaries.filter(hasShot).map((summary) => summary.index));
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

  /** Pass and play: the other side took the wire off this hex (a tank went through it, infantry removed it) */
  wireRemovedByEnemy(position: Position): boolean {
    const hex = this.board.getHex(position);
    if (!this.figures || !hex?.wire) return false;
    hex.setWire(false);
    return this.publish();
  }

  // Camouflage: the badge lets only a close assault hit the unit, until it moves or battles

  /** This side's units with the camouflage badge now: those that had it and haven't moved or battled this turn */
  private camouflagedUnits(): Unit[] {
    const onBoard = new Set(this.board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.unit] : [])));
    return [...this.camouflaged].filter((unit) => !this.movedOrBattled(unit) && onBoard.has(unit));
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

  // Moves after the battle (Reposition, Behind Enemy Lines). On their own tablets the player
  // mirrors the table's move with "Actualizar mapa"; pass and play moves it here, one unit at a time

  /** The units that move after the battle this turn (Behind Enemy Lines), why, how far and how */
  private movesAfterBattle(): { unit: Unit; name: Localized; hexes: number; rules: { ignoreTerrain?: boolean } }[] {
    return this.orders.flatMap((order) => {
      const action = actionById(order.action);
      if (!action?.moveAfterBattle) return [];
      return [{ unit: order.unit, name: action.name, hexes: action.moveAfterBattle, rules: moveRulesOf(action) }];
    });
  }

  /** Own tablets: the actions given this turn the table carries out, once the orders are revealed */
  private tableReminders(): TableReminder[] {
    if (this.figures || this.phase === TurnPhase.ORDER_UNITS || this.phase === TurnPhase.PICK_CARDS) return [];
    const forTable = (action: UnitAction) =>
      action.effect === "medic" || action.effect === "mechanic" || action.effect === "takeCover" || !!action.moveAfterBattle;
    return this.orders.flatMap((order) => {
      const action = actionById(order.action);
      return action && forTable(action) ? [{ position: { ...order.end }, action }] : [];
    });
  }

  /** Pass and play, final phase: the next unit that moves after the battle and the hexes it can go to, until each has moved */
  private finalMove(): { from: Position; options: Position[]; name: Localized } | null {
    if (!this.figures || this.phase !== TurnPhase.END_OF_TURN) return null;
    const enemies = new Set((this.enemyView?.() ?? []).map((enemy) => positionKey(enemy.position)));
    for (const { unit, name, hexes, rules } of this.movesAfterBattle()) {
      const from = this.positionOf(unit);
      if (!from || this.battleEdits.some((edit) => edit.kind === "move" && edit.reposition && edit.unit === unit)) continue;
      const options = this.board
        .calculatePossibleMovesWithPaths(this.board.getHex(from)!, hexes, false, rules)
        .filter(({ position, path }) => !samePosition(position, from) && path.every((p) => !enemies.has(positionKey(p))))
        .map(({ position }) => position);
      if (options.length > 0) return { from, options, name };
    }
    return null;
  }

  /** Pass and play: the unit a card moves after the battle goes to one of its hexes, as a map edit */
  makeFinalMove(to: Position): boolean {
    const due = this.finalMove();
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

  /** Pass and play: the unit due to move after the battle stays where it is (an edit that moves it nowhere) */
  skipFinalMove(): boolean {
    const due = this.finalMove();
    if (!due) return false;
    const unit = this.board.getHex(due.from)!.unit!;
    this.addBattleEdit({ kind: "move", from: { ...due.from }, to: { ...due.from }, unit, reposition: true });
    return this.publish();
  }

  /** Pass and play: the hexes the reinforcement may be put on when its cross is taken (free of both armies) */
  reinforcementOptions(): Position[] {
    if (!this.reinforcementToPlace()) return [];
    const enemies = new Set((this.enemyView?.() ?? []).map((enemy) => positionKey(enemy.position)));
    return this.board
      .getAllHexes()
      .filter((hex) => hex.isPassable() && !hex.hasUnit() && !enemies.has(positionKey(hex.getPosition())))
      .map((hex) => hex.getPosition());
  }

  /** The target of a shot: rolled on the long-range die when the game uses it and the target isn't adjacent */
  private targetFor(infantry: boolean, closeAssault: boolean): ShotTarget {
    const die: DieKind = this.longRangeDie && !closeAssault ? "longRange" : "battle";
    return { infantry, closeAssault, die };
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
    if (!this.canPayCollision(order.unit)) return false;

    const context: FireContext = {
      unitType: order.unit.getUnitType(),
      combatBonuses: this.combatBonusesFor(orderIndex),
    };
    const steps = collisionSteps(context);
    const dice = Math.max(0, steps.reduce((sum, step) => sum + step.dice, 0));
    const target: ShotTarget = { infantry, closeAssault: true, die: "battle" };
    const option = plainFireOption(order.unit.getUnitType());
    const combatBonus = combatBonusDice(context, true) > 0;
    return this.recordShot(orderIndex, { dice, steps, notes: [...COLLISION_NOTES], target, collision: true, combatBonus, option });
  }

  /** Take back this unit's last shot, for a shot recorded by mistake */
  undoShot(orderIndex: number): boolean {
    if (this.phase !== TurnPhase.BATTLE) return false;
    const index = this.shots.findLastIndex((shot) => shot.orderIndex === orderIndex);
    if (index === -1) return false;

    const { removedWire: wire, spent, luckBefore } = this.shots[index]!;
    if (wire) this.board.getHex(wire)?.setWire(true);
    const unit = this.orders[orderIndex]!.unit;
    if (luckBefore !== undefined) this.luck = new Map(this.luck).set(unit, luckBefore);
    if (spent) this.supplies.set(unit, refund(this.suppliesOf(unit), spent));
    this.shots = this.shots.filter((_, i) => i !== index);
    return this.publish();
  }

  /**
   * Apply only some of the results of this unit's shot number `shotNumber`
   * (0 for its first shot this turn): `kept` are indexes into its faces, and
   * null applies them all again. Only hits can be left out: flags and supplies
   * always count. The roll itself stays as it was.
   */
  keepResults(orderIndex: number, shotNumber: number, kept: readonly number[] | null): boolean {
    const shot = this.shots.filter((s) => s.orderIndex === orderIndex)[shotNumber];
    if (!shot) return false;
    // A collision is rolled in the movement phase (pass and play)
    if (this.phase !== TurnPhase.BATTLE && !(shot.collision && this.phase === TurnPhase.MOVEMENT)) return false;
    if (kept !== null && !keepsAllButHits(kept, shot)) return false;

    const sorted = kept && kept.length < shot.faces.length ? [...kept].sort((a, b) => a - b) : null;
    this.shots = this.shots.map((s) => (s === shot ? { ...s, kept: sorted } : s));
    return this.publish();
  }

  /** Pass and play: apply only some results of a collision roll of a unit without an order, as `keepResults` */
  keepStandingResults(index: number, kept: readonly number[] | null): boolean {
    const roll = this.standingCollisions[index];
    if (!roll || (kept !== null && !keepsAllButHits(kept, roll))) return false;
    const sorted = kept && kept.length < roll.faces.length ? [...kept].sort((a, b) => a - b) : null;
    this.standingCollisions = this.standingCollisions.map((r, i) => (i === index ? { ...r, kept: sorted } : r));
    return this.publish();
  }

  /** Roll a shot of this order's unit, which pays its fire option's ammo or shells */
  private recordShot(
    orderIndex: number,
    { dice, steps, notes, target, collision = false, combatBonus = false, targetPosition, option }: ShotRecord
  ): true {
    const { unit } = this.orders[orderIndex]!;
    const luckBefore = this.luckOf(unit);
    const faces = this.rollFaces(dice, steps, target, unit);
    const shot: Shot = { orderIndex, steps, dice, faces, notes, collision, target, combatBonus, kept: null, spent: option.cost, luckBefore };
    if (!collision) shot.option = option.id;
    if (targetPosition) shot.targetPosition = targetPosition;
    this.spend(unit, option.cost);
    this.shots = [...this.shots, shot];
    return this.publish();
  }

  /** The unit pays for a shot (checked before) */
  private spend(unit: Unit, cost: SupplyCost) {
    const paid = pay(this.suppliesOf(unit), cost);
    if (paid) this.supplies.set(unit, paid);
  }

  /** A roll's faces: the dice thrown, then the ones its steps add already showing a face */
  /**
   * A roll's faces: the dice thrown, nudged by the unit's luck (which moves on the streak), then
   * the ones its steps add already showing a face
   */
  private rollFaces(dice: number, steps: readonly DiceStep[], target: ShotTarget, unit: Unit): DieFace[] {
    const set = setFaces(steps).slice(0, dice);
    const isHit = (face: DieFace) => faceHits(face, target);
    const rolled = rollWithLuck(dice - set.length, SIDES_OF[target.die], isHit, this.luckOf(unit), this.random);
    this.luck = new Map(this.luck).set(unit, rolled.luck);
    return [...rolled.faces, ...set];
  }

  private luckOf(unit: Unit): number {
    return this.luck.get(unit) ?? 0;
  }

  /** The luck of this side's unit on this hex (−3 to +3), null without one; never shown for the enemy */
  luckAt(position: Position): number | null {
    const unit = this.board.getHex(position)?.unit;
    return unit ? this.luckOf(unit) : null;
  }

  // --- coins: earned and spent through the turn; `turnCoins` works out the ledger

  private turnCoinEntries(): CoinEntry[] {
    const card = this.playedCard;
    return turnCoins({
      card: card && { name: card.name, cost: this.costOf(card) },
      orders: this.orders,
      shots: this.shots,
      standingCollisions: this.standingCollisions,
      adjustments: this.coinAdjustments,
    });
  }

  /** Coins the player has now. It can drop below 0 only when a shot that earned coins already spent is undone. */
  private coins(): number {
    return this.startCoins + sumCoins(this.turnCoinEntries());
  }

  /**
   * Add (or, negative, take) coins by hand, to match the table. The player
   * can't spend more than they have.
   */
  adjustCoins(amount: number): boolean {
    if (!Number.isInteger(amount) || amount === 0) return false;
    if (amount < 0 && this.coins() + amount < 0) return false;

    this.coinAdjustments = [...this.coinAdjustments, amount];
    return this.publish();
  }

  /** Take back this turn's last change by hand */
  undoCoinAdjustment(): boolean {
    if (this.coinAdjustments.length === 0) return false;

    this.coinAdjustments = this.coinAdjustments.slice(0, -1);
    return this.publish();
  }

  // Map markers: the hexes the card played targets, or where its unit appears

  /** The card played, if it marks hexes, and where its marks start in `markers` */
  private markerSpans(): { card: ActionCard; rule: MarkerRule; start: number }[] {
    const card = this.playedCard;
    return card?.marker ? [{ card, rule: card.marker, start: 0 }] : [];
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

  /** Where the unit stands now, or null if it was removed */
  private positionOf(unit: Unit): Position | null {
    return this.board.getAllHexes().find((hex) => hex.unit === unit)?.getPosition() ?? null;
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
    } else if (!samePosition(edit.from, edit.to)) {
      // A move skipped (`skipFinalMove`) moved nothing
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

    // It arrives with no energy, and everything else full
    const full = fullSupplies(unitType, unit.elite);
    this.supplies.set(unit, { ...full, amounts: { ...full.amounts, ...(full.amounts[Supply.ENERGY] !== undefined && { [Supply.ENERGY]: 0 }) } });
    this.battleEdits = [...this.battleEdits, { kind: "add", position: { ...position }, unit }];
    return true;
  }

  /** Close the turn: the card played starts its cooldown, and the next turn begins */
  endTurn(): boolean {
    if (this.phase !== TurnPhase.END_OF_TURN) return false;
    if (this.reinforcementToPlace()) return false;

    const coins = this.coins();
    const record = recordTurn({
      turn: this.turn,
      card: this.playedCard,
      orders: this.orders,
      shots: this.shots,
      battleEdits: this.battleEdits,
      coins: this.turnCoinEntries(),
      coinsAfter: coins,
      markers: this.markers,
      cardAttacks: this.cardAttacks,
    });
    this.log = [...this.log, record];
    // Camouflage: the badge goes on after the battle, kept until the unit moves or battles
    const camouflaging = this.orders.filter((order) => actionById(order.action)?.effect === "camouflage").map((order) => order.unit);
    this.camouflaged = new Set([...this.camouflagedUnits(), ...camouflaging.filter((unit) => this.positionOf(unit))]);
    this.recoverEnergy();
    this.turnStart = null;
    this.startCoins = this.testMode ? Math.max(coins, TEST_MODE_COINS) : coins;
    this.coinAdjustments = [];
    if (this.playedCard) this.cardsPlayedOn = { ...this.cardsPlayedOn, [this.playedCard.id]: this.turn };
    this.playedCard = null;
    this.markers = [];
    this.cardAttacks = [];
    this.clearTurnDamage();
    this.orders = [];
    this.battleEdits = [];
    this.shots = [];
    this.unmovedFireSkipped = false;
    this.turn++;
    this.phase = TurnPhase.PICK_CARDS;
    return this.publish();
  }

  /** The final phase: the energy each unit will get back as the turn ends, and the cards back next turn */
  private turnEnd(): GameSnapshot["turnEnd"] {
    if (this.phase !== TurnPhase.END_OF_TURN) return null;
    const energy = this.board.getAllHexes().flatMap((hex) => {
      const unit = hex.unit;
      if (!unit) return [];
      const spent = this.turnSpent(unit);
      const now = this.suppliesOf(unit);
      const after = endOfTurn(now, fullSupplies(unit.getUnitType(), unit.elite), spent);
      const amount = amountOf(after, Supply.ENERGY) - amountOf(now, Supply.ENERGY);
      return amount > 0 ? [{ position: hex.getPosition(), amount, spent }] : [];
    });
    const cardsBack = this.cards
      .filter(({ card }) => !this.testMode && this.cardsPlayedOn[card.id] !== undefined && turnsLeft(this.cardsPlayedOn[card.id], this.turn) === 1)
      .map(({ card }) => card);
    return { energy, cardsBack };
  }

  /** The end of the turn: infantry gets energy back, more if it rested (had no order), none if it moved */
  private recoverEnergy() {
    for (const hex of this.board.getAllHexes()) {
      const unit = hex.unit;
      if (!unit) continue;
      this.supplies.set(unit, endOfTurn(this.suppliesOf(unit), fullSupplies(unit.getUnitType(), unit.elite), this.turnSpent(unit)));
    }
  }

  /**
   * How the unit spent the turn, for its energy back: no order is resting; it moved if its order
   * moved it, it took ground or it made a card's move after the battle. A retreat or a fix on the
   * map isn't the unit's own move, so it doesn't count
   */
  private turnSpent(unit: Unit): TurnSpent {
    const index = this.orderIndexOf(unit);
    const order = this.orders[index];
    if (!order) return "rested";
    const moved =
      !samePosition(order.start, order.end) ||
      this.shots.some((shot) => shot.orderIndex === index && shot.tookGround) ||
      this.battleEdits.some((edit) => edit.kind === "move" && edit.unit === unit && edit.reposition);
    return moved ? "moved" : "held";
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
      playedCard: this.playedCard,
      cardsPlayedOn: this.cardsPlayedOn,
      orders: this.orders,
      unmovedFireSkipped: this.unmovedFireSkipped,
      battleEdits: this.battleEdits,
      shots: this.shots,
      log: this.log,
      startCoins: this.startCoins,
      coinAdjustments: this.coinAdjustments,
      markers: this.markers,
      cardAttacks: this.cardAttacks,
      standingCollisions: this.standingCollisions,
      figureHits: this.figureHits,
      retreatFlags: this.retreatFlags,
      retreatsDue: this.retreatsDue,
      turnHits: this.turnHits,
      coverHits: this.coverHits,
      luck: this.luck,
      turnStart: this.turnStart,
      camouflaged: this.camouflaged,
      supplies: this.supplies,
      drops: this.drops,
    });
  }

  /** Rebuild a saved game. Throws if the save doesn't fit this scenario. */
  static restore(saved: SavedGame, scenario: Scenario, random?: () => number): GameSession {
    if (saved.scenarioId !== scenario.id) throw new Error(`Save is for scenario ${saved.scenarioId}`);

    const session = new GameSession({
      scenario,
      faction: saved.faction,
      longRangeDie: saved.longRangeDie,
      testMode: saved.testMode,
      artilleryCrew: saved.artilleryCrew,
      figures: saved.figures,
      random,
    });
    const state: SessionState = readSave(saved, session.board);
    session.turn = state.turn;
    session.phase = state.phase;
    session.playedCard = state.playedCard;
    session.cardsPlayedOn = { ...state.cardsPlayedOn };
    session.orders = state.orders;
    session.unmovedFireSkipped = state.unmovedFireSkipped;
    session.battleEdits = state.battleEdits;
    session.shots = state.shots;
    session.log = state.log;
    session.startCoins = state.startCoins;
    session.coinAdjustments = state.coinAdjustments;
    session.markers = state.markers;
    session.cardAttacks = state.cardAttacks;
    session.standingCollisions = [...state.standingCollisions];
    session.figureHits = new Map(state.figureHits);
    session.retreatFlags = new Map(state.retreatFlags);
    session.retreatsDue = new Map(state.retreatsDue);
    session.turnHits = new Map(state.turnHits);
    session.coverHits = new Map(state.coverHits);
    session.luck = new Map(state.luck);
    session.turnStart = state.turnStart && { supplies: new Map(state.turnStart.supplies), luck: new Map(state.turnStart.luck) };
    session.camouflaged = new Set(state.camouflaged);
    session.supplies = new Map(state.supplies);
    session.drops = state.drops;
    session.snapshot = session.createSnapshot();
    return session;
  }

  // --- internals

  private createSnapshot(): GameSnapshot {
    return {
      turn: this.turn,
      phase: this.phase,
      cards: this.cards.map(({ card, cost }) => ({
        card,
        cost,
        turnsLeft: this.testMode ? 0 : turnsLeft(this.cardsPlayedOn[card.id], this.turn),
        playable: this.phase === TurnPhase.PICK_CARDS && this.canPlay(card),
      })),
      playedCard: this.playedCard,
      orders: this.orders,
      orderable:
        this.phase === TurnPhase.ORDER_UNITS ? orderablePositions(this.board, this.orders, (unit) => this.canOrder(unit)) : [],
      supplies: this.board.getAllHexes().flatMap((hex) =>
        hex.unit ? [{ position: hex.getPosition(), supplies: this.suppliesOf(hex.unit) }] : []
      ),
      changes: this.turnChanges(),
      turnEnd: this.turnEnd(),
      battleEdits: this.battleEdits.length,
      canEditMap: this.canEditMap(),
      canUndoMapEdit: this.canUndoMapEdit(),
      shots: this.shots,
      unmovedFireSkipped: this.unmovedFireSkipped,
      log: this.log,
      coins: this.coins(),
      coinEntries: this.turnCoinEntries(),
      markers: this.markers,
      markerKinds: this.markerKinds(),
      marking: this.markingSnapshot(),
      markable: this.markableNow(),
      attackMarks: this.attackMarks(),
      cardAttacks: this.cardAttacks,
      attacksPending: this.attacksPending(),
      standingCollisions: this.standingCollisions,
      strength: this.strength(),
      canRemoveWire: this.orders.map((_, i) => this.canRemoveWire(i)),
      camouflaged: this.camouflagedUnits().flatMap((unit) => this.positionOf(unit) ?? []),
      finalMove: this.finalMove(),
      tableReminders: this.tableReminders(),
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
