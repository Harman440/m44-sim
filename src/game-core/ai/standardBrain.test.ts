import { afterEach, describe, expect, it, vi } from "vitest";
import GameSession from "../gameSession";
import PassAndPlayMatch from "../passAndPlay";
import { AiView, seenEnemies } from "./aiStep";
import { basicBrain } from "./basicBrain";
import { shotValue, standardBrain, threatAt } from "./standardBrain";
import { playOut, seeded } from "./selfPlay";
import { UnitType } from "../unit";
import { scenarios } from "../../data/scenarios";
import { FACTIONS, Faction } from "../../types/faction";
import { Scenario } from "../../types/scenario";
import { same } from "../../i18n/lang";

// The computer plays the Allies, whose view is the scenario's: an enemy infantry unit up the board
const scenario: Scenario = {
  id: "test",
  name: same("Test"),
  description: same(""),
  attacker: "Axis",
  tiles: { forest: [{ row: 5, col: 4 }] },
  units: {
    // Artillery in range of the enemy, out of its reach; infantry too far to fire this turn
    allies: { infantry: [{ row: 7, col: 8 }], artillery: [{ row: 7, col: 4 }] },
    axis: { infantry: [{ row: 3, col: 4 }] },
  },
};

const viewOf = (): AiView => {
  const session = (faction: Faction) => new GameSession({ scenario, faction, figures: true });
  const match = new PassAndPlayMatch(scenario, { Allies: session("Allies"), Axis: session("Axis") }, { computer: "Allies" });
  const allies = match.sessions.Allies;
  return { side: "Allies", session: allies, enemies: seenEnemies(match, "Allies"), random: () => 0 };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("standardBrain", () => {
  it("values a shot by the share of the target it would destroy", () => {
    const full = { position: { row: 0, col: 0 }, unitType: UnitType.INFANTRY, figures: 4 };
    const weak = { ...full, figures: 1 };
    expect(shotValue(2, weak)).toBeGreaterThan(shotValue(2, full));
    // More dice are worth more, up to what the target can take
    expect(shotValue(3, full)).toBeGreaterThan(shotValue(1, full));
    expect(shotValue(6, weak)).toBe(shotValue(3, weak));
  });

  it("counts cover against the fire a hex draws", () => {
    const view = viewOf();
    // Both two hexes from the enemy: one in the forest, one in the open
    expect(threatAt(view, UnitType.INFANTRY, { row: 5, col: 4 })).toBeLessThan(
      threatAt(view, UnitType.INFANTRY, { row: 5, col: 3 })
    );
  });

  it("regroups weakened units in a game against itself, the smaller unit leaving the map", () => {
    // A game picked where it happens (the dice are seeded)
    const scenario = scenarios.find((each) => each.id === "foret-decouves")!;
    const match = playOut(scenario, { Allies: standardBrain, Axis: standardBrain }, seeded(3), 20);
    const log = FACTIONS.flatMap((side) => match.sessions[side].getSnapshot().log);
    const regroups = log.flatMap((turn) => turn.orders.filter((order) => order.action.endsWith(":regroup")));
    const left = log.flatMap((turn) => turn.battleEdits.filter((edit) => edit.kind === "remove" && edit.regroupedInto));
    expect(regroups.length).toBeGreaterThan(0);
    expect(left.length).toBeGreaterThan(0);
  });

  it("wins more games than it loses against the basic brain, on every built-in scenario and from both sides", () => {
    // Two games each way: the dice make a single game a poor judge (the full measure is duel.test.ts)
    let won = 0;
    let lost = 0;
    for (const scenario of scenarios) {
      for (const side of FACTIONS) {
        for (const seed of [31, 32]) {
          const random = seeded(seed);
          vi.spyOn(Math, "random").mockImplementation(random);
          const other: Faction = side === "Allies" ? "Axis" : "Allies";
          const brains = { [side]: standardBrain, [other]: basicBrain } as Record<Faction, typeof basicBrain>;
          const result = playOut(scenario, brains, random, 20).getSnapshot().result;
          vi.restoreAllMocks();
          if (result?.winner === side) won++;
          else if (result) lost++;
        }
      }
    }
    expect(won).toBeGreaterThan(lost);
    // (it plays every catalog map too, some on boards bigger than the standard one)
  }, 60_000);
});
