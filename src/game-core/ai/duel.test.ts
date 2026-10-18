// The standard brain against the basic one, on every built-in scenario and from both sides,
// next to the basic brain against itself on the same side (the scenarios aren't even). Slow, so
// it runs only when asked: AI_DUEL=1 npx vitest run src/game-core/ai/duel
import { describe, it, vi } from "vitest";
import { scenarios } from "../../data/scenarios";
import { Brain } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { standardBrain } from "./standardBrain";
import { figuresLeft, playOut, seeded } from "./selfPlay";
import { FACTIONS, Faction } from "../../types/faction";

// Node's, in the test runner (the app's types leave Node out)
declare const process: { env: Record<string, string | undefined>; stderr: { write(text: string): void } };

const SEEDS = [11, 12, 13, 14, 15, 16];
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

describe.skipIf(!process.env.AI_DUEL)("duel", () => {
  it("standard against basic", () => {
    const lines: string[] = [];
    const all: number[] = [];
    for (const scenario of scenarios) {
      for (const side of FACTIONS) {
        const other: Faction = side === "Allies" ? "Axis" : "Allies";
        const brains = { [side]: standardBrain, [other]: basicBrain } as Record<Faction, Brain>;
        const scores = SEEDS.map((seed) => score(brains, scenario, side, seed));
        const base = SEEDS.map((seed) => score({ Allies: basicBrain, Axis: basicBrain }, scenario, side, seed + 100));
        all.push(...scores);
        lines.push(`${scenario.id}, standard as ${side}: ${mean(scores).toFixed(2)} (basic there: ${mean(base).toFixed(2)})`);
      }
    }
    lines.push(`overall: ${mean(all).toFixed(2)}, won ${all.filter((s) => s > 0).length} of ${all.length}`);
    process.stderr.write(lines.join("\n") + "\n");
  }, 600_000);
});
