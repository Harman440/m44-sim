// One brain against another on every built-in scenario and from both sides, next to the
// opponent against itself on the same side (the scenarios aren't even): the standard brain
// against the basic one, and against itself without combat cards. Slow, so it runs only when
// asked: AI_DUEL=1 npx vitest run src/game-core/ai/duel
import { describe, it, vi } from "vitest";
import { scenarios } from "../../data/scenarios";
import { Brain } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { standardBrain } from "./standardBrain";
import { figuresLeft, playOut, seeded } from "./selfPlay";
import { FACTIONS, Faction } from "../../types/faction";

// Node's, in the test runner (the app's types leave Node out)
declare const process: { env: Record<string, string | undefined>; stderr: { write(text: string): void } };

const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const TURNS = 15;

/** The share of its figures `side` kept, less the share the other side kept */
function score(brains: Record<Faction, Brain>, scenario: (typeof scenarios)[number], side: Faction, seed: number) {
  const random = seeded(seed);
  vi.spyOn(Math, "random").mockImplementation(random);
  const start = figuresLeft(playOut(scenario, brains, seeded(0), 0));
  const left = figuresLeft(playOut(scenario, brains, random, TURNS));
  vi.restoreAllMocks();
  const other: Faction = side === "Allies" ? "Axis" : "Allies";
  return left[side] / start[side] - left[other] / start[other];
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** The standard brain playing no combat cards and always taking supplies, to measure what the cards bring */
const withoutCards: Brain = {
  ...standardBrain,
  pickCard: (view) => ({ ...standardBrain.pickCard(view), combatCards: [] }),
  reward: () => "coins",
};

/** `brain` against `opponent` on every scenario from both sides, beside `opponent` against itself */
function duel(name: string, brain: Brain, opponent: Brain) {
  const lines: string[] = [];
  const all: number[] = [];
  for (const scenario of scenarios) {
    for (const side of FACTIONS) {
      const other: Faction = side === "Allies" ? "Axis" : "Allies";
      const brains = { [side]: brain, [other]: opponent } as Record<Faction, Brain>;
      const scores = SEEDS.map((seed) => score(brains, scenario, side, seed));
      const base = SEEDS.map((seed) => score({ Allies: opponent, Axis: opponent }, scenario, side, seed + 100));
      all.push(...scores);
      lines.push(`${scenario.id}, ${name} as ${side}: ${mean(scores).toFixed(2)} (opponent there: ${mean(base).toFixed(2)})`);
    }
  }
  lines.push(`${name} overall: ${mean(all).toFixed(2)}, won ${all.filter((s) => s > 0).length} of ${all.length}`);
  process.stderr.write(lines.join("\n") + "\n");
}

describe.skipIf(!process.env.AI_DUEL)("duel", () => {
  it("standard against basic", () => duel("standard", standardBrain, basicBrain), 600_000);
  it("combat cards against none", () => duel("with cards", standardBrain, withoutCards), 600_000);
});
