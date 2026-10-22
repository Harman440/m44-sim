import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch from "./passAndPlay";
import { SavedGame } from "./saveGame";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

// The Axis attacks. Its unit at 5-11 is 3 hexes from the Allies' unit
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
const newSession = (faction: Faction) => new GameSession({ scenario, faction, figures: true });
const restoreSide = (saved: SavedGame) => GameSession.restore(saved, scenario);
const newMatch = (fog: boolean) =>
  new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") }, { computer: "Axis", fog });

/** A side's units hold, every one ordered */
const holdAll = (session: GameSession) => {
  expect(session.pickCard(null)).toBe(true);
  while (session.getSnapshot().orderable.length > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** A side picks no card and gives no orders: its units rest */
const restAll = (session: GameSession) => {
  expect(session.pickCard(null)).toBe(true);
  expect(session.commitOrders()).toBe(true);
};

/** The enemy units a side sees, in their own side's view */
const seenBy = (match: PassAndPlayMatch, viewer: Faction) =>
  match.opponentOf(viewer).units.map(({ position }) => `${position.row}-${position.col}`).sort();

/** A side orders only the unit on this hex to hold; the others rest */
const holdOnly = (session: GameSession, position: { row: number; col: number }) => {
  expect(session.pickCard(null)).toBe(true);
  expect(session.issueOrder(position, position)).toBe(true);
  expect(session.commitOrders()).toBe(true);
};

const keys = (positions: readonly { row: number; col: number }[]) => positions.map(({ row, col }) => `${row}-${col}`).sort();

// The Axis' infantry 4 hexes from the Allied unit spots it for the artillery behind, 5 hexes away
const spotted: Scenario = {
  ...scenario,
  units: { allies: { infantry: [{ row: 8, col: 6 }] }, axis: { infantry: [{ row: 4, col: 6 }], artillery: [{ row: 3, col: 6 }] } },
};
const spottedMatch = ({ computer }: { computer?: Faction }) => {
  const side = (faction: Faction) => new GameSession({ scenario: spotted, faction, figures: true });
  return new PassAndPlayMatch(spotted, { Allies: side("Allies"), Axis: side("Axis") }, { computer: computer ?? null, fog: true });
};

/** Turn 1: the Axis' orders (the Allies rest), the move, into the battle */
const toBattle = (match: PassAndPlayMatch) => {
  holdAll(match.sessions.Axis);
  restAll(match.sessions.Allies);
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

  it("shows artillery ordered to fire from the start of the battle, and one that fires for the rest of the turn", () => {
    const match = spottedMatch({ computer: "Axis" });
    // Only the infantry (4-6 in both views) is ordered: the artillery (3-6, which is 5-5 in the Axis' view) is out of sight
    holdOnly(match.sessions.Axis, { row: 4, col: 6 });
    restAll(match.sessions.Allies);
    expect(match.moveUnits()).toBe(true);
    expect(match.finishReveal()).toBe(true);
    expect(seenBy(match, "Allies")).toEqual(["4-6"]);

    const ordered = spottedMatch({ computer: "Axis" });
    holdAll(ordered.sessions.Axis);
    restAll(ordered.sessions.Allies);
    expect(ordered.moveUnits()).toBe(true);
    expect(ordered.finishReveal()).toBe(true);
    expect(seenBy(ordered, "Allies")).toEqual(["4-6", "5-5"]);
    const artillery = ordered.sessions.Axis.getSnapshot().orders.findIndex((order) => order.unit.getUnitType() === "artillery");
    // The Allied unit at 8-6 is 0-6 in the Axis' view
    expect(ordered.fire(artillery, { row: 0, col: 6 })).toBe(true);
    expect(seenBy(ordered, "Allies")).toEqual(["4-6", "5-5"]);
  });

  it("darkens the hexes the person doesn't see and leaves off the computer's hidden units on its board", () => {
    const match = spottedMatch({ computer: "Axis" });
    // Before the first battle both armies are known
    expect(match.fogOn("Allies")).toBeNull();
    holdOnly(match.sessions.Axis, { row: 4, col: 6 });
    restAll(match.sessions.Allies);
    expect(match.moveUnits()).toBe(true);
    expect(match.finishReveal()).toBe(true);

    const allies = match.fogOn("Allies")!;
    expect(allies.hidden).toEqual([]);
    expect(keys(allies.dark)).toContain("0-6");
    expect(keys(allies.dark)).not.toContain("8-6");
    expect(keys(allies.dark)).not.toContain("4-6");
    // The computer's board (when it fires): its artillery (5-5 in its view), out of the person's sight, is left off
    const axis = match.fogOn("Axis")!;
    expect(keys(axis.hidden)).toEqual(["5-5"]);
    expect(keys(axis.dark)).toContain("8-6");
    // The person's own units are all on that board
    expect(match.opponentOf("Axis", { fogged: false }).units).toHaveLength(1);
  });

  it("is kept in a save", () => {
    const match = newMatch(true);
    toBattle(match);
    expect(match.endBattle()).toBe(true);

    const restored = PassAndPlayMatch.restore(JSON.parse(JSON.stringify(match.save())), scenario, restoreSide);

    expect(restored.fog).toBe(true);
    expect(seenBy(restored, "Allies")).toEqual(["3-0"]);
  });

  it("shows everything without the switch", () => {
    const match = newMatch(false);
    toBattle(match);
    expect(seenBy(match, "Allies")).toEqual(["3-0", "7-8"]);
    expect(match.fogOn("Allies")).toBeNull();
  });
});

describe("fog of war between two people", () => {
  it("hides, in the battle only, each side's units its enemy doesn't see, and darkens what either side doesn't see", () => {
    const match = spottedMatch({});
    expect(match.fog).toBe(true);
    // The Axis orders its infantry only; the Allies rest
    holdOnly(match.sessions.Axis, { row: 4, col: 6 });
    restAll(match.sessions.Allies);
    expect(match.moveUnits()).toBe(true);
    // The movement isn't fogged
    expect(match.fogOn("Allies")).toBeNull();
    expect(match.finishReveal()).toBe(true);

    expect(seenBy(match, "Allies")).toEqual(["4-6"]);
    expect(seenBy(match, "Axis")).toEqual(["8-6"]);
    // The Axis' artillery, not ordered, out of the Allies' sight: left off the Axis' board (5-5 in its view)
    expect(keys(match.fogOn("Axis")!.hidden)).toEqual(["5-5"]);
    expect(match.fogOn("Allies")!.hidden).toEqual([]);
    // A hex is clear only when both sides see it: the Allies' rear and the artillery's are dark
    const dark = keys(match.fogOn("Allies")!.dark);
    expect(dark).toContain("8-0");
    expect(dark).toContain("3-6");
    expect(dark).not.toContain("6-6");
    expect(dark).not.toContain("8-6");
    // A hidden unit isn't a target
    expect(match.sessions.Allies.enemyAt({ row: 5, col: 5 })).toBeNull();

    expect(match.endBattle()).toBe(true);
    // After the battle both armies are shown again
    expect(match.fogOn("Allies")).toBeNull();
    expect(seenBy(match, "Allies")).toEqual(["4-6", "5-5"]);
  });
});
