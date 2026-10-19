import { afterEach, describe, expect, it, vi } from "vitest";
import GameSession from "../gameSession";
import PassAndPlayMatch from "../passAndPlay";
import CommandCard from "../commandCard";
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
  initialHandSize: { allies: 2, axis: 2 },
  // The Allies defend: their turn 2 is a whole turn, with supplies (none in the attacker's extra turn)
  attacker: "Axis",
  tiles: { forest: [{ row: 5, col: 4 }] },
  units: {
    // Artillery in range of the enemy, out of its reach; infantry too far to fire this turn
    allies: { infantry: [{ row: 7, col: 8 }], artillery: [{ row: 7, col: 4 }] },
    axis: { infantry: [{ row: 3, col: 4 }] },
  },
};

const cards = () => Array.from({ length: 4 }, (_, i) => new CommandCard({ id: `one-${i}`, orders: 1 }));

const viewOf = (coins = 0): AiView => {
  const session = (faction: Faction) =>
    new GameSession({ scenario, faction, initialHandSize: 2, commandCards: cards(), figures: true });
  const match = new PassAndPlayMatch(scenario, { Allies: session("Allies"), Axis: session("Axis") }, { computer: "Allies" });
  const allies = match.sessions.Allies;
  allies.startFirstTurn();
  if (coins > 0) allies.adjustCoins(coins);
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

  it("buys an extra order for a unit that would fire with it, when it has the supplies", () => {
    // The card's one order goes to the infantry; the artillery could still fire
    const far = { row: 7, col: 8 };
    const near = { row: 7, col: 4 };
    const orderFar = (view: AiView) => {
      view.session.pickCard(view.session.getSnapshot().hand[0]!);
      view.session.issueOrder(far, far);
      return view.session.getSnapshot().extraOrderable;
    };
    const poor = viewOf();
    expect(standardBrain.extraOrder!(poor, orderFar(poor))).toBeNull();
    const rich = viewOf(10);
    expect(standardBrain.extraOrder!(rich, orderFar(rich))).toEqual(near);
  });

  it("buys none for a unit that couldn't fire at anything", () => {
    const view = viewOf(10);
    view.session.pickCard(view.session.getSnapshot().hand[0]!);
    // The artillery takes the card's order: the infantry is left, out of reach
    view.session.issueOrder({ row: 7, col: 4 }, { row: 7, col: 4 });
    expect(standardBrain.extraOrder!(view, view.session.getSnapshot().extraOrderable)).toBeNull();
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
  });
});
