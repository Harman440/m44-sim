import GameSession, { EnemyUnit, GameSnapshot, ShotRoll } from "./gameSession";
import { SavedGame } from "./saveGame";
import Unit, { UnitType } from "./unit";
import Order from "./order";
import { turnedRound } from "./BoardManager";
import { boardPositions, boardSizeOf } from "./boardSize";
import { includesPosition, positionKey, samePosition } from "./position";
import { hexDistance } from "./fireTargets";
import { inSight, seenHexes } from "./fogOfWar";
import {
  MoveRun,
  Mover,
  RunCollision,
  Stander,
  nextPush,
  pushBlocked,
  pushTo,
  resolveCollision,
  runEnds,
  runWaitsFor,
  startRun,
  takeStep,
  unitGone,
} from "./simultaneousMove";
import { appliedFaces, keptForHits, readRoll } from "./rollResult";
import { OrderSummary } from "./turnSummary";
import { MatchResult, Medals, countMedals, heldObjectives, winnerOf } from "./victory";
import { resultLimit } from "../data/figures";
import { actionById } from "../data/unitActions";
import { Faction, FACTIONS } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import type { Localized } from "../i18n/lang";

/** Bump when the shape of `SavedMatch` (or what it means) changes: older saves are dropped, not migrated */
export const MATCH_SAVE_VERSION = 19;

/** Hits that destroy any unit: one surrounded in a collision, with no hex to leave the enemy's to */
const SURROUNDED_HITS = 99;

/** A pass and play match as plain JSON: each side's game, whose turn it is on the device, the last turn revealed */
export interface SavedMatch {
  version: typeof MATCH_SAVE_VERSION;
  sides: { allies: SavedGame; axis: SavedGame };
  active: Faction;
  /** The side the map is seen from on every screen; older saves without it take the attacker */
  mainSide?: Faction;
  /** The side the computer plays, if any */
  computer?: Faction | null;
  revealedTurn: number;
  movement: MatchMovement | null;
  battle: MatchBattle | null;
  /** The objective hexes each side held at the end of the last turn (Allies' view) */
  held?: Record<Faction, Position[]>;
  /** How the match ended, once it has */
  result?: MatchResult | null;
  /** Fog of war (against the computer) */
  fog?: boolean;
  /** Fog of war: the enemy units each side saw when the last battle ended, in its own view; null before the first */
  sighted?: Record<Faction, Position[]> | null;
}

/** The units that didn't move fire first (and No Respite's), then the ones that moved */
export type FireGroup = "unmoved" | "moved";

const FIRE_GROUPS: readonly FireGroup[] = ["unmoved", "moved"];

/** The group a unit fires in */
const groupOf = (summary: OrderSummary): FireGroup => (summary.unmovedGroup ? "unmoved" : "moved");

/**
 * The shared battle: both sides take turns to fire, one unit at a time, the attacker first in
 * each group (house rules, "Battle phase")
 */
export interface MatchBattle {
  turn: number;
  /** Each turn to fire so far, in order: a shot (its index in its side's shots) or a unit holding its fire (null) */
  fired: { side: Faction; group: FireGroup; order: number; shot: number | null }[];
  /**
   * A close assault was dealt: once its target has retreated (its player picking the hexes), the
   * unit may take ground if the hex is free (`ground`). `at` is the target's hex, in the shooter's view
   */
  assault: { side: Faction; order: number; at: Position } | null;
  /** The last close assault lets the unit take ground: its player decides */
  ground: { side: Faction; order: number } | null;
  /** The unit took ground: it fires once more, now, in close assault */
  bonus: { side: Faction; order: number } | null;
  /**
   * The firing is over and both sides are in their final phase: the units that move after the
   * battle are moved, and a reinforcement whose cross was taken placed, then the turn ends
   */
  ending?: boolean;
}

/** The battle for the screen */
export interface BattleState {
  turn: number;
  /** Whose turn it is to fire, and in which group; null once nobody can fire */
  side: Faction | null;
  group: FireGroup | null;
  /** The order indexes of that side's units that can fire now */
  fireable: readonly number[];
  /** Each side's units with a shot left but nothing to fire at, passed over (order indexes) */
  noTarget: Readonly<Record<Faction, readonly number[]>>;
  /** The unit that may take ground after its close assault: its player decides */
  ground: { side: Faction; order: number } | null;
  /** The unit retreating now (in its side's view), the hexes it can retreat to and the hexes it has to go */
  retreat: { side: Faction; position: Position; options: readonly Position[]; flags: number } | null;
  /** Sides whose attack combat card (Barrage…) is still to be rolled, before anyone fires */
  attacks: readonly Faction[];  /**
   * Once the firing is over: what a side still does on the map before the turn ends, a unit moving
   * after the battle (Behind Enemy Lines) or a reinforcement whose cross was taken (in its side's view)
   */
  afterBattle: AfterBattle | null;
}

export type AfterBattle =
  | { side: Faction; kind: "move"; from: Position; options: readonly Position[]; name: Localized }
  | { side: Faction; kind: "reinforcement"; unitType: UnitType; options: readonly Position[] };

/** Where a collision's roll was kept: one of its side's shots, or its rolls for units without an order */
export interface RollRef {
  kind: "shot" | "standing";
  index: number;
}

/** The turn's movement, carried out by the app one hex at a time (`MoveRun`), and each collision's rolls */
export interface MatchMovement {
  turn: number;
  run: MoveRun;
  /** Each collision's rolls, by its index in `run.collisions`: one per unit (null for one that couldn't battle) */
  rolls: ([RollRef | null, RollRef | null] | null)[];
  /** The run is finished and its result is on both sides' boards */
  done: boolean;
}

/** A unit of the movement, for the screen: positions in the Allies' view */
export interface MovingUnitView {
  side: Faction;
  order: number | null;
  /** Where it stands now in the movement */
  position: Position;
  unitType: UnitType;
}

/** One of a collision's units, for the screen */
export interface CollidingUnitView extends MovingUnitView {
  /** Its roll, once the collision is rolled; null too for a unit that couldn't battle */
  roll: ShotRoll | null;
}

export interface CollisionView {
  step: number;
  kind: RunCollision["kind"];
  /** The hex fought over (Allies' view); null for a crossing */
  hex: Position | null;
  units: [CollidingUnitView, CollidingUnitView];
  rolled: boolean;
  /** Its hits dealt and its retreats ordered */
  applied: boolean;
}

/** Armor Forward went through enemy infantry: the infantry took a flag */
export interface OverrunView {
  step: number;
  hex: Position;
  armour: Faction;
  infantry: Faction;
}

/** The movement as the screen shows it */
export interface MovementView {
  turn: number;
  /** Steps taken: 1 once every moving unit has gone its first hex */
  step: number;
  /**
   * What it waits for: the next step (`advanceMovement`), a collision to roll (`rollCollision`),
   * a unit pushed back a hex the way it came or blocked (`advanceMovement`), its player to pick
   * the hex it's pushed to (`choosePush`); null once it's over
   */
  waiting: "step" | "collision" | "push" | "choice" | null;
  collisions: readonly CollisionView[];
  overruns: readonly OverrunView[];
  /** The unit its player must push, where it stands and the hexes it may go to (Allies' view) */
  choice: { side: Faction; position: Position; options: readonly Position[] } | null;
  /** The movement is over and the battle can start */
  done: boolean;
}

export interface MatchSnapshot {
  /** The side whose player holds the device */
  active: Faction;
  /** The cover screen is up: the device is changing hands, nothing of either side shows */
  covered: boolean;
  /**
   * Both sides have given this turn's orders and they haven't been shown yet: the reveal screen,
   * with both cards and both armies' orders, comes before anything else
   */
  revealTurn: number | null;
  /** The player holding the device can hand it over ("Pasar") */
  canPass: boolean;
  /** The units of the turn being revealed are moving, a hex at a time; null before "Mover" */
  movement: MovementView | null;
  /** The shared battle, once the movement is over; null otherwise */
  battle: BattleState | null;
  /**
   * The scenario's victory conditions and where each side stands: medals for the enemy units
   * destroyed so far and the objectives held at the end of the last turn. Null for a scenario
   * without them
   */
  victory: { medals: number; standing: Medals; held: Record<Faction, readonly Position[]> } | null;
  /** How the match ended, once a side has won */
  result: MatchResult | null;
}

/** A unit and where it stands, as seen from its own side of the table */
export interface PlacedUnit {
  position: Position;
  unit: Unit;
  /** Its figures left, whether it's pinned and the hexes it must retreat now (`ArmyView`) */
  figures?: number;
  pinned?: boolean;
  retreats?: number;
  /** A figure was hit once (armour): marked */
  damaged?: boolean;
  /** Hits it took this turn */
  hitThisTurn?: number;
}

/** One army as another side may see it, each position in the army's own view */
export interface ArmyView {
  faction: Faction;
  units: readonly PlacedUnit[];
  /** Its orders this turn, once they've been revealed; none while they're secret */
  orders: readonly Order[];
  /** Its units that have fired this turn, of those orders */
  fired: readonly Unit[];
  /** Its units still to fire, of those orders */
  toFire: readonly Unit[];
  /** Its units with the camouflage badge, as they stood at the start of the turn while its orders are secret */
  camouflaged: readonly Position[];
  /** Its sandbags, as they stood at the start of the turn while its orders are secret */
  sandbags: readonly Position[];
}

export const otherSide = (faction: Faction): Faction => (faction === "Axis" ? "Allies" : "Axis");

/** The phases after a side's orders are locked: movement, battle and the final phase */
const AFTER_ORDERS: readonly TurnPhase[] = [TurnPhase.MOVEMENT, TurnPhase.BATTLE, TurnPhase.END_OF_TURN];

/** The side has locked its orders for `turn` (or is past it) */
const ordersGiven = (game: GameSnapshot, turn: number) =>
  game.turn > turn || (game.turn === turn && AFTER_ORDERS.includes(game.phase));

/** Every unit on a side's board, where it stands in that side's view */
export const armyOf = (session: GameSession): PlacedUnit[] =>
  [...session.board.hexes.values()].flatMap((hex) => (hex.unit ? [{ position: hex.getPosition(), unit: hex.unit }] : []));

/**
 * Pass and play: both sides on one device. Each side keeps its own `GameSession` (hand, decks,
 * coins, orders), so the rules of the one-side game run unchanged; the match tracks who holds
 * the device and puts a cover screen up whenever it changes hands, so neither player sees the
 * other's cards and orders.
 *
 * The turn: both sides play from turn 1. Each turn, the side holding the device picks its cards and gives its orders; locking them hands
 * the device to the other side if it hasn't given its own yet. Once both have, the reveal shows
 * both cards and both armies' orders; then each side plays its movement, battle and final phase.
 */
class PassAndPlayMatch {
  readonly scenario: Scenario;
  readonly sessions: Readonly<Record<Faction, GameSession>>;
  /** The side whose end of the table the device sits at: every map is seen from it, for both players */
  readonly mainSide: Faction;
  /**
   * The side the computer plays, if any: the device stays with the person's side, so there's no
   * cover screen and nothing is handed over. The computer gives its side's actions like a player would
   */
  readonly computer: Faction | null;
  private active: Faction;
  private covered: boolean;
  /** The last turn whose orders were shown to both players and carried out */
  private revealedTurn: number;
  private movement: MatchMovement | null;
  private battle: MatchBattle | null;
  private held: Record<Faction, Position[]>;
  private result: MatchResult | null;
  /**
   * Fog of war (game-core/fogOfWar.ts): each side sees the enemy units in its units' sight. Against
   * the computer once the turn's units have moved, until the battle ends (then what it saw is what
   * it knows); between two people only in the battle, on the screen they share
   */
  readonly fog: boolean;
  /** The enemy units each side saw when the last battle ended, in its own view: what it knows while giving orders. Null before the first battle: both armies are known */
  private sighted: Record<Faction, Position[]> | null;

  private readonly listeners = new Set<() => void>();
  private snapshot: MatchSnapshot;

  /** A position seen from the other end of the table, on this match's board */
  private turnedRound(position: Position): Position {
    return turnedRound(position, boardSizeOf(this.scenario));
  }

  /** A side's position in the Allies' view of the board, or back: the Axis sees it turned round */
  private inAlliesView(side: Faction, position: Position): Position {
    return side === "Axis" ? this.turnedRound(position) : position;
  }

  constructor(
    scenario: Scenario,
    sessions: Record<Faction, GameSession>,
    {
      computer = null,
      active = computer ? otherSide(computer) : scenario.attacker,
      mainSide = computer ? otherSide(computer) : scenario.attacker,
      covered = true,
      revealedTurn = 0,
      movement = null,
      battle = null,
      held = { Allies: [], Axis: [] },
      result = null,
      fog = false,
      sighted = null,
    }: {
      computer?: Faction | null;
      active?: Faction;
      mainSide?: Faction;
      covered?: boolean;
      revealedTurn?: number;
      movement?: MatchMovement | null;
      battle?: MatchBattle | null;
      held?: Record<Faction, Position[]>;
      result?: MatchResult | null;
      fog?: boolean;
      sighted?: Record<Faction, Position[]> | null;
    } = {}
  ) {
    if (sessions.Allies.faction !== "Allies" || sessions.Axis.faction !== "Axis") {
      throw new Error("Each side needs its own session");
    }
    if (sessions.Allies.scenario.id !== scenario.id || sessions.Axis.scenario.id !== scenario.id) {
      throw new Error("Both sessions must play this scenario");
    }
    this.scenario = scenario;
    this.sessions = sessions;
    this.computer = computer;
    this.active = computer ? otherSide(computer) : active;
    this.mainSide = mainSide;
    this.covered = computer ? false : covered;
    this.fog = fog;
    this.sighted = sighted;
    this.revealedTurn = revealedTurn;
    this.movement = movement;
    this.battle = battle;
    this.held = held;
    this.result = result;
    for (const side of FACTIONS) {
      sessions[side].setEnemyView(() => this.enemiesOf(side));
    }
    this.follow();
    this.snapshot = this.createSnapshot();
    sessions.Allies.subscribe(this.onSessionChange);
    sessions.Axis.subscribe(this.onSessionChange);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): MatchSnapshot => this.snapshot;

  /** The game of the side holding the device */
  activeSession(): GameSession {
    return this.sessions[this.active];
  }

  /** The player hands the device to the other side: the cover screen goes up */
  pass(): boolean {
    if (!this.canPass()) return false;
    this.handOver();
    return this.publish();
  }

  /** The player now holding the device shows their side */
  uncover(): boolean {
    if (!this.covered || this.revealTurn() !== null) return false;
    this.covered = false;
    return this.publish();
  }

  /**
   * Start carrying out the revealed orders, both sides at once and one hex at a time
   * (`advanceMovement` takes each step): units that meet an enemy stop and collide; units of
   * one side don't hold each other up
   */
  moveUnits(): boolean {
    const turn = this.revealTurn();
    if (turn === null || this.movement?.turn === turn) return false;

    const movers: Mover[] = [];
    const standers: Stander[] = [];
    for (const side of FACTIONS) {
      const session = this.sessions[side];
      const { orders } = session.getSnapshot();
      const view = (position: Position) => this.inAlliesView(side, position);
      const isInfantry = (unit: Unit) => unit.getUnitType() === UnitType.INFANTRY;
      orders.forEach((order, index) => {
        const infantry = isInfantry(order.unit);
        if (samePosition(order.start, order.end)) standers.push({ side, order: index, position: view(order.start), infantry });
        else {
          const path = (order.path ?? [order.start, order.end]).map(view);
          movers.push({ side, order: index, path, infantry, throughInfantry: !!actionById(order.action)?.throughInfantry });
        }
      });
      const ordered = new Set(orders.map((order) => order.unit));
      armyOf(session)
        .filter(({ unit }) => !ordered.has(unit))
        .forEach(({ unit, position }) => standers.push({ side, order: null, position: view(position), infantry: isInfantry(unit) }));
    }
    this.movement = { turn, run: startRun(movers, standers), rolls: [], done: false };
    return this.publish();
  }

  /** Whether a unit could stand on this hex (Allies' view): on the map and passable */
  private readonly passable = (position: Position) => !!this.sessions.Allies.board.getHex(position)?.isPassable();

  /**
   * The movement goes on by one thing: every moving unit takes its next hex, or the unit being
   * pushed goes a hex back the way it came (or, with nowhere to go, takes a hit for it). False
   * while it waits for a collision to be rolled or a hex to be picked, and once it's over
   */
  advanceMovement(): boolean {
    const movement = this.movement;
    if (!movement || movement.done || this.revealTurn() !== movement.turn) return false;
    const { run } = movement;
    const waits = runWaitsFor(run);
    if (waits === "step") {
      const next = takeStep(run);
      // Infantry that Armor Forward went through takes a flag, as if rolled on it: it's pinned,
      // or retreats (before the battle) if it was pinned already
      for (const overrun of next.overruns.slice(run.overruns.length)) {
        const { side, boardAt } = next.units[overrun.infantry]!;
        this.sessions[side].sufferHits(this.inAlliesView(side, boardAt), 0, 1);
      }
      this.movement = { ...movement, run: next };
      if (next.finished) this.endRun();
      return this.publish();
    }
    if (waits !== "push") return false;
    const push = nextPush(run, this.passable)!;
    if (push.back) {
      this.movement = { ...movement, run: pushTo(run, this.passable, push.back) };
      this.settleSurrounded(push.push.unit);
      return this.publish();
    }
    if (push.options.length > 0) {
      // The computer picks its own unit's hex: the one farthest from the enemy
      const side = run.units[push.push.unit]!.side;
      if (side !== this.computer) return false;
      const far = [...push.options].sort((a, b) => hexDistance(b, push.push.enemy) - hexDistance(a, push.push.enemy))[0]!;
      return this.choosePush(far);
    }
    // Nowhere to go: a hit for the hex it can't retreat, as in the battle
    const unit = run.units[push.push.unit]!;
    this.movement = { ...movement, run: pushBlocked(run, this.passable) };
    this.hitInMovement(push.push.unit, 1);
    if (!this.movement.run.units[push.push.unit]!.gone && unit) this.settleSurrounded(push.push.unit);
    return this.publish();
  }

  /** The player of the unit being pushed picks the hex it goes to, one of `MovementView.choice`'s */
  choosePush(to: Position): boolean {
    const movement = this.movement;
    if (!movement || movement.done || runWaitsFor(movement.run) !== "push") return false;
    const next = pushTo(movement.run, this.passable, to);
    if (next === movement.run) return false;
    const unit = movement.run.pushes[0]!.unit;
    this.movement = { ...movement, run: next };
    this.settleSurrounded(unit);
    return this.publish();
  }

  /** Deal hits to a unit of the movement on its side's board; it's gone if they destroy it */
  private hitInMovement(index: number, hits: number) {
    const { side, boardAt } = this.movement!.run.units[index]!;
    const session = this.sessions[side];
    const at = this.inAlliesView(side, boardAt);
    session.sufferHits(at, hits, 0);
    if (!session.board.getHex(at)?.unit) this.movement = { ...this.movement!, run: unitGone(this.movement!.run, index) };
  }

  /**
   * A unit that had to leave a hex it shares with an enemy and has no hex left to go (its pushes
   * are over and it's still there): surrounded, it's destroyed (house rule)
   */
  private settleSurrounded(index: number) {
    const { run } = this.movement!;
    const unit = run.units[index]!;
    if (unit.gone || run.pushes.some((push) => push.unit === index)) return;
    const sharing = run.units.some((other) => !other.gone && other.side !== unit.side && samePosition(other.position, unit.position));
    if (sharing) this.hitInMovement(index, SURROUNDED_HITS);
  }

  /**
   * Both units of the collision roll at once: close assault dice minus 1, terrain ignored. A unit
   * that can't battle doesn't roll. The results are dealt at once, each roll's hits cut down to
   * its unit's figures (limited damage); every flag is a hex the unit is pushed back (house rule)
   */
  rollCollision(index: number): boolean {
    const movement = this.movement;
    if (!movement || movement.done || runWaitsFor(movement.run) !== "collision") return false;
    const collision = movement.run.collisions[index];
    if (!collision || collision.resolved) return false;
    const units = collision.units.map((i) => {
      const unit = movement.run.units[i]!;
      return { side: unit.side, order: unit.order, at: this.inAlliesView(unit.side, unit.boardAt) };
    });
    const placed = units.map((unit) => this.sessions[unit.side].board.getHex(unit.at)?.unit);

    const rolls = units.map((unit, i): RollRef | null => {
      const session = this.sessions[unit.side];
      const enemy = placed[1 - i];
      if (!placed[i] || !enemy || !session.canRollCollision(unit.at, unit.order)) return null;
      const game = session.getSnapshot();
      const ref: RollRef =
        unit.order === null
          ? { kind: "standing", index: game.standingCollisions.length }
          : { kind: "shot", index: game.shots.length };
      return session.rollCollision(unit.at, enemy.getUnitType() === UnitType.INFANTRY, unit.order) ? ref : null;
    }) as [RollRef | null, RollRef | null];
    rolls.forEach((ref, i) => {
      const unit = units[i]!;
      if (ref) this.limitDamage(unit.side, ref, resultLimit(this.sessions[unit.side].figuresAt(unit.at) ?? 0, false));
    });
    const allRolls = [...movement.rolls];
    allRolls[index] = rolls;

    // Dealt at once: each unit the hits and flags of the other's roll
    const results = rolls.map((ref, i) => {
      const roll = this.rollOf(units[i]!.side, ref);
      return roll ? readRoll(appliedFaces(roll.faces, roll.kept), roll.target) : null;
    });
    units.forEach((unit, i) => {
      const result = results[1 - i];
      if (result) this.sessions[unit.side].sufferHits(unit.at, result.hits, result.retreats, result.hitFaces, { pushedNow: true });
    });
    const gone = units.map((unit) => !this.sessions[unit.side].board.getHex(unit.at)?.unit) as [boolean, boolean];
    const flags = units.map((_, i) => results[1 - i]?.retreats ?? 0) as [number, number];
    this.movement = { ...movement, rolls: allRolls, run: resolveCollision(movement.run, index, { flags, gone }) };
    return this.publish();
  }

  /** The run is finished: each side's units go where it left them */
  private endRun() {
    const movement = this.movement!;
    for (const side of FACTIONS) {
      const moves = runEnds(movement.run)
        .filter((end) => end.side === side && !end.gone && !samePosition(end.end, end.boardAt))
        .map((end) => ({
          from: this.inAlliesView(side, end.boardAt),
          to: this.inAlliesView(side, end.end),
          reachedEnd: end.reachedEnd,
          path: end.path.map((hex) => this.inAlliesView(side, hex)),
        }));
      if (moves.length > 0) this.sessions[side].endMovement(moves);
    }
    // The tanks that went through barbed wire took it off the other side's board too
    this.settleWire();
    this.movement = { ...movement, done: true };
  }

  /**
   * Limited damage (house rule): a roll deals no more hits than its units have figures (one more
   * with a card's dice); its flags and supplies always count. The hits left out are set aside
   */
  private limitDamage(side: Faction, ref: RollRef, limit: number) {
    const session = this.sessions[side];
    const roll = this.rollOf(side, ref);
    if (!roll) return;
    const kept = keptForHits(roll.faces, roll.target, limit);
    if (!kept) return;
    if (ref.kind === "standing") {
      session.keepStandingResults(ref.index, kept);
      return;
    }
    const shots = session.getSnapshot().shots;
    const { orderIndex } = shots[ref.index]!;
    const number = shots.filter((s, i) => s.orderIndex === orderIndex && i < ref.index).length;
    session.keepResults(orderIndex, number, kept);
  }

  /**
   * Both players have seen the orders and the moves, and the movement is over: the attacker
   * goes on with the battle and the final phase, behind the cover screen
   */
  finishReveal(): boolean {
    const turn = this.revealTurn();
    if (turn === null || this.movement?.turn !== turn || !this.movement.done) return false;
    this.revealedTurn = turn;
    this.movement = null;
    // The battle, on one screen for both players
    this.battle = { turn, fired: [], assault: null, ground: null, bonus: null };
    for (const side of FACTIONS) this.sessions[side].startBattle();
    // A unit given a second flag by Armor Forward retreats now, before anyone fires
    this.settleRetreats();
    this.active = this.person() ?? this.scenario.attacker;
    this.covered = false;
    return this.publish();
  }


  // --- The battle: the sides take turns to fire, one unit at a time

  /**
   * The side whose turn it is to fire, and the group: the units that didn't move (with No
   * Respite's moved infantry), then the ones that moved. In each group the attacker fires first
   * and the sides alternate; a side with nothing left to fire lets the other go on. Null once
   * nobody can fire
   */
  private battleTurn(): { side: Faction; group: FireGroup } | null {
    const battle = this.battle;
    if (!battle || this.busy()) return null;
    if (battle.bonus) {
      const summary = this.sessions[battle.bonus.side].orderSummaries()[battle.bonus.order];
      return { side: battle.bonus.side, group: summary ? groupOf(summary) : "moved" };
    }
    const group = FIRE_GROUPS.find((g) => FACTIONS.some((side) => this.fireable(side, g).length > 0));
    if (!group) return null;
    const can = (side: Faction) => this.fireable(side, group).length > 0;
    const last = battle.fired.filter((turn) => turn.group === group).at(-1);
    const first = last ? otherSide(last.side) : this.scenario.attacker;
    return { side: can(first) ? first : otherSide(first), group };
  }

  /**
   * The order indexes of a side's units that can still fire this battle, in any group (not those
   * that held their fire, nor those with nothing to fire at)
   */
  stillToFire(side: Faction): number[] {
    return [...new Set(FIRE_GROUPS.flatMap((group) => this.fireable(side, group)))];
  }

  /**
   * The order indexes of a side's units that can still fire in this group. A unit with nothing to
   * fire at (no enemy in sight it rolls dice at, no wire to remove) is passed over, as if it held
   */
  private fireable(side: Faction, group: FireGroup): number[] {
    return this.withShotsLeft(side, group).filter((order) => this.hasShotToTake(side, order));
  }

  /** Each side's `ordersWithShotToTake`, kept until either side's game changes (it's asked on every snapshot) */
  private shotsToTake: { allies: GameSnapshot; axis: GameSnapshot; known: Partial<Record<Faction, ReadonlySet<number>>> } | null = null;

  private hasShotToTake(side: Faction, order: number): boolean {
    const [allies, axis] = [this.sessions.Allies.getSnapshot(), this.sessions.Axis.getSnapshot()];
    if (this.shotsToTake?.allies !== allies || this.shotsToTake.axis !== axis) this.shotsToTake = { allies, axis, known: {} };
    const known = (this.shotsToTake.known[side] ??= this.sessions[side].ordersWithShotToTake());
    return known.has(order);
  }

  /** The order indexes of a side's units with shots left in this group, that haven't held their fire */
  private withShotsLeft(side: Faction, group: FireGroup | null): number[] {
    const battle = this.battle;
    const session = this.sessions[side];
    if (!battle || session.getSnapshot().phase !== TurnPhase.BATTLE) return [];
    const held = new Set(battle.fired.filter((turn) => turn.side === side && turn.shot === null).map((turn) => turn.order));
    if (battle.bonus) {
      const { order } = battle.bonus;
      return battle.bonus.side === side && (session.orderSummaries()[order]?.shotsLeft ?? 0) > 0 ? [order] : [];
    }
    return session
      .orderSummaries()
      .filter((summary) => summary.shotsLeft > 0 && !held.has(summary.index))
      .filter((summary) => group === null || groupOf(summary) === group)
      .map((summary) => summary.index);
  }

  /** The order indexes of a side's units passed over in the battle: shots left, but nothing to fire at */
  private noTarget(side: Faction): number[] {
    return this.withShotsLeft(side, null).filter((order) => !this.hasShotToTake(side, order));
  }

  /**
   * The unit of the side whose turn it is fires at an enemy hex. The hits and flags are dealt at
   * once (no more hits than the unit has figures, limited damage), and an enemy unit given a
   * second flag retreats now (`retreat`). `option` is how it fires (a fire option's id), its
   * plain fire when left out
   */
  fire(order: number, target: Position, option?: string): boolean {
    const turn = this.battleTurn();
    if (!turn || !this.fireable(turn.side, turn.group).includes(order)) return false;
    const session = this.sessions[turn.side];
    // The units that moved fire once every unit that didn't move has fired, on either side
    if (turn.group === "moved" && session.orderSummaries().some((s) => s.unmovedGroup && s.shotsLeft > 0)) {
      session.skipUnmovedFire();
    }
    const shot = session.getSnapshot().shots.length;
    if (!session.fireAt(order, { position: target, infantry: true, sandbags: false, option })) return false;

    const battle = this.battle!;
    this.battle = {
      ...battle,
      fired: [...battle.fired, { side: turn.side, group: turn.group, order, shot }],
      bonus: null,
    };
    this.limitDamage(turn.side, { kind: "shot", index: shot }, this.shotLimit(turn.side, shot));
    this.applyShot(turn.side, shot);
    return this.publish();
  }

  /** Infantry whose turn it is on barbed wire removes it instead of firing, from both sides' boards */
  removeWire(order: number): boolean {
    const turn = this.battleTurn();
    if (!turn || !this.fireable(turn.side, turn.group).includes(order)) return false;
    const session = this.sessions[turn.side];
    const shot = session.getSnapshot().shots.length;
    if (!session.removeWire(order)) return false;
    this.settleWire();
    const battle = this.battle!;
    this.battle = {
      ...battle,
      fired: [...battle.fired, { side: turn.side, group: turn.group, order, shot }],
      bonus: null,
    };
    return this.publish();
  }

  /**
   * Each side's board has the scenario's wire; a side takes it off its own (a tank going
   * through it, infantry removing it). Once that's in the open, it goes from the other's too
   */
  private settleWire() {
    const allies = this.sessions.Allies;
    const axis = this.sessions.Axis;
    for (const hex of allies.board.getAllHexes()) {
      const position = hex.getPosition();
      const other = axis.board.getHex(this.turnedRound(position));
      if (hex.wire && !other?.wire) allies.wireRemovedByEnemy(position);
      else if (!hex.wire && other?.wire) axis.wireRemovedByEnemy(this.turnedRound(position));
    }
  }

  /** The unit whose turn it is holds its fire: it gives up its shot */
  holdFire(order: number): boolean {
    const turn = this.battleTurn();
    if (!turn || !this.fireable(turn.side, turn.group).includes(order)) return false;
    const battle = this.battle!;
    this.battle = {
      ...battle,
      fired: [...battle.fired, { side: turn.side, group: turn.group, order, shot: null }],
      bonus: null,
    };
    return this.publish();
  }

  /**
   * Deal the shot's hits and flags to the enemy unit; sandbags there ignore 1 flag. After a close
   * assault, the unit may take ground once its target has retreated or been destroyed
   */
  private applyShot(side: Faction, index: number) {
    const shooter = this.sessions[side];
    const enemy = this.sessions[otherSide(side)];
    const shot = shooter.getSnapshot().shots[index]!;
    const at = this.turnedRound(shot.targetPosition!);
    const { hits, retreats, hitFaces } = readRoll(appliedFaces(shot.faces, shot.kept), shot.target);
    const sandbags = enemy.board.getHex(at)?.sandbags ? 1 : 0;
    enemy.sufferHits(at, hits, Math.max(0, retreats - sandbags), hitFaces);
    const assault = shot.target.closeAssault ? { side, order: shot.orderIndex, at: shot.targetPosition! } : null;
    this.battle = { ...this.battle!, assault, ground: null };
    this.settleRetreats();
  }

  /** The unit takes ground after its close assault (it moves in and, armour with a shell left, fires once more), or doesn't */
  decideGround(take: boolean): boolean {
    const ground = this.battle?.ground;
    if (!ground) return false;
    if (!take) {
      this.battle = { ...this.battle!, ground: null };
      return this.publish();
    }
    const session = this.sessions[ground.side];
    if (!session.takeGround(ground.order)) return false;
    this.settleWire();
    // Infantry that pushed the enemy back moves in without firing again, and so does armour with
    // no shell left for its shot more, or nothing to fire at from the hex it took
    const pushedBack = session.getSnapshot().shots.findLast((s) => s.orderIndex === ground.order)?.pushedBack;
    const canFire = (session.orderSummaries()[ground.order]?.shotsLeft ?? 0) > 0 && this.hasShotToTake(ground.side, ground.order);
    this.battle = { ...this.battle!, ground: null, bonus: pushedBack || !canFire ? null : { ...ground } };
    return this.publish();
  }

  /** The unit retreating now moves one hex back, to one of its options (in its side's view) */
  retreat(to: Position): boolean {
    const next = this.nextRetreat();
    if (!next || !this.sessions[next.side].retreatTo(next.position, to)) return false;
    this.settleRetreats();
    return this.publish();
  }

  /** The unit that must retreat next: the attacker's units first */
  private nextRetreat(): { side: Faction; position: Position } | null {
    if (!this.battle) return null;
    for (const side of [this.scenario.attacker, otherSide(this.scenario.attacker)]) {
      const marked = this.sessions[side].getSnapshot().strength.find((unit) => unit.retreats > 0);
      if (marked) return { side, position: marked.position };
    }
    return null;
  }

  /**
   * Carry the retreats as far as they go without a choice: a unit with nowhere to go loses a
   * figure for the hex. Once nobody has to retreat, a close assault whose target left its hex
   * (retreated or destroyed) lets the unit take ground
   */
  private settleRetreats() {
    for (let next = this.nextRetreat(); next; next = this.nextRetreat()) {
      const session = this.sessions[next.side];
      if (session.retreatOptions(next.position).length > 0) return;
      session.retreatBlocked(next.position);
    }
    const battle = this.battle!;
    if (!battle.assault) return;
    const { side, order, at } = battle.assault;
    const shooter = this.sessions[side];
    const free = !this.sessions[otherSide(side)].board.getHex(this.turnedRound(at))?.unit;
    const from = shooter.orderSummaries()[order]?.firingFrom;
    const can = free && !!from && !shooter.hasRetreated(from) && shooter.canTakeGround(order);
    this.battle = { ...battle, assault: null, ground: can ? { side, order } : null };
  }

  /**
   * The firing is over (units that haven't fired lose their shot): each side goes on to its
   * final phase. Retreats are made as the flags come, so none is left
   */
  endBattle(): boolean {
    const battle = this.battle;
    if (!battle || this.busy()) return false;
    if (!battle.ending) {
      for (const side of FACTIONS) this.sessions[side].endBattle();
      this.battle = { ...battle, ending: true };
      this.scoreTurn();
    } else if (this.afterBattle()) {
      return false;
    }
    if (this.result || !this.afterBattle()) this.finishBattle();
    return this.publish();
  }

  /** What a side still does on the map once the firing is over, the attacker first; null when nothing */
  private afterBattle(): AfterBattle | null {
    if (!this.battle?.ending || this.result) return null;
    for (const side of [this.scenario.attacker, otherSide(this.scenario.attacker)]) {
      const session = this.sessions[side];
      const game = session.getSnapshot();
      if (game.reinforcementToPlace) {
        return { side, kind: "reinforcement", unitType: game.reinforcementToPlace, options: session.reinforcementOptions() };
      }
      if (game.finalMove) return { side, kind: "move", ...game.finalMove };
    }
    return null;
  }

  /**
   * After the battle: the unit moving after it goes to `to`, or the reinforcement is put there (in
   * its side's view). The turn ends once nothing is left to do
   */
  moveAfterBattle(to: Position): boolean {
    const due = this.afterBattle();
    if (!due || !includesPosition(due.options, to)) return false;
    const session = this.sessions[due.side];
    const done = due.kind === "move" ? session.makeFinalMove(to) : session.placeReinforcement(to);
    if (!done) return false;
    if (!this.afterBattle()) this.finishBattle();
    return this.publish();
  }

  /** After the battle: the unit due to move after it stays where it is (a reinforcement has to be placed) */
  skipMoveAfterBattle(): boolean {
    const due = this.afterBattle();
    if (due?.kind !== "move" || !this.sessions[due.side].skipFinalMove()) return false;
    if (!this.afterBattle()) this.finishBattle();
    return this.publish();
  }

  /** The battle and its moves are over: the next turn starts for both sides at once (pass and play has no final phase) */
  private finishBattle() {
    // What each side sees as the battle ends is what it knows until the next turn's units move
    if (this.fog && this.computer) this.sighted = { Allies: this.liveSight("Allies"), Axis: this.liveSight("Axis") };
    this.battle = null;
    if (!this.result) for (const side of FACTIONS) this.sessions[side].endTurn();
    this.active = this.person() ?? this.scenario.attacker;
    this.covered = !this.computer;
  }

  /**
   * The end of a turn's battle: the objectives each side holds now count, and a side that has
   * won ends the match
   */
  private scoreTurn() {
    const victory = this.scenario.victory;
    if (!victory || this.result) return;
    const units = {
      Allies: armyOf(this.sessions.Allies).map(({ position }) => position),
      Axis: armyOf(this.sessions.Axis).map(({ position }) => this.turnedRound(position)),
    };
    this.held = heldObjectives(victory.objectives ?? [], units);
    const lost = this.unitsLost();
    const medals = countMedals(lost, this.held);
    const won = winnerOf(victory, medals, { Allies: units.Allies.length, Axis: units.Axis.length });
    if (won) {
      const turn = this.sessions[this.scenario.attacker].getSnapshot().turn;
      this.result = { ...won, turn, medals, lost };
    }
  }

  private unitsLost(): Record<Faction, UnitType[]> {
    return { Allies: this.sessions.Allies.unitsLost(), Axis: this.sessions.Axis.unitsLost() };
  }

  private victoryView(): MatchSnapshot["victory"] {
    const victory = this.scenario.victory;
    if (!victory) return null;
    return { medals: victory.medals, standing: countMedals(this.unitsLost(), this.held), held: this.held };
  }

  /** The person's side, playing against the computer */
  private person(): Faction | null {
    return this.computer ? otherSide(this.computer) : null;
  }

  /** Hits the shot may deal: as many as its unit's figures, one more with a card's dice */
  private shotLimit(side: Faction, index: number): number {
    const session = this.sessions[side];
    const shot = session.getSnapshot().shots[index]!;
    const figures = session.figuresAt(session.orderSummaries()[shot.orderIndex]!.firingFrom) ?? 0;
    return resultLimit(figures, shot.combatBonus);
  }

  /** Something must be settled before anyone fires or the battle ends */
  private busy(): boolean {
    const battle = this.battle;
    if (!battle) return false;
    return (
      !!battle.ground ||
      this.nextRetreat() !== null ||
      FACTIONS.some((side) => this.sessions[side].getSnapshot().attacksPending)
    );
  }

  // --- Attack cards in the shared battle

  /**
   * The side's attack card (Barrage, Air Power…): every hex they marked is rolled, and the
   * hits and flags dealt to the enemy unit standing there now (retreats can't be ignored)
   */
  rollAttacks(side: Faction): boolean {
    const session = this.sessions[side];
    const game = session.getSnapshot();
    if (!this.battle || !game.attacksPending) return false;
    const enemy = this.sessions[otherSide(side)];
    game.attackMarks.forEach(({ marker: index, position: marker }) => {
      if (session.getSnapshot().cardAttacks.some((attack) => attack.marker === index)) return;
      const target = session.enemyAt(marker, { hidden: true });
      session.attackHex(index, target ? target.unitType === UnitType.INFANTRY : null);
      const attack = session.getSnapshot().cardAttacks.find((a) => a.marker === index);
      if (!target || !attack?.target) return;
      const { hits, retreats, hitFaces } = readRoll(attack.faces, attack.target);
      enemy.sufferHits(this.turnedRound(marker), hits, retreats, hitFaces);
    });
    this.settleRetreats();
    return this.publish();
  }

  private battleView(): BattleState | null {
    const battle = this.battle;
    if (!battle) return null;
    const turn = this.battleTurn();
    return {
      turn: battle.turn,
      side: turn?.side ?? null,
      group: turn?.group ?? null,
      fireable: turn ? this.fireable(turn.side, turn.group) : [],
      noTarget: { Allies: this.noTarget("Allies"), Axis: this.noTarget("Axis") },
      attacks: FACTIONS.filter((side) => this.sessions[side].getSnapshot().attacksPending),
      ground: battle.ground,
      retreat: this.retreatView(),
      afterBattle: this.afterBattle(),
    };
  }

  private retreatView(): BattleState["retreat"] {
    const next = this.nextRetreat();
    if (!next) return null;
    const session = this.sessions[next.side];
    const flags = session.getSnapshot().strength.find((unit) => samePosition(unit.position, next.position))?.retreats ?? 0;
    return { ...next, options: session.retreatOptions(next.position), flags };
  }

  /** The other army's units as `viewer` sees them, for its session's targets */
  private enemiesOf(viewer: Faction): EnemyUnit[] {
    const enemy = this.sessions[otherSide(viewer)];
    const seen = this.sightOf(viewer);
    return enemy.board.getAllHexes().flatMap((hex) =>
      hex.unit
        ? [
            {
              position: this.turnedRound(hex.getPosition()),
              unitType: hex.unit.getUnitType(),
              sandbags: hex.sandbags,
              camouflaged: enemy.isCamouflaged(hex.getPosition()),
              ...(seen && !seen.has(positionKey(this.turnedRound(hex.getPosition()))) && { hidden: true }),
            },
          ]
        : []
    );
  }

  // --- Fog of war

  /**
   * The enemy units `viewer` sees now, by hex in its own view, or null when it sees them all (no
   * fog, or no battle yet). Live once the turn's units have moved, until the battle ends: in its
   * units' sight, and those that fired this turn; before that, what it saw when the last battle
   * ended, where those units stood (the enemy's orders move its units on its own board as they're
   * given). Between two people, only in the battle
   */
  private sightOf(viewer: Faction): Set<string> | null {
    if (!this.fog) return null;
    if (this.battle || (this.computer && this.movement)) return new Set(this.liveSight(viewer).map(positionKey));
    return this.computer && this.sighted ? new Set(this.sighted[viewer].map(positionKey)) : null;
  }

  /**
   * The hexes `viewer` sees now, by key in its own view, or null when it sees everything: those
   * in its units' sight (from where they stood when the last battle ended, until the units move)
   * and those of the enemy units it sees
   */
  private sightHexes(viewer: Faction): Set<string> | null {
    const enemies = this.sightOf(viewer);
    if (!enemies) return null;
    const own = this.sessions[viewer];
    const game = own.getSnapshot();
    const moved = !!(this.movement || this.battle) || game.turn <= this.revealedTurn;
    const startOf = new Map(game.orders.map((order) => [order.unit, order.start]));
    const from = this.armyNow(viewer).map(({ unit, position }) => (moved ? position : (startOf.get(unit) ?? position)));
    return new Set([...seenHexes(own.board, from, enemies).map(positionKey), ...enemies]);
  }

  /**
   * Fog of war on a map drawn from `board`'s side (the screens both players share): the hexes to
   * darken and that side's units to leave off, both in its view; null when nothing is hidden now.
   * Against the computer the fog is the person's alone: the computer's units it doesn't see are
   * left off. Between two people (in the battle) a hex is clear only when both sides see it, and
   * each side's units are shown only when the enemy sees them
   */
  fogOn(board: Faction): { dark: Position[]; hidden: Position[] } | null {
    const watchers: readonly Faction[] = this.computer ? [otherSide(this.computer)] : FACTIONS;
    const sights = watchers.map((watcher) => ({ watcher, hexes: this.sightHexes(watcher) }));
    if (sights.some(({ hexes }) => !hexes)) return null;
    const inViewOf = (side: Faction, position: Position) => (side === board ? position : this.turnedRound(position));
    const dark = boardPositions(boardSizeOf(this.scenario)).filter(
      (position) => !sights.every(({ watcher, hexes }) => hexes!.has(positionKey(inViewOf(watcher, position))))
    );
    const enemy = otherSide(board);
    const seenByEnemy = watchers.includes(enemy) ? this.sightOf(enemy) : null;
    const hidden = seenByEnemy
      ? armyOf(this.sessions[board])
          .map(({ position }) => position)
          .filter((position) => !seenByEnemy.has(positionKey(this.turnedRound(position))))
      : [];
    return { dark, hidden };
  }

  /**
   * The enemy units `viewer`'s units see where everything stands now, those that fired at it this
   * turn and, in the battle, its artillery ordered to fire (its view). The other units that can fire
   * at one of its units are always in its sight: their range is shorter than `VISION`
   */
  private liveSight(viewer: Faction): Position[] {
    const own = this.sessions[viewer];
    const enemySide = otherSide(viewer);
    const enemy = this.sessions[enemySide];
    const enemies = this.armyNow(enemySide).map(({ position }) => this.turnedRound(position));
    const seen = inSight(own.board, this.armyNow(viewer).map(({ position }) => position), enemies);
    const orders = enemy.getSnapshot().orders;
    const fired = (this.battle?.fired ?? [])
      .filter((turn) => turn.side === enemySide && turn.shot !== null)
      .flatMap((turn) => {
        const unit = orders[turn.order]?.unit;
        const at = unit && armyOf(enemy).find((placed) => placed.unit === unit);
        return at ? [this.turnedRound(at.position)] : [];
      });
    // Artillery ordered to fire shows itself as soon as the battle starts
    const artillery = this.battle
      ? armyOf(enemy)
          .filter(({ unit }) => unit.getUnitType() === UnitType.ARTILLERY && orders.some((order) => order.unit === unit && order.canFire))
          .map(({ position }) => this.turnedRound(position))
      : [];
    return [...seen, ...fired, ...artillery];
  }

  private rollOf(side: Faction, ref: RollRef | null): ShotRoll | null {
    if (!ref) return null;
    const game = this.sessions[side].getSnapshot();
    return (ref.kind === "shot" ? game.shots[ref.index] : game.standingCollisions[ref.index]) ?? null;
  }

  /**
   * The other army as `viewer` may see it: where its units stand and, once revealed, its orders.
   * Orders move units on their side's board as they're given, so while they're secret their
   * units are shown where the orders started.
   */
  opponentOf(viewer: Faction, { fogged = true }: { fogged?: boolean } = {}): ArmyView {
    const faction = otherSide(viewer);
    const session = this.sessions[faction];
    const game = session.getSnapshot();
    const revealed =
      ordersGiven(game, game.turn) && (game.turn <= this.revealedTurn || this.revealTurn() === game.turn);
    const strength = (position: Position) => {
      const figures = session.figuresAt(position);
      if (figures === null) return {};
      const stands = game.strength.find((s) => samePosition(s.position, position));
      return {
        figures,
        pinned: stands?.pinned ?? false,
        retreats: stands?.retreats ?? 0,
        damaged: stands?.damaged ?? false,
        hitThisTurn: stands?.hitThisTurn ?? 0,
      };
    };
    const startOf = new Map(game.orders.map((order) => [order.unit, order.start]));
    // Fog of war: only the units the viewer sees, by where they stand now once they've moved, by
    // where they started before (what it saw when the last battle ended)
    const sight = fogged ? this.sightOf(viewer) : null;
    // After the battle the units stand where it left them, as when it was last seen
    const live = !!(this.movement || this.battle) || game.turn <= this.revealedTurn;
    const seen = (unit: Unit, position: Position) =>
      !sight || sight.has(positionKey(this.turnedRound(live ? position : (startOf.get(unit) ?? position))));
    // While the units move, each is drawn where the movement has got it to
    const now = this.unitsNow(faction);
    const army = armyOf(session)
      .filter((placed) => seen(placed.unit, now?.get(placed.unit) ?? placed.position))
      .map((placed) => ({ ...placed, ...strength(placed.position), position: now?.get(placed.unit) ?? placed.position }));
    const seenHexes = new Set(army.map((placed) => positionKey(placed.position)));
    const seenStarts = new Set(army.map((placed) => positionKey(startOf.get(placed.unit) ?? placed.position)));
    const visible = (hexes: readonly Position[], at: Set<string>) => (sight ? hexes.filter((hex) => at.has(positionKey(hex))) : [...hexes]);
    const sandbags = session.board.getAllHexes().flatMap((hex) => (hex.sandbags ? [hex.getPosition()] : []));
    if (revealed) {
      const orders = sight ? game.orders.filter((order) => army.some((placed) => placed.unit === order.unit)) : game.orders;
      const summaries = session.orderSummaries();
      const fired = game.orders.filter((order, i) => summaries[i]?.shots.length && orders.includes(order)).map((order) => order.unit);
      // In the battle, the units with a shot they can still use; before it, those whose order lets them fire
      const toFire = this.battle
        ? this.stillToFire(faction).map((index) => game.orders[index]!.unit)
        : orders.filter((order) => order.canFire).map((order) => order.unit);
      return { faction, units: army, orders, fired, toFire: toFire.filter((unit) => orders.some((order) => order.unit === unit)), camouflaged: visible(game.camouflaged, seenHexes), sandbags: visible(sandbags, seenHexes) };
    }

    // A unit that gave all its figures away (Regroup) left as its side confirmed: the enemy sees it until the reveal
    const gone = session.leftByRegroup().filter((placed) => seen(placed.unit, placed.position));
    const units = [
      ...army.map((placed) => ({ ...placed, position: startOf.get(placed.unit) ?? placed.position })),
      ...gone.map(({ unit, position, figures }) => ({ unit, position, figures, pinned: false, retreats: 0, damaged: false, hitThisTurn: 0 })),
    ];
    gone.forEach(({ position }) => seenStarts.add(positionKey(position)));
    // A unit ordered off its sandbags left them, but the enemy can't see that yet
    const left = [...game.orders.flatMap((order) => order.lostSandbags), ...gone.flatMap(({ position, sandbags }) => (sandbags ? [position] : []))];
    return {
      faction,
      units,
      orders: [],
      fired: [],
      toFire: [],
      camouflaged: visible(session.camouflagedAtStart(), seenStarts),
      sandbags: visible([...sandbags, ...left], seenStarts),
    };
  }

  save(): SavedMatch {
    return {
      version: MATCH_SAVE_VERSION,
      sides: { allies: this.sessions.Allies.save(), axis: this.sessions.Axis.save() },
      active: this.active,
      mainSide: this.mainSide,
      computer: this.computer,
      revealedTurn: this.revealedTurn,
      movement: this.movement && JSON.parse(JSON.stringify(this.movement)),
      battle: this.battle && JSON.parse(JSON.stringify(this.battle)),
      held: JSON.parse(JSON.stringify(this.held)),
      result: this.result && JSON.parse(JSON.stringify(this.result)),
      fog: this.fog,
      sighted: this.sighted && JSON.parse(JSON.stringify(this.sighted)),
    };
  }

  /**
   * Rebuild a saved match; `restoreSide` rebuilds one side's game (with its decks). A match is
   * always resumed behind the cover screen, as whoever picks the device up may be either player.
   * Throws if the save doesn't fit.
   */
  static restore(saved: SavedMatch, scenario: Scenario, restoreSide: (saved: SavedGame) => GameSession): PassAndPlayMatch {
    if (saved.version !== MATCH_SAVE_VERSION) throw new Error(`Unsupported match save version ${saved.version}`);
    if (saved.active !== "Allies" && saved.active !== "Axis") throw new Error(`Invalid side ${saved.active}`);
    if (saved.mainSide !== undefined && saved.mainSide !== "Allies" && saved.mainSide !== "Axis") {
      throw new Error(`Invalid side ${saved.mainSide}`);
    }
    const computer = saved.computer ?? null;
    if (computer !== null && computer !== "Allies" && computer !== "Axis") throw new Error(`Invalid side ${computer}`);
    if (!Number.isInteger(saved.revealedTurn)) throw new Error("Invalid revealed turn");
    const sessions = { Allies: restoreSide(saved.sides.allies), Axis: restoreSide(saved.sides.axis) };
    const movement = saved.movement;
    // A save made in the middle of the movement before it went a hex at a time has no run: it's dropped
    if (movement !== null && (!Number.isInteger(movement?.turn) || !Array.isArray(movement.run?.units) || !Array.isArray(movement.rolls))) {
      throw new Error("Invalid movement");
    }
    const battle = saved.battle;
    if (battle !== null && (!Number.isInteger(battle?.turn) || !Array.isArray(battle.fired))) {
      throw new Error("Invalid battle");
    }
    return new PassAndPlayMatch(scenario, sessions, {
      computer,
      active: saved.active,
      mainSide: saved.mainSide,
      revealedTurn: saved.revealedTurn,
      movement,
      battle,
      held: saved.held ?? { Allies: [], Axis: [] },
      result: saved.result ?? null,
      fog: saved.fog ?? false,
      sighted: saved.sighted ?? null,
    });
  }

  /** The turn whose orders both sides have locked and that hasn't been carried out yet, if any */
  private revealTurn(): number | null {
    const attacker = this.sessions[this.scenario.attacker].getSnapshot();
    const defender = this.sessions[otherSide(this.scenario.attacker)].getSnapshot();
    const locked = (game: GameSnapshot) => game.phase === TurnPhase.MOVEMENT;
    const both = locked(attacker) && locked(defender) && attacker.turn === defender.turn;
    return both && attacker.turn > this.revealedTurn ? attacker.turn : null;
  }

  private movementView(): MatchSnapshot["movement"] {
    const movement = this.movement;
    if (!movement) return null;
    const { run } = movement;
    const unitView = (index: number): MovingUnitView => {
      const unit = run.units[index]!;
      return {
        side: unit.side,
        order: unit.order,
        position: unit.position,
        unitType: this.unitAt(unit.side, unit.boardAt)?.getUnitType() ?? (unit.infantry ? UnitType.INFANTRY : UnitType.TANK),
      };
    };
    const collisions = run.collisions.map((collision, i): CollisionView => {
      const rolls = movement.rolls[i] ?? null;
      return {
        step: collision.step,
        kind: collision.kind,
        hex: collision.hex,
        rolled: rolls !== null,
        applied: collision.resolved,
        units: collision.units.map((unit, j) => ({
          ...unitView(unit),
          roll: rolls ? this.rollOf(run.units[unit]!.side, rolls[j] ?? null) : null,
        })) as [CollidingUnitView, CollidingUnitView],
      };
    });
    const overruns = run.overruns.map((overrun): OverrunView => ({
      step: overrun.step,
      hex: overrun.hex,
      armour: run.units[overrun.armour]!.side,
      infantry: run.units[overrun.infantry]!.side,
    }));
    const waits = movement.done ? null : runWaitsFor(run);
    const push = waits === "push" ? nextPush(run, this.passable) : null;
    const choice = push && !push.back && push.options.length > 0 ? push : null;
    return {
      turn: movement.turn,
      step: run.step,
      waiting: waits === null ? null : choice ? "choice" : waits === "step" && run.finished ? null : waits,
      collisions,
      overruns,
      choice: choice && { side: run.units[choice.push.unit]!.side, position: run.units[choice.push.unit]!.position, options: choice.options },
      done: movement.done,
    };
  }

  /** The unit on a side's board at this hex (Allies' view) */
  private unitAt(side: Faction, position: Position): Unit | undefined {
    return this.sessions[side].board.getHex(this.inAlliesView(side, position))?.unit ?? undefined;
  }

  /**
   * While the units are moving, where each of a side's units stands now (in its side's view):
   * its side's board has it where its order ends until the movement is over. Null otherwise
   */
  unitsNow(side: Faction): ReadonlyMap<Unit, Position> | null {
    const movement = this.movement;
    if (!movement || movement.done) return null;
    return new Map(
      movement.run.units.flatMap((unit) => {
        const placed = unit.side === side && !unit.gone ? this.unitAt(side, unit.boardAt) : undefined;
        return placed ? [[placed, this.inAlliesView(side, unit.position)] as const] : [];
      })
    );
  }

  /** A side's units and where they stand now: during the movement, where it has got them to */
  private armyNow(side: Faction): { unit: Unit; position: Position }[] {
    const now = this.unitsNow(side);
    return armyOf(this.sessions[side]).map((placed) => ({ ...placed, position: now?.get(placed.unit) ?? placed.position }));
  }

  private canPass(): boolean {
    return !this.computer && !this.covered && this.revealTurn() === null && !this.battle;
  }

  private handOver() {
    // Against the computer the device never changes hands
    if (this.computer) return;
    this.active = otherSide(this.active);
    this.covered = true;
  }

  /** Move the match along after a side's game changed */
  private follow() {
    // Orders locked: the other side gives its own, out of sight
    const mine = this.activeSession().getSnapshot();
    const theirs = this.sessions[otherSide(this.active)].getSnapshot();
    if (!this.covered && mine.phase === TurnPhase.MOVEMENT && !ordersGiven(theirs, mine.turn)) {
      this.handOver();
    }
  }

  private onSessionChange = () => {
    this.follow();
    this.publish();
  };

  private createSnapshot(): MatchSnapshot {
    return {
      active: this.active,
      covered: this.covered,
      revealTurn: this.revealTurn(),
      canPass: this.canPass(),
      movement: this.movementView(),
      battle: this.battleView(),
      victory: this.victoryView(),
      result: this.result,
    };
  }

  private publish(): true {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default PassAndPlayMatch;
