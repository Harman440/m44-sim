import { afterEach, describe, expect, it, vi } from "vitest";
import GameSession from "../gameSession";
import PassAndPlayMatch, { armyOf } from "../passAndPlay";
import { aiStep } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { scenarios } from "../../data/scenarios";
import { commandDeckFor } from "../../data/commandCards";
import { combatDeckFor } from "../../data/combatCards";
import { FACTIONS, Faction } from "../../types/faction";
import { TurnPhase } from "../../types/gameManager";
import { Scenario } from "../../types/scenario";

/** A seeded random source, [0, 1) like Math.random (mulberry32) */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const newSession = (scenario: Scenario, faction: Faction, random: () => number) =>
  new GameSession({
    scenario,
    faction,
    initialHandSize: scenario.initialHandSize[faction === "Axis" ? "axis" : "allies"],
    commandCards: commandDeckFor(scenario, faction),
    combatCards: combatDeckFor(scenario, faction),
    figures: true,
    random,
  });

/** What both players do together on the shared screens: the reveal, the movement, ending the battle */
function sharedStep(match: PassAndPlayMatch): boolean {
  const { revealTurn, movement, battle } = match.getSnapshot();
  if (revealTurn !== null) {
    if (!movement) return match.moveUnits();
    const next = movement.collisions.findIndex((collision) => !collision.rolled);
    return next >= 0 ? match.rollCollision(next) : match.finishReveal();
  }
  if (battle && battle.side === null && !battle.retreat && !battle.ground && battle.attacks.length === 0) {
    return match.endBattle();
  }
  return false;
}

const unitsLeft = (match: PassAndPlayMatch) => FACTIONS.map((side) => armyOf(match.sessions[side]).length);

/**
 * Computer against computer: both sides play with the basic brain, the shared steps taken as
 * the players would, until `turns` turns are over or a side has no units left
 */
function playOut(scenario: Scenario, seed: number, turns: number) {
  const random = seeded(seed);
  vi.spyOn(Math, "random").mockImplementation(random);
  const match = new PassAndPlayMatch(
    scenario,
    { Allies: newSession(scenario, "Allies", random), Axis: newSession(scenario, "Axis", random) },
    { computer: "Axis" }
  );
  let steps = 0;
  while (Math.min(...FACTIONS.map((side) => match.sessions[side].getSnapshot().turn)) <= turns) {
    if (unitsLeft(match).includes(0)) break;
    const moved = FACTIONS.some((side) => aiStep(match, side, basicBrain, random)) || sharedStep(match);
    if (!moved) {
      const phases = FACTIONS.map((side) => `${side}: ${match.sessions[side].getSnapshot().phase}`).join(", ");
      throw new Error(`Stuck in ${scenario.id} (seed ${seed}) after ${steps} steps: ${phases}`);
    }
    if (++steps > 20_000) throw new Error(`No end in ${scenario.id}`);
  }
  return match;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the computer against itself", () => {
  for (const scenario of scenarios) {
    it(`plays ${scenario.id} to the end without getting stuck`, () => {
      for (const seed of [1, 2, 3]) {
        const match = playOut(scenario, seed, 20);
        // Each side has finished turns
        expect(FACTIONS.every((side) => match.sessions[side].getSnapshot().log.length > 0)).toBe(true);
      }
    });
  }

  it("fights: shots are fired and units are lost", () => {
    const match = playOut(scenarios[0]!, 7, 20);
    const shots = FACTIONS.flatMap((side) => match.sessions[side].getSnapshot().log.flatMap((turn) => turn.shots));
    expect(shots.length).toBeGreaterThan(0);
    const start = new PassAndPlayMatch(scenarios[0]!, {
      Allies: newSession(scenarios[0]!, "Allies", Math.random),
      Axis: newSession(scenarios[0]!, "Axis", Math.random),
    });
    const lost = unitsLeft(start).reduce((a, b) => a + b) - unitsLeft(match).reduce((a, b) => a + b);
    expect(lost).toBeGreaterThan(0);
  });
});

describe("aiStep", () => {
  it("does nothing on the person's side of the waiting, nor in a phase both players share", () => {
    const scenario = scenarios[0]!;
    const random = seeded(4);
    const match = new PassAndPlayMatch(
      scenario,
      { Allies: newSession(scenario, "Allies", random), Axis: newSession(scenario, "Axis", random) },
      { computer: "Axis" }
    );
    const defender = scenario.attacker === "Axis" ? "Allies" : "Axis";
    if (match.sessions[defender].getSnapshot().phase === TurnPhase.AWAIT_ATTACKER) {
      expect(aiStep(match, defender, basicBrain, random)).toBe(false);
    }
    // The attacker plays its card, gives its orders and locks them, then waits for the reveal
    while (aiStep(match, scenario.attacker, basicBrain, random));
    expect(match.sessions[scenario.attacker].getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
    expect(match.getSnapshot().revealTurn).toBe(1);
  });
});
