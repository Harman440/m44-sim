import GameSession, { EnemyUnit, GameSnapshot, ShotRoll } from "./gameSession";
import { SavedGame } from "./saveGame";
import Unit, { UnitType } from "./unit";
import Order from "./order";
import { turnedRound } from "./BoardManager";
import { samePosition } from "./position";
import { Collision, moveSimultaneously, Mover, Stander } from "./simultaneousMove";
import { appliedFaces, readRoll } from "./rollResult";
import { resultLimit } from "../data/figures";
import { Faction, FACTIONS } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";

/** Bump when the shape of `SavedMatch` changes: older saves are dropped, not migrated */
export const MATCH_SAVE_VERSION = 4;

/** A pass and play match as plain JSON: each side's game, whose turn it is on the device, the last turn revealed */
export interface SavedMatch {
  version: typeof MATCH_SAVE_VERSION;
  sides: { allies: SavedGame; axis: SavedGame };
  active: Faction;
  revealedTurn: number;
  movement: MatchMovement | null;
  battle: MatchBattle | null;
}

/** The units that didn't move fire first, then the ones that moved */
export type FireGroup = "unmoved" | "moved";

/**
 * The shared battle: both sides take turns to fire, one unit at a time, the attacker first in
 * each group (house rules, "Battle phase")
 */
export interface MatchBattle {
  turn: number;
  /** Each turn to fire so far, in order: a shot (its index in its side's shots) or a unit holding its fire (null) */
  fired: { side: Faction; group: FireGroup; order: number; shot: number | null }[];
  /** A shot rolled but not dealt yet: its player still picks the results it applies */
  pending: { side: Faction; shot: number } | null;
}

/** The battle for the screen */
export interface BattleState {
  turn: number;
  /** Whose turn it is to fire, and in which group; null once nobody can fire */
  side: Faction | null;
  group: FireGroup | null;
  /** The order indexes of that side's units that can fire now */
  fireable: readonly number[];
  pending: { side: Faction; shot: number; limit: number; mustChoose: boolean } | null;
}

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
 * couldn't battle: its order didn't let it fire, it was marked to retreat, or it was destroyed
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
  /** Results it may apply (limited damage: as many as its figures) */
  limit: number;
  /** Its roll has more results than it may apply: the player picks which dice count */
  mustChoose: boolean;
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
}

/** A unit and where it stands, as seen from its own side of the table */
export interface PlacedUnit {
  position: Position;
  unit: Unit;
  /** Its figures left and the hexes it must retreat after the battle (`ArmyView`) */
  figures?: number;
  retreats?: number;
}

/** One army as another side may see it, each position in the army's own view */
export interface ArmyView {
  faction: Faction;
  units: readonly PlacedUnit[];
  /** Its orders this turn, once they've been revealed; none while they're secret */
  orders: readonly Order[];
}

/** A side's position in the Allies' view of the board, or back: the Axis sees it turned round */
const inAlliesView = (side: Faction, position: Position): Position =>
  side === "Axis" ? turnedRound(position) : position;

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
 * The turn: the attacker plays the extra first turn alone, then the defender joins in. Each
 * turn, the side holding the device picks its cards and gives its orders; locking them hands
 * the device to the other side if it hasn't given its own yet. Once both have, the reveal shows
 * both cards and both armies' orders; then each side plays its movement, battle and final phase.
 */
class PassAndPlayMatch {
  readonly scenario: Scenario;
  readonly sessions: Readonly<Record<Faction, GameSession>>;
  private active: Faction;
  private covered: boolean;
  /** The last turn whose orders were shown to both players and carried out */
  private revealedTurn: number;
  private movement: MatchMovement | null;
  private battle: MatchBattle | null;

  private readonly listeners = new Set<() => void>();
  private snapshot: MatchSnapshot;

  constructor(
    scenario: Scenario,
    sessions: Record<Faction, GameSession>,
    {
      active = scenario.attacker,
      covered = true,
      revealedTurn = 0,
      movement = null,
      battle = null,
    }: {
      active?: Faction;
      covered?: boolean;
      revealedTurn?: number;
      movement?: MatchMovement | null;
      battle?: MatchBattle | null;
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
    this.active = active;
    this.covered = covered;
    this.revealedTurn = revealedTurn;
    this.movement = movement;
    this.battle = battle;
    for (const side of FACTIONS) sessions[side].setEnemyView(() => this.enemiesOf(side));
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

  /**
   * The player hands the device to the other side: the cover screen goes up. Not while the
   * other side waits out the attacker's extra turn, as it has nothing to do yet
   */
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
   * enemy stop and collide, units held up by their own stop behind them
   */
  moveUnits(): boolean {
    const turn = this.revealTurn();
    if (turn === null || this.movement?.turn === turn) return false;

    const movers: Mover[] = [];
    const standers: Stander[] = [];
    for (const side of FACTIONS) {
      const session = this.sessions[side];
      const { orders } = session.getSnapshot();
      const view = (position: Position) => inAlliesView(side, position);
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
        .map((end) => ({ order: end.order, at: inAlliesView(side, end.end) }));
      if (halts.length > 0 && !this.sessions[side].haltOrders(halts)) return false;
    }
    this.movement = {
      turn,
      collisions: result.collisions.map((collision) => ({ ...collision, rolls: null, applied: false })),
    };
    return this.publish();
  }

  /**
   * Both units of the collision roll at once: close assault dice minus 1, terrain ignored. A unit
   * that can't battle doesn't roll. The results are dealt at once, unless a unit rolled more
   * results than it may apply: then its player picks them (`keepCollisionResults`) and
   * `applyCollision` deals them
   */
  rollCollision(index: number): boolean {
    const collision = this.movement?.collisions[index];
    if (!collision || collision.rolls) return false;
    const units = collision.units.map((unit) => ({ ...unit, at: inAlliesView(unit.side, unit.position) }));
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
    if (!this.mustChoose(index)) this.applyCollision(index);
    return this.publish();
  }

  /** The player of the collision's unit `unit` (0 or 1) applies only these dice, or all with null */
  keepCollisionResults(index: number, unit: 0 | 1, kept: readonly number[] | null): boolean {
    const collision = this.movement?.collisions[index];
    const ref = collision?.rolls?.[unit];
    if (!collision || collision.applied || !ref) return false;
    const session = this.sessions[collision.units[unit].side];
    if (ref.kind === "standing") return session.keepStandingResults(ref.index, kept);
    const shots = session.getSnapshot().shots;
    const shot = shots[ref.index]!;
    const number = shots.filter((s, i) => s.orderIndex === shot.orderIndex && i < ref.index).length;
    return session.keepResults(shot.orderIndex, number, kept);
  }

  /** Deal both units' results at once: each the hits and flags of the other's roll */
  applyCollision(index: number): boolean {
    const collision = this.movement?.collisions[index];
    if (!collision?.rolls || collision.applied || this.mustChoose(index)) return false;
    const results = collision.units.map((unit, i) => {
      const roll = this.rollOf(unit.side, collision.rolls![i]!);
      return roll ? readRoll(appliedFaces(roll.faces, roll.kept), roll.target) : null;
    });
    collision.units.forEach((unit, i) => {
      const result = results[1 - i];
      if (result) this.sessions[unit.side].sufferHits(inAlliesView(unit.side, unit.position), result.hits, result.retreats);
    });
    this.updateCollision(index, { applied: true });
    return this.publish();
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
    this.battle = { turn, fired: [], pending: null };
    for (const side of FACTIONS) this.sessions[side].startBattle();
    this.active = this.scenario.attacker;
    this.covered = false;
    return this.publish();
  }

  // --- The battle: the sides take turns to fire, one unit at a time

  /**
   * The side whose turn it is to fire, and the group: the units that didn't move first, then
   * the ones that moved. In each group the attacker fires first and the sides alternate; a side
   * with nothing left to fire lets the other go on. Null once nobody can fire
   */
  private battleTurn(): { side: Faction; group: FireGroup } | null {
    const battle = this.battle;
    if (!battle || battle.pending) return null;
    const group: FireGroup | null = FACTIONS.some((side) => this.fireable(side, "unmoved").length > 0)
      ? "unmoved"
      : FACTIONS.some((side) => this.fireable(side, "moved").length > 0)
        ? "moved"
        : null;
    if (!group) return null;
    const can = (side: Faction) => this.fireable(side, group).length > 0;
    const last = battle.fired.filter((turn) => turn.group === group).at(-1);
    const first = last ? otherSide(last.side) : this.scenario.attacker;
    return { side: can(first) ? first : otherSide(first), group };
  }

  /** The order indexes of a side's units that can still fire in this group */
  private fireable(side: Faction, group: FireGroup): number[] {
    const battle = this.battle;
    const session = this.sessions[side];
    if (!battle || session.getSnapshot().phase !== TurnPhase.BATTLE) return [];
    const held = new Set(battle.fired.filter((turn) => turn.side === side && turn.shot === null).map((turn) => turn.order));
    return session
      .orderSummaries()
      .filter((summary) => summary.shotsLeft > 0 && !held.has(summary.index))
      .filter((summary) => (group === "unmoved") === summary.hold)
      .map((summary) => summary.index);
  }

  /**
   * The unit of the side whose turn it is fires at an enemy hex. The hits and flags are dealt at
   * once, unless the unit rolled more results than it has figures: its player picks them first
   * (`keepShotResults`, then `applyShot`)
   */
  fire(order: number, target: Position, useCombatBonus = false): boolean {
    const turn = this.battleTurn();
    if (!turn || !this.fireable(turn.side, turn.group).includes(order)) return false;
    const session = this.sessions[turn.side];
    // The units that moved fire once every unit that didn't move has fired, on either side
    if (turn.group === "moved" && session.orderSummaries().some((s) => s.hold && s.shotsLeft > 0)) {
      session.skipUnmovedFire();
    }
    const shot = session.getSnapshot().shots.length;
    if (!session.fireAt(order, { position: target, infantry: true, sandbags: false, useCombatBonus })) return false;

    const battle = this.battle!;
    this.battle = {
      ...battle,
      fired: [...battle.fired, { side: turn.side, group: turn.group, order, shot }],
      pending: { side: turn.side, shot },
    };
    if (!this.shotMustChoose()) this.applyShot();
    return this.publish();
  }

  /** The unit whose turn it is holds its fire: it gives up its shot */
  holdFire(order: number): boolean {
    const turn = this.battleTurn();
    if (!turn || !this.fireable(turn.side, turn.group).includes(order)) return false;
    const battle = this.battle!;
    this.battle = { ...battle, fired: [...battle.fired, { side: turn.side, group: turn.group, order, shot: null }] };
    return this.publish();
  }

  /** The player of the shot waiting to be dealt applies only these dice, or all with null */
  keepShotResults(kept: readonly number[] | null): boolean {
    const pending = this.battle?.pending;
    if (!pending) return false;
    const session = this.sessions[pending.side];
    const shots = session.getSnapshot().shots;
    const shot = shots[pending.shot]!;
    const number = shots.filter((s, i) => s.orderIndex === shot.orderIndex && i < pending.shot).length;
    return session.keepResults(shot.orderIndex, number, kept);
  }

  /** Deal the shot's hits and flags to the enemy unit; sandbags there ignore 1 flag */
  applyShot(): boolean {
    const pending = this.battle?.pending;
    if (!pending || this.shotMustChoose()) return false;
    const shot = this.sessions[pending.side].getSnapshot().shots[pending.shot]!;
    const enemy = this.sessions[otherSide(pending.side)];
    const at = turnedRound(shot.targetPosition!);
    const { hits, retreats } = readRoll(appliedFaces(shot.faces, shot.kept), shot.target);
    const sandbags = enemy.board.getHex(at)?.sandbags ? 1 : 0;
    enemy.sufferHits(at, hits, Math.max(0, retreats - sandbags));
    this.battle = { ...this.battle!, pending: null };
    return this.publish();
  }

  /** The battle is over (units that haven't fired lose their shot): each side goes on to its final phase */
  endBattle(): boolean {
    if (!this.battle || this.battle.pending) return false;
    for (const side of FACTIONS) this.sessions[side].endBattle();
    this.battle = null;
    this.active = this.scenario.attacker;
    this.covered = true;
    return this.publish();
  }

  /** Results the pending shot's unit may apply: as many as its figures, one more with a card's dice */
  private shotLimit(): number {
    const pending = this.battle!.pending!;
    const session = this.sessions[pending.side];
    const shot = session.getSnapshot().shots[pending.shot]!;
    const from = session.orderSummaries()[shot.orderIndex]!.firingFrom;
    return resultLimit(session.figuresAt(from) ?? 0, shot.combatBonus);
  }

  private shotMustChoose(): boolean {
    const pending = this.battle?.pending;
    if (!pending) return false;
    const shot = this.sessions[pending.side].getSnapshot().shots[pending.shot]!;
    const { hits, retreats } = readRoll(appliedFaces(shot.faces, shot.kept), shot.target);
    return hits + retreats > this.shotLimit();
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
      pending: battle.pending && { ...battle.pending, limit: this.shotLimit(), mustChoose: this.shotMustChoose() },
    };
  }

  /** The other army's units as `viewer` sees them, for its session's targets */
  private enemiesOf(viewer: Faction): EnemyUnit[] {
    const enemy = this.sessions[otherSide(viewer)];
    return enemy.board.getAllHexes().flatMap((hex) =>
      hex.unit
        ? [{ position: turnedRound(hex.getPosition()), unitType: hex.unit.getUnitType(), sandbags: hex.sandbags }]
        : []
    );
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

  /** Results the collision's unit may apply: as many as its figures */
  private limitOf(side: Faction, position: Position): number {
    return resultLimit(this.sessions[side].figuresAt(inAlliesView(side, position)) ?? 0, false);
  }

  /** A unit of the rolled collision has more results than it may apply, and its player hasn't picked */
  private mustChoose(index: number): boolean {
    const collision = this.movement!.collisions[index]!;
    if (!collision.rolls || collision.applied) return false;
    return collision.units.some((unit, i) => {
      const roll = this.rollOf(unit.side, collision.rolls![i]!);
      if (!roll) return false;
      const { hits, retreats } = readRoll(appliedFaces(roll.faces, roll.kept), roll.target);
      return hits + retreats > this.limitOf(unit.side, unit.position);
    });
  }

  /**
   * The other army as `viewer` may see it: where its units stand and, once revealed, its orders.
   * Orders move units on their side's board as they're given, so while they're secret their
   * units are shown where the orders started.
   */
  opponentOf(viewer: Faction): ArmyView {
    const faction = otherSide(viewer);
    const session = this.sessions[faction];
    const game = session.getSnapshot();
    const revealed =
      ordersGiven(game, game.turn) && (game.turn <= this.revealedTurn || this.revealTurn() === game.turn);
    const strength = (position: Position) => {
      const figures = session.figuresAt(position);
      if (figures === null) return {};
      const retreats = game.strength.find((s) => samePosition(s.position, position))?.retreats ?? 0;
      return { figures, retreats };
    };
    const army = armyOf(session).map((placed) => ({ ...placed, ...strength(placed.position) }));
    if (revealed) return { faction, units: army, orders: game.orders };

    const startOf = new Map(game.orders.map((order) => [order.unit, order.start]));
    const units = army.map((placed) => ({ ...placed, position: startOf.get(placed.unit) ?? placed.position }));
    return { faction, units, orders: [] };
  }

  save(): SavedMatch {
    return {
      version: MATCH_SAVE_VERSION,
      sides: { allies: this.sessions.Allies.save(), axis: this.sessions.Axis.save() },
      active: this.active,
      revealedTurn: this.revealedTurn,
      movement: this.movement && JSON.parse(JSON.stringify(this.movement)),
      battle: this.battle && JSON.parse(JSON.stringify(this.battle)),
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
      active: saved.active,
      revealedTurn: saved.revealedTurn,
      movement,
      battle,
    });
  }

  /**
   * The turn whose orders both sides have locked and that hasn't been carried out yet, if any; in
   * the extra first turn, the attacker's alone
   */
  private revealTurn(): number | null {
    const attacker = this.sessions[this.scenario.attacker].getSnapshot();
    const defender = this.sessions[otherSide(this.scenario.attacker)].getSnapshot();
    const locked = (game: GameSnapshot) => game.phase === TurnPhase.MOVEMENT;
    const both = locked(attacker) && locked(defender) && attacker.turn === defender.turn;
    const alone = locked(attacker) && attacker.turn === 1 && defender.phase === TurnPhase.AWAIT_ATTACKER;
    return (both || alone) && attacker.turn > this.revealedTurn ? attacker.turn : null;
  }

  private movementView(): MatchSnapshot["movement"] {
    const movement = this.movement;
    if (!movement) return null;
    const collisions = movement.collisions.map(({ rolls, units, applied, ...collision }, index): CollisionView => ({
      ...collision,
      rolled: rolls !== null,
      applied,
      units: units.map((unit, i) => {
        const roll = rolls ? this.rollOf(unit.side, rolls[i]!) : null;
        const limit = this.limitOf(unit.side, unit.position);
        const results = roll ? readRoll(appliedFaces(roll.faces, roll.kept), roll.target) : null;
        return {
          ...unit,
          unitType:
            this.sessions[unit.side].board.getHex(inAlliesView(unit.side, unit.position))?.unit?.getUnitType() ??
            UnitType.INFANTRY,
          roll,
          limit,
          mustChoose: !applied && !!results && results.hits + results.retreats > limit && this.mustChoose(index),
        };
      }) as [CollidingUnitView, CollidingUnitView],
    }));
    return { turn: movement.turn, collisions, done: collisions.every((collision) => collision.applied) };
  }

  private canPass(): boolean {
    if (this.covered || this.revealTurn() !== null || this.battle) return false;
    return this.sessions[otherSide(this.active)].getSnapshot().phase !== TurnPhase.AWAIT_ATTACKER;
  }

  private handOver() {
    this.active = otherSide(this.active);
    this.covered = true;
  }

  /** Move the match along after a side's game changed */
  private follow() {
    const attacker = this.sessions[this.scenario.attacker];
    const defender = this.sessions[otherSide(this.scenario.attacker)];
    // The defender only waited out the attacker's extra turn on its own device; here it joins
    // in as soon as that turn is over. Holding the device, the attacker picks its cards first
    if (defender.getSnapshot().phase === TurnPhase.AWAIT_ATTACKER && attacker.getSnapshot().turn > 1) {
      defender.startFirstTurn();
    }

    // Orders locked: the other side gives its own, out of sight
    const mine = this.activeSession().getSnapshot();
    const theirs = this.sessions[otherSide(this.active)].getSnapshot();
    const waiting = theirs.phase === TurnPhase.AWAIT_ATTACKER;
    if (!this.covered && mine.phase === TurnPhase.MOVEMENT && !waiting && !ordersGiven(theirs, mine.turn)) {
      this.handOver();
    }
  }

  private following = false;

  private onSessionChange = () => {
    // Starting the defender's turn changes a session too: follow it once
    if (this.following) return;
    this.following = true;
    try {
      this.follow();
    } finally {
      this.following = false;
    }
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
    };
  }

  private publish(): true {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default PassAndPlayMatch;
