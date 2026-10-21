import { afterEach, describe, expect, it, vi } from "vitest";
import PassAndPlayMatch from "../passAndPlay";
import { aiStep, Brain } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { standardBrain } from "./standardBrain";
import { newSession, playOut, seeded, unitsLeft } from "./selfPlay";
import { scenarios } from "../../data/scenarios";
import { FACTIONS } from "../../types/faction";
import { TurnPhase } from "../../types/gameManager";
import { Scenario } from "../../types/scenario";
import { HexType } from "../../types/hex";
import { resizeBoard } from "../scenarioDraft";

/** The basic brain on both sides, or another one, seeded */
const playBasic = (scenario: Scenario, seed: number, turns: number, brain: Brain = basicBrain) => {
  const random = seeded(seed);
  vi.spyOn(Math, "random").mockImplementation(random);
  return playOut(scenario, { Allies: brain, Axis: brain }, random, turns);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the computer against itself", () => {
  for (const scenario of scenarios) {
    it(`plays ${scenario.id} to the end without getting stuck`, () => {
      for (const seed of [1, 2, 3]) {
        const match = playBasic(scenario, seed, 20);
        // Each side has finished turns
        expect(FACTIONS.every((side) => match.sessions[side].getSnapshot().log.length > 0)).toBe(true);
      }
    });
  }

  for (const scenario of scenarios) {
    it(`plays ${scenario.id} under fog of war without getting stuck`, () => {
      const random = seeded(5);
      vi.spyOn(Math, "random").mockImplementation(random);
      const match = playOut(scenario, { Allies: standardBrain, Axis: standardBrain }, random, 20, { fog: true });
      expect(match.fog).toBe(true);
      expect(FACTIONS.every((side) => match.sessions[side].getSnapshot().log.length > 0)).toBe(true);
    });
  }

  for (const scenario of scenarios) {
    it(`plays ${scenario.id} in the sections variant without getting stuck`, () => {
      for (const brain of [basicBrain, standardBrain]) {
        const random = seeded(6);
        vi.spyOn(Math, "random").mockImplementation(random);
        const match = playOut(scenario, { Allies: brain, Axis: brain }, random, 20, { sectionOrders: true });
        for (const side of FACTIONS) {
          const { log } = match.sessions[side].getSnapshot();
          expect(log.length).toBeGreaterThan(0);
          // Every turn plays the one card, ordering at most 4 units in each section
          expect(log.every((turn) => turn.orders.length <= 8)).toBe(true);
        }
      }
    });
  }

  it("plays a bigger map, grown at every edge, to the end", () => {
    let big: Scenario = scenarios[0]!;
    for (const edge of ["left", "right", "top", "bottom", "right"] as const) big = resizeBoard(big, edge, true, HexType.FOREST) as Scenario;
    expect(big.board).toEqual({ cols: 16, rows: 13 });
    for (const brain of [basicBrain, standardBrain]) {
      const match = playBasic(big, 4, 20, brain);
      expect(FACTIONS.every((side) => match.sessions[side].getSnapshot().log.length > 0)).toBe(true);
      expect(FACTIONS.map((side) => match.sessions[side].board.hexes.size)).toEqual([7 * 16 + 6 * 15, 7 * 16 + 6 * 15]);
    }
  });

  for (const scenario of scenarios) {
    it(`plays ${scenario.id} with the standard brain without getting stuck`, () => {
      for (const seed of [1, 2]) {
        const match = playBasic(scenario, seed, 20, standardBrain);
        expect(FACTIONS.every((side) => match.sessions[side].getSnapshot().log.length > 0)).toBe(true);
      }
    });
  }

  it("fights: shots are fired and units are lost", () => {
    const match = playBasic(scenarios[0]!, 7, 20);
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
