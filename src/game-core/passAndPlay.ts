import GameSession, { EnemyUnit, GameSnapshot, ShotRoll } from "./gameSession";
import { SavedGame } from "./saveGame";
import Unit, { UnitType } from "./unit";
import Order from "./order";
import { turnedRound } from "./BoardManager";
import { boardPositions, boardSizeOf } from "./boardSize";
import { includesPosition, positionKey, samePosition } from "./position";
import { hexDistance } from "./fireTargets";
import { inSight, seenHexes } from "./fogOfWar";
import { Collision, CollidingUnit, moveSimultaneously, Mover, Stander } from "./simultaneousMove";
import { appliedFaces, keptForHits, readRoll } from "./rollResult";
import { OrderSummary } from "./turnSummary";
import { MatchResult, Medals, countMedals, heldObjectives, winnerOf } from "./victory";
import { resultLimit } from "../data/figures";
import { Faction, FACTIONS } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import type { Localized } from "../i18n/lang";

/** Bump when the shape of `SavedMatch` (or what it means) changes: older saves are dropped, not migrated */
export const MATCH_SAVE_VERSION = 18;

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

/** A unit a card makes fire before any other (Behind Enemy Lines), then the units that didn't move, then the ones that moved */
export type FireGroup = "first" | "unmoved" | "moved";

const FIRE_GROUPS: readonly FireGroup[] = ["first", "unmoved", "moved"];

/** The group a unit fires in */
const groupOf = (summary: OrderSummary): FireGroup => (summary.firesFirst ? "first" : summary.unmovedGroup ? "unmoved" : "moved");

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

/** The turn's movement, carried out by the app: the collisions to roll, each once rolled */
export interface MatchMovement {
  turn: number;
  collisions: MatchCollision[];
}

/**
 * A collision of the turn's movement: `rolls` once rolled, each unit's (null for a unit that
 * couldn't battle: its order didn't let it fire, it was made to retreat, or it was destroyed
 * in an earlier collision); `applied` once its hits and flags have been dealt
 */
export interface MatchCollision extends Collision {
  rolls: [RollRef | null, RollRef | null] | null;
  applied: boolean;
}

/** One of a collision's units, for the screen: positions in the Allies' view, as in `Collision` */
export interface CollidingUnitView {
  side: Faction;
  order: number | null;
  position: Position;
  unitType: UnitType;
  /** Its roll, once the collision is rolled; null too for a unit that couldn't battle */
  roll: ShotRoll | null;
}

export interface CollisionView extends Omit<Collision, "units"> {
  units: [CollidingUnitView, CollidingUnitView];
  rolled: boolean;
  applied: boolean;
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
  /**
   * The units of the turn being revealed have moved: the collisions, each with both units'
   * rolls once rolled; `done` once every one has been dealt. Null before "Mover"
   */
  movement: { turn: number; collisions: readonly CollisionView[]; done: boolean } | null;
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
   * Carry out the revealed orders, both sides at once and one hex at a time: units that meet an
   * enemy stop and collide; units of one side don't hold each other up
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
      orders.forEach((order, index) => {
        if (samePosition(order.start, order.end)) standers.push({ side, order: index, position: view(order.start) });
        else movers.push({ side, order: index, path: (order.path ?? [order.start, order.end]).map(view) });
      });
      const ordered = new Set(orders.map((order) => order.unit));
      armyOf(session)
        .filter(({ unit }) => !ordered.has(unit))
        .forEach(({ position }) => standers.push({ side, order: null, position: view(position) }));
    }

    const result = moveSimultaneously(movers, standers);
    for (const side of FACTIONS) {
      const halts = result.ends
        .filter((end) => end.side === side && end.stopped)
        .map((end) => ({ order: end.order, at: this.inAlliesView(side, end.end) }));
      if (halts.length > 0 && !this.sessions[side].haltOrders(halts)) return false;
    }
    // The tanks that went through barbed wire took it off the other side's board too
    this.settleWire();
    this.movement = {
      turn,
      collisions: result.collisions.map((collision) => ({ ...collision, rolls: null, applied: false })),
    };
    return this.publish();
  }

  /**
   * Both units of the collision roll at once: close assault dice minus 1, terrain ignored. A unit
   * that can't battle doesn't roll. The results are dealt at once, each roll's hits cut down to
   * its unit's figures (limited damage)
   */
  rollCollision(index: number): boolean {
    const collision = this.movement?.collisions[index];
    if (!collision || collision.rolls) return false;
    const units = collision.units.map((unit) => ({ ...unit, at: this.inAlliesView(unit.side, unit.position) }));
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

    this.updateCollision(index, { rolls });
    rolls.forEach((ref, i) => {
      const unit = units[i]!;
      if (ref) this.limitDamage(unit.side, ref, this.limitOf(unit.side, unit.position));
    });
    this.applyCollision(index);
    return this.publish();
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

  /** Deal both units' results at once: each the hits and flags of the other's roll */
  private applyCollision(index: number) {
    const collision = this.movement?.collisions[index];
    if (!collision?.rolls || collision.applied) return;
    const results = collision.units.map((unit, i) => {
      const roll = this.rollOf(unit.side, collision.rolls![i]!);
      return roll ? readRoll(appliedFaces(roll.faces, roll.kept), roll.target) : null;
    });
    collision.units.forEach((unit, i) => {
      const result = results[1 - i];
      if (result) {
        this.sessions[unit.side].sufferHits(this.inAlliesView(unit.side, unit.position), result.hits, result.retreats, result.hitFaces);
      }
    });
    this.updateCollision(index, { applied: true });
    // No flag on either side: neither unit holds the ground, and the units that moved go back
    if (!results.some((result) => result && result.retreats > 0)) {
      collision.units.forEach((unit) => this.bounceBack(unit));
    }
  }

  /**
   * After a collision that made neither unit retreat, a unit that moved goes one hex back along
   * its path (house rule). It stays where it is when it didn't move, was destroyed, never left
   * its start hex, or the hex behind it is taken. Its other collisions follow it
   */
  private bounceBack(unit: CollidingUnit) {
    if (unit.order === null) return;
    const session = this.sessions[unit.side];
    const order = session.getSnapshot().orders[unit.order];
    const at = this.inAlliesView(unit.side, unit.position);
    if (!order || !session.board.getHex(at)?.unit || !samePosition(order.end, at)) return;
    const path = order.path ?? [];
    if (path.length < 2) return;
    const back = path[path.length - 2]!;
    const enemyBoard = this.sessions[otherSide(unit.side)].board;
    if (session.board.getHex(back)?.unit || enemyBoard.getHex(this.turnedRound(back))?.unit) return;
    if (!session.haltOrders([{ order: unit.order, at: back }])) return;
    const moved = this.inAlliesView(unit.side, back);
    this.movement = {
      ...this.movement!,
      collisions: this.movement!.collisions.map((collision) => ({
        ...collision,
        units: collision.units.map((u) =>
          u.side === unit.side && u.order === unit.order ? { ...u, position: moved } : u
        ) as MatchCollision["units"],
      })),
    };
  }

  /**
   * Both players have seen the orders and the moves, and every collision has been dealt: the
   * attacker goes on with the battle and the final phase, behind the cover screen
   */
  finishReveal(): boolean {
    const turn = this.revealTurn();
    if (turn === null || this.movement?.turn !== turn) return false;
    if (this.movement.collisions.some((collision) => !collision.applied)) return false;
    this.revealedTurn = turn;
    this.movement = null;
    // The battle, on one screen for both players
    this.battle = { turn, fired: [], assault: null, ground: null, bonus: null };
    for (const side of FACTIONS) this.sessions[side].startBattle();
    // A unit given a second flag in a collision retreats now, before anyone fires
    this.settleRetreats();
    this.active = this.person() ?? this.scenario.attacker;
    this.covered = false;
    return this.publish();
  }

  // --- The battle: the sides take turns to fire, one unit at a time

  /**
   * The side whose turn it is to fire, and the group: a unit given Behind Enemy Lines first, then
   * the units that didn't move (with ¡Fusiles arriba!'s moved infantry), then the ones that moved. In each group the attacker fires first and the sides alternate; a side
   * with nothing left to fire lets the other go on. Null once nobody can fire
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

  /** The order indexes of a side's units that can still fire this battle, in any group (not those that held their fire) */
  stillToFire(side: Faction): number[] {
    return [...new Set(FIRE_GROUPS.flatMap((group) => this.fireable(side, group)))];
  }

  /** The order indexes of a side's units that can still fire in this group */
  private fireable(side: Faction, group: FireGroup): number[] {
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
      .filter((summary) => groupOf(summary) === group)
      .map((summary) => summary.index);
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
    // no shell left for its shot more
    const pushedBack = session.getSnapshot().shots.findLast((s) => s.orderIndex === ground.order)?.pushedBack;
    const canFire = (session.orderSummaries()[ground.order]?.shotsLeft ?? 0) > 0;
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
    const from = armyOf(own).map(({ unit, position }) => (moved ? position : (startOf.get(unit) ?? position)));
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
    const enemies = armyOf(enemy).map(({ position }) => this.turnedRound(position));
    const seen = inSight(own.board, armyOf(own).map(({ position }) => position), enemies);
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

  private updateCollision(index: number, changes: Partial<MatchCollision>) {
    this.movement = {
      ...this.movement!,
      collisions: this.movement!.collisions.map((c, i) => (i === index ? { ...c, ...changes } : c)),
    };
  }

  private rollOf(side: Faction, ref: RollRef | null): ShotRoll | null {
    if (!ref) return null;
    const game = this.sessions[side].getSnapshot();
    return (ref.kind === "shot" ? game.shots[ref.index] : game.standingCollisions[ref.index]) ?? null;
  }

  /** Hits the collision's unit may deal: as many as its figures */
  private limitOf(side: Faction, position: Position): number {
    return resultLimit(this.sessions[side].figuresAt(this.inAlliesView(side, position)) ?? 0, false);
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
    const army = armyOf(session)
      .filter((placed) => seen(placed.unit, placed.position))
      .map((placed) => ({ ...placed, ...strength(placed.position) }));
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

    const units = army.map((placed) => ({ ...placed, position: startOf.get(placed.unit) ?? placed.position }));
    // A unit ordered off its sandbags left them, but the enemy can't see that yet
    const left = game.orders.flatMap((order) => order.lostSandbags);
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
    if (movement !== null && (!Number.isInteger(movement?.turn) || !Array.isArray(movement.collisions))) {
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
    const collisions = movement.collisions.map(({ rolls, units, applied, ...collision }): CollisionView => ({
      ...collision,
      rolled: rolls !== null,
      applied,
      units: units.map((unit, i) => {
        const roll = rolls ? this.rollOf(unit.side, rolls[i]!) : null;
        return {
          ...unit,
          unitType:
            this.sessions[unit.side].board.getHex(this.inAlliesView(unit.side, unit.position))?.unit?.getUnitType() ??
            UnitType.INFANTRY,
          roll,
        };
      }) as [CollidingUnitView, CollidingUnitView],
    }));
    return { turn: movement.turn, collisions, done: collisions.every((collision) => collision.applied) };
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
