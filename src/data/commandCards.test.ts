import { describe, expect, it } from "vitest";
import { commandDeckFor } from "./commandCards";
import { scenarios } from "./scenarios";
import { UnitType } from "../game-core/unit";
import { Scenario } from "../types/scenario";

const base = scenarios.find((s) => s.id === "sainte-mere-eglise")!;
const withAlliedUnits = (types: UnitType[]): Scenario => ({
  ...base,
  paradrop: undefined,
  units: { ...base.units, allies: Object.fromEntries(types.map((type) => [type, [{ row: 0, col: 0 }]])) },
});

const countsById = (scenario: Scenario) => {
  const counts: Record<string, number> = {};
  commandDeckFor(scenario, "Allies").forEach((card) => {
    const id = card.id.replace(/-\d+$/, "");
    counts[id] = (counts[id] ?? 0) + 1;
  });
  return counts;
};

describe("command card data", () => {
  it("gives every side of every scenario 25 cards with unique ids (they are used as React keys)", () => {
    scenarios.forEach((scenario) =>
      (["Allies", "Axis"] as const).forEach((faction) => {
        const ids = commandDeckFor(scenario, faction).map((card) => card.id);
        expect(ids).toHaveLength(25);
        expect(new Set(ids).size).toBe(25);
      })
    );
  });

  it("has the shared section and tactic cards", () => {
    const counts = countsById(withAlliedUnits([UnitType.INFANTRY]));

    expect(counts).toMatchObject({
      "assault-left": 1, "assault-center": 1, "assault-right": 1,
      "attack-left": 1, "attack-center": 1, "attack-right": 1,
      "probe-left": 2, "probe-center": 2, "probe-right": 2,
      "recon-in-force": 1, "general-advance": 2, pincer: 1,
      preparations: 1, "finest-hour": 1, "infantry-assault": 1, "close-assault": 1, firefight: 1,
    });
    expect(Object.keys(counts).some((id) => id.startsWith("recon-") && id !== "recon-in-force")).toBe(false);
  });

  it("lets Probe choose 1 of 2 cards in the final phase", () => {
    const probe = commandDeckFor(base, "Allies").find((card) => card.id === "probe-left-1")!;

    expect(probe.drawChoice).toBe(2);
    expect(commandDeckFor(base, "Allies").filter((card) => card.drawChoice > 1).every((card) => card.id.startsWith("probe"))).toBe(true);
  });

  it.each([
    [[UnitType.INFANTRY], { "move-out": 4 }],
    [[UnitType.INFANTRY, UnitType.TANK], { "move-out": 1, "armor-assault": 1, "direct-from-hq": 2 }],
    [[UnitType.INFANTRY, UnitType.ARTILLERY], { "move-out": 1, "artillery-bombardment": 1, "direct-from-hq": 2 }],
    [
      [UnitType.INFANTRY, UnitType.TANK, UnitType.ARTILLERY],
      { "move-out": 1, "armor-assault": 1, "artillery-bombardment": 1, "direct-from-hq": 1 },
    ],
    // Without infantry, the set still follows the armour and artillery
    [[UnitType.TANK], { "move-out": 1, "armor-assault": 1, "direct-from-hq": 2 }],
    [[UnitType.ARTILLERY], { "move-out": 1, "artillery-bombardment": 1, "direct-from-hq": 2 }],
    [[UnitType.TANK, UnitType.ARTILLERY], { "move-out": 1, "armor-assault": 1, "artillery-bombardment": 1, "direct-from-hq": 1 }],
  ])("adds the unit-type cards for %j", (types, expected) => {
    const counts = countsById(withAlliedUnits(types));
    const unitCards = ["move-out", "armor-assault", "artillery-bombardment", "direct-from-hq"];

    expect(Object.fromEntries(unitCards.filter((id) => counts[id]).map((id) => [id, counts[id]]))).toEqual(expected);
  });

  it("counts a side's paradropped units", () => {
    const scenario = { ...withAlliedUnits([UnitType.INFANTRY]), paradrop: { faction: "Allies" as const, unitType: UnitType.TANK, units: 1 } };

    expect(countsById(scenario)["armor-assault"]).toBe(1);
  });

  it("names section cards after their section", () => {
    const deck = commandDeckFor(base, "Allies");
    const names = new Set(deck.map((card) => card.name));

    expect(names).toContain("Sondeo en el flanco izquierdo");
    expect(names).toContain("Ataque en el centro");
    expect(deck.find((card) => card.id === "assault-right-1")!.description).toBe(
      "Da órdenes a todas las unidades del flanco derecho."
    );
  });
});
