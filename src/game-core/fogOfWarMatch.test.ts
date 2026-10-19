import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch from "./passAndPlay";
import { SavedGame } from "./saveGame";
import CommandCard from "./commandCard";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

// The Axis attacks, so it plays turn 1 alone. Its unit at 5-11 is 3 hexes from the Allies' unit
// at 8-11; its unit at 1-3 is far from both Allied units
const scenario: Scenario = {
  id: "fog",
  name: same("Fog"),
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 8, col: 1 }, { row: 8, col: 11 }] },
    axis: { infantry: [{ row: 1, col: 3 }, { row: 5, col: 11 }] },
  },
};
const cards = () => Array.from({ length: 8 }, (_, i) => new CommandCard({ id: `all-${i}`, orders: 6 }));
const newSession = (faction: Faction) => new GameSession({ scenario, faction, initialHandSize: 2, commandCards: cards(), figures: true });
const restoreSide = (saved: SavedGame) => GameSession.restore(saved, scenario, cards());
const newMatch = (fog: boolean) =>
  new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { computer: "Axis", fog });

/** A side's units hold, every one ordered */
const holdAll = (session: GameSession) => {
  expect(session.pickCard(session.getSnapshot().hand[0]!)).toBe(true);
  while (session.getSnapshot().ordersLeft > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** The enemy units a side sees, in their own side's view */
const seenBy = (match: PassAndPlayMatch, viewer: Faction) =>
  match.opponentOf(viewer).units.map(({ position }) => `${position.row}-${position.col}`).sort();

/** Turn 1: the Axis' orders, the move, into the battle */
const toBattle = (match: PassAndPlayMatch) => {
  holdAll(match.sessions.Axis);
  expect(match.moveUnits()).toBe(true);
  expect(match.finishReveal()).toBe(true);
};

describe("fog of war against the computer", () => {
  it("knows the whole enemy army before the first battle", () => {
    const match = newMatch(true);
    expect(match.fog).toBe(true);
    expect(seenBy(match, "Allies")).toEqual(["3-0", "7-8"]);
  });

  it("shows only the enemy units in sight once the units have moved, and keeps them for the next orders", () => {
    const match = newMatch(true);
    toBattle(match);

    // In the Axis' own view of the board, 5-11 is 3-0 (and 1-3 is 7-8)
    expect(seenBy(match, "Allies")).toEqual(["3-0"]);
    expect(seenBy(match, "Axis")).toEqual(["8-11"]);
    // A hidden unit isn't a target, but it's still there
    expect(match.sessions.Allies.enemyAt({ row: 1, col: 3 })).toBeNull();
    expect(match.sessions.Allies.enemyAt({ row: 1, col: 3 }, { hidden: true })).not.toBeNull();
    expect(match.sessions.Allies.enemyAt({ row: 5, col: 11 })).not.toBeNull();

    expect(match.endBattle()).toBe(true);
    // What it saw as the battle ended is what it knows in the final phase and the next orders
    expect(seenBy(match, "Allies")).toEqual(["3-0"]);
  });

  it("shows a hidden unit that fires for the rest of the turn", () => {
    // The Axis' infantry 4 hexes from the Allied unit spots it for the artillery behind, 5 hexes away
    const spotted: Scenario = {
      ...scenario,
      units: { allies: { infantry: [{ row: 8, col: 6 }] }, axis: { infantry: [{ row: 4, col: 6 }], artillery: [{ row: 3, col: 6 }] } },
    };
    const side = (faction: Faction) => new GameSession({ scenario: spotted, faction, initialHandSize: 2, commandCards: cards(), figures: true });
    const match = new PassAndPlayMatch(spotted, { Allies: side("Allies"), Axis: side("Axis") }, { computer: "Axis", fog: true });
    holdAll(match.sessions.Axis);
    expect(match.moveUnits()).toBe(true);
    expect(match.finishReveal()).toBe(true);
    // The artillery (3-6, which is 5-5 in the Axis' view) is out of sight
    expect(seenBy(match, "Allies")).toEqual(["4-6"]);

    const artillery = match.sessions.Axis.getSnapshot().orders.findIndex((order) => order.unit.getUnitType() === "artillery");
    // The Allied unit at 8-6 is 0-6 in the Axis' view
    expect(match.fire(artillery, { row: 0, col: 6 })).toBe(true);

    expect(seenBy(match, "Allies")).toEqual(["4-6", "5-5"]);
  });

  it("is kept in a save", () => {
    const match = newMatch(true);
    toBattle(match);
    expect(match.endBattle()).toBe(true);

    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), scenario, restoreSide);

    expect(restored.fog).toBe(true);
    expect(seenBy(restored, "Allies")).toEqual(["3-0"]);
  });

  it("shows everything without the switch, and never in a match between two people", () => {
    const match = newMatch(false);
    toBattle(match);
    expect(seenBy(match, "Allies")).toEqual(["3-0", "7-8"]);

    const people = new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { fog: true });
    expect(people.fog).toBe(false);
  });
});
