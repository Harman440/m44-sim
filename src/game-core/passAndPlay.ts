import GameSession from "./gameSession";
import { SavedGame } from "./saveGame";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";

/** Bump when the shape of `SavedMatch` changes: older saves are dropped, not migrated */
export const MATCH_SAVE_VERSION = 1;

/** A pass and play match as plain JSON: each side's game, and whose turn it is on the device */
export interface SavedMatch {
  version: typeof MATCH_SAVE_VERSION;
  sides: { allies: SavedGame; axis: SavedGame };
  active: Faction;
}

export interface MatchSnapshot {
  /** The side whose player holds the device */
  active: Faction;
  /** The cover screen is up: the device is changing hands, nothing of either side shows */
  covered: boolean;
}

const otherSide = (faction: Faction): Faction => (faction === "Axis" ? "Allies" : "Axis");

/**
 * Pass and play: both sides on one device. Each side keeps its own `GameSession` (hand, decks,
 * coins, orders), so the rules of the one-side game run unchanged; the match only tracks who
 * holds the device and puts a cover screen up whenever it changes hands, so neither player sees
 * the other's cards and orders. The attacker starts, as in the one-side game.
 */
class PassAndPlayMatch {
  readonly scenario: Scenario;
  readonly sessions: Readonly<Record<Faction, GameSession>>;
  private active: Faction;
  private covered: boolean;

  private readonly listeners = new Set<() => void>();
  private snapshot: MatchSnapshot;

  constructor(scenario: Scenario, sessions: Record<Faction, GameSession>, active: Faction = scenario.attacker, covered = true) {
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
    this.snapshot = { active, covered };
  }

  /** Listens to the match and to both sides' games, e.g. to save after every change */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    const unsubscribes = [this.sessions.Allies.subscribe(listener), this.sessions.Axis.subscribe(listener)];
    return () => {
      this.listeners.delete(listener);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  };

  getSnapshot = (): MatchSnapshot => this.snapshot;

  /** The game of the side holding the device */
  activeSession(): GameSession {
    return this.sessions[this.active];
  }

  /** The player hands the device to the other side: the cover screen goes up */
  pass(): boolean {
    if (this.covered) return false;
    this.active = otherSide(this.active);
    this.covered = true;
    return this.publish();
  }

  /** The player now holding the device shows their side */
  uncover(): boolean {
    if (!this.covered) return false;
    this.covered = false;
    return this.publish();
  }

  save(): SavedMatch {
    return {
      version: MATCH_SAVE_VERSION,
      sides: { allies: this.sessions.Allies.save(), axis: this.sessions.Axis.save() },
      active: this.active,
    };
  }

  /**
   * Rebuild a saved match; `restoreSide` rebuilds one side's game (with its decks). A match is
   * always resumed behind the cover screen, as whoever picks the device up may be either player.
   * Throws if the save doesn't fit.
   */
  static restore(saved: SavedMatch, scenario: Scenario, restoreSide: (saved: SavedGame) => GameSession): PassAndPlayMatch {
    if (saved.version !== MATCH_SAVE_VERSION) throw new Error(`Unsupported match save version ${saved.version}`);
    const sessions = { Allies: restoreSide(saved.sides.allies), Axis: restoreSide(saved.sides.axis) };
    if (saved.active !== "Allies" && saved.active !== "Axis") throw new Error(`Invalid side ${saved.active}`);
    return new PassAndPlayMatch(scenario, sessions, saved.active, true);
  }

  private publish(): true {
    this.snapshot = { active: this.active, covered: this.covered };
    this.listeners.forEach((listener) => listener());
    return true;
  }
}

export default PassAndPlayMatch;
