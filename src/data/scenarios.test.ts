import { describe, expect, it } from "vitest";
import { scenarios } from "./scenarios";
import BoardManager from "../game-core/BoardManager";
import { Position, UnitGroup } from "../types/scenario";
import { describeProblem, validateScenario } from "../game-core/scenarioFile";

const flatten = (groups: Partial<Record<string, Position[]>>) =>
  Object.values(groups).flatMap((positions) => positions ?? []);

// BoardManager silently drops off-board positions and units placed on an
// occupied hex, so typos in scenario data would otherwise go unnoticed.
// The catalog's files are checked as they're read (data/catalog.ts)
describe.each(scenarios.map((s) => [s.id, s] as const))("scenario %s", (_id, scenario) => {
  it("has board art", () => {
    expect(scenario.image).toBeTruthy();
  });

  it("breaks none of the rules a scenario file is checked against", () => {
    expect(validateScenario(scenario).map((problem) => describeProblem(problem, "en"))).toEqual([]);
  });

  it.each([
    ["Allies", "allies"],
    ["Axis", "axis"],
  ] as const)("places every %s unit on its own hex", (faction, factionKey) => {
    const expected = flatten(scenario.units[factionKey] as UnitGroup).length;

    const board = new BoardManager(scenario, faction);

    expect(board.getAllHexes().filter((h) => h.hasUnit())).toHaveLength(expected);
  });
});

describe("Forêt d'Écouves", () => {
  const ecouves = scenarios.find((s) => s.id === "foret-decouves")!;
  const elite = (faction: "Allies" | "Axis") =>
    new BoardManager(ecouves, faction).getAllHexes().filter((hex) => hex.unit?.elite).map((hex) => hex.unit!.getUnitType());

  it("makes every French infantry unit elite, and the badged German units", () => {
    expect(elite("Allies")).toEqual(Array(6).fill("infantry"));
    expect(elite("Axis").sort()).toEqual(["infantry", "infantry", "tank"]);
  });

  it("starts the Allies with 6 cards and the Axis with 5, the Allies first", () => {
    expect(ecouves.initialHandSize).toEqual({ allies: 6, axis: 5 });
    expect(ecouves.attacker).toBe("Allies");
  });
});

describe("Arracourt", () => {
  const arracourt = scenarios.find((s) => s.id === "arracourt")!;
  const count = (group: UnitGroup) => Object.fromEntries(Object.entries(group).map(([type, at]) => [type, at!.length]));

  it("has the official units, the Axis first with 4 cards and the Allies with 6", () => {
    expect(count(arracourt.units.allies)).toEqual({ infantry: 5, tank: 6, artillery: 3 });
    expect(count(arracourt.units.axis)).toEqual({ infantry: 6, tank: 8 });
    expect(arracourt.initialHandSize).toEqual({ allies: 6, axis: 4 });
    expect(arracourt.attacker).toBe("Axis");
  });

  it("has the official terrain", () => {
    expect(count(arracourt.tiles as UnitGroup)).toEqual({ town: 6, forest: 12, hill: 9, river: 3, bridge: 1 });
  });
});

describe("scenarios", () => {
  it("have distinct ids", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
