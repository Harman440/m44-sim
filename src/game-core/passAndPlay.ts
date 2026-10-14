import GameSession, { GameSnapshot } from "./gameSession";
import { SavedGame } from "./saveGame";
import Unit from "./unit";
import Order from "./order";
import { Faction } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";

/** Bump when the shape of `SavedMatch` changes: older saves are dropped, not migrated */
export const MATCH_SAVE_VERSION = 2;

/** A pass and play match as plain JSON: each side's game, whose turn it is on the device, the last turn revealed */
export interface SavedMatch {
  version: typeof MATCH_SAVE_VERSION;
  sides: { allies: SavedGame; axis: SavedGame };
  active: Faction;
  revealedTurn: number;
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
}

/** A unit and where it stands, as seen from its own side of the table */
export interface PlacedUnit {
  position: Position;
  unit: Unit;
}

/** One army as another side may see it, each position in the army's own view */
export interface ArmyView {
  faction: Faction;
  units: readonly PlacedUnit[];
  /** Its orders this turn, once they've been revealed; none while they're secret */
  orders: readonly Order[];
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
  /** The last turn whose orders were shown to both players */
  private revealedTurn: number;

  private readonly listeners = new Set<() => void>();
  private snapshot: MatchSnapshot;

  constructor(
    scenario: Scenario,
    sessions: Record<Faction, GameSession>,
    { active = scenario.attacker, covered = true, revealedTurn = 0 }: { active?: Faction; covered?: boolean; revealedTurn?: number } = {}
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
   * Both players have seen the orders: the attacker goes on with movement, battle and the
   * final phase, behind the cover screen
   */
  finishReveal(): boolean {
    const turn = this.revealTurn();
    if (turn === null) return false;
    this.revealedTurn = turn;
    this.active = this.scenario.attacker;
    this.covered = true;
    return this.publish();
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
    if (revealed) return { faction, units: armyOf(session), orders: game.orders };

    const startOf = new Map(game.orders.map((order) => [order.unit, order.start]));
    const units = armyOf(session).map(({ position, unit }) => ({ position: startOf.get(unit) ?? position, unit }));
    return { faction, units, orders: [] };
  }

  save(): SavedMatch {
    return {
      version: MATCH_SAVE_VERSION,
      sides: { allies: this.sessions.Allies.save(), axis: this.sessions.Axis.save() },
      active: this.active,
      revealedTurn: this.revealedTurn,
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
    return new PassAndPlayMatch(scenario, sessions, { active: saved.active, revealedTurn: saved.revealedTurn });
  }

  /** The turn whose orders both sides have locked and nobody has seen yet, if any */
  private revealTurn(): number | null {
    const allies = this.sessions.Allies.getSnapshot();
    const axis = this.sessions.Axis.getSnapshot();
    const both = allies.phase === TurnPhase.MOVEMENT && axis.phase === TurnPhase.MOVEMENT && allies.turn === axis.turn;
    return both && allies.turn > this.revealedTurn ? allies.turn : null;
  }

  private canPass(): boolean {
    if (this.covered || this.revealTurn() !== null) return false;
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
    return { active: this.active, covered: this.covered, revealTurn: this.revealTurn(), canPass: this.canPass() };
  }

  private publish(): true {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default PassAndPlayMatch;
