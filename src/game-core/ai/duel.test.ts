// One brain against another on every built-in scenario and from both sides: games won, lost and
// undecided after TURNS turns. Slow, so it runs only when asked:
// AI_DUEL=1 npx vitest run src/game-core/ai/duel, and AI_TUNE=1 to search the standard brain's weights
import { describe, it, vi } from "vitest";
import { scenarios } from "../../data/scenarios";
import { Brain } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { BrainWeights, CAUTIOUS_WEIGHTS, makeStandardBrain, standardBrain } from "./standardBrain";
import { playOut, seeded } from "./selfPlay";
import { FACTIONS, Faction } from "../../types/faction";

// Node's, in the test runner (the app's types leave Node out)
declare const process: { env: Record<string, string | undefined>; stderr: { write(text: string): void } };

const SEEDS = [11, 12, 13, 14, 15, 16];
const TURNS = 20;

/** 1 when `side` won, -1 when it lost, 0 when nobody had after TURNS turns */
function outcome(brains: Record<Faction, Brain>, scenario: (typeof scenarios)[number], side: Faction, seed: number): number {
  const random = seeded(seed);
  vi.spyOn(Math, "random").mockImplementation(random);
  const result = playOut(scenario, brains, random, TURNS).getSnapshot().result;
  vi.restoreAllMocks();
  return result ? (result.winner === side ? 1 : -1) : 0;
}

/** `brain` against `opponent` on every scenario from both sides */
function duel(brain: Brain, opponent: Brain, seeds = SEEDS) {
  const byScenario: string[] = [];
  const all: number[] = [];
  for (const scenario of scenarios) {
    for (const side of FACTIONS) {
      const other: Faction = side === "Allies" ? "Axis" : "Allies";
      const brains = { [side]: brain, [other]: opponent } as Record<Faction, Brain>;
      const games = seeds.map((seed) => outcome(brains, scenario, side, seed));
      all.push(...games);
      byScenario.push(`${scenario.id} as ${side}: ${games.filter((g) => g > 0).length}-${games.filter((g) => g < 0).length}`);
    }
  }
  const won = all.filter((g) => g > 0).length;
  const lost = all.filter((g) => g < 0).length;
  return { won, lost, undecided: all.length - won - lost, games: all.length, byScenario };
}

const report = (name: string, { won, lost, undecided, games, byScenario }: ReturnType<typeof duel>) =>
  process.stderr.write(`${name}: won ${won}, lost ${lost}, undecided ${undecided} of ${games}\n  ${byScenario.join(" | ")}\n`);

describe.skipIf(!process.env.AI_DUEL)("duel", () => {
  it("standard against basic", () => report("standard vs basic", duel(standardBrain, basicBrain)), 900_000);
  it("standard against the cautious weights", () =>
    report("standard vs cautious", duel(standardBrain, makeStandardBrain(CAUTIOUS_WEIGHTS))), 900_000);
});

describe.skipIf(!process.env.AI_TUNE)("tuning", () => {
  it("searches the weights against the cautious brain", () => {
    const cautious = makeStandardBrain(CAUTIOUS_WEIGHTS);
    const results: { weights: BrainWeights; won: number; lost: number }[] = [];
    for (const threat of [0.25, 0.5])
      for (const approach of [0.35, 0.6])
        for (const objectiveApproach of [0.15, 0.3]) {
          const weights = { ...CAUTIOUS_WEIGHTS, threat, approach, objectiveApproach };
          const { won, lost } = duel(makeStandardBrain(weights), cautious, [11, 12, 13]);
          results.push({ weights, won, lost });
          process.stderr.write(`threat ${threat} approach ${approach} objective ${objectiveApproach}: won ${won} lost ${lost}\n`);
        }
  }, 3_600_000);
});
