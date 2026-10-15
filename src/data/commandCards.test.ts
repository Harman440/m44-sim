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

/** Copies of each card in the deck itself, not the cards kept out of it */
const countsById = (scenario: Scenario) => {
  const counts: Record<string, number> = {};
  commandDeckFor(scenario, "Allies").filter((card) => !card.reserve).forEach((card) => {
    const id = card.id.replace(/-\d+$/, "");
    counts[id] = (counts[id] ?? 0) + 1;
  });
  return counts;
};

describe("command card data", () => {
  it("gives every side of every scenario 24 cards with unique ids (they are used as React keys)", () => {
    scenarios.forEach((scenario) =>
      (["Allies", "Axis"] as const).forEach((faction) => {
        const cards = commandDeckFor(scenario, faction);
        const ids = cards.map((card) => card.id);
        expect(cards.filter((card) => !card.reserve)).toHaveLength(24);
        expect(new Set(ids).size).toBe(ids.length);
      })
    );
  });

  it("keeps Armor Assault, and a Direct from HQ for when no armour is left, out of the deck: only Refuel gives them", () => {
    const deck = commandDeckFor(withAlliedUnits([UnitType.INFANTRY, UnitType.TANK]), "Allies");
    const refuel = deck.find((card) => card.templateId === "refuel")!;

    expect(deck.filter((card) => card.reserve).map((card) => card.templateId)).toEqual(["armor-assault", "direct-from-hq"]);
    expect(refuel).toMatchObject({
      reserve: false,
      orders: 1,
      endOfTurnReward: { coins: 3, combatCard: true },
      rewardCard: { card: "armor-assault", needs: UnitType.TANK, otherwise: "direct-from-hq" },
    });
    expect(commandDeckFor(withAlliedUnits([UnitType.INFANTRY]), "Allies").some((card) => card.reserve)).toBe(false);
  });

  it("has the shared section and tactic cards", () => {
    const counts = countsById(withAlliedUnits([UnitType.INFANTRY]));

    expect(counts).toMatchObject({
      "assault-left": 1, "assault-center": 1, "assault-right": 1,
      "attack-left": 1, "attack-center": 1, "attack-right": 1,
      "probe-left": 1, "probe-center": 1, "probe-right": 1,
      "recon-in-force": 1, "general-advance": 3, pincer: 1,
      preparations: 1, "finest-hour": 1, "infantry-assault": 1, "close-assault": 1, firefight: 1,
    });
    expect(Object.keys(counts).some((id) => id.startsWith("recon-") && id !== "recon-in-force")).toBe(false);
  });

  it("lets only Preparations choose 1 of 2 cards in the final phase", () => {
    const deck = commandDeckFor(base, "Allies");
    const preparations = deck.find((card) => card.id === "preparations-1")!;

    expect(preparations.drawChoice).toBe(2);
    expect(preparations.endOfTurnReward).toEqual({ coins: 3, combatCard: true });
    expect(deck.filter((card) => card.drawChoice > 1).map((card) => card.id)).toEqual(["preparations-1"]);
  });

  it.each([
    [[UnitType.INFANTRY], { "move-out": 5 }],
    [[UnitType.INFANTRY, UnitType.TANK], { "move-out": 2, refuel: 1, "direct-from-hq": 2 }],
    [[UnitType.INFANTRY, UnitType.ARTILLERY], { "move-out": 2, "artillery-bombardment": 1, "direct-from-hq": 2 }],
    [
      [UnitType.INFANTRY, UnitType.TANK, UnitType.ARTILLERY],
      { "move-out": 2, refuel: 1, "artillery-bombardment": 1, "direct-from-hq": 1 },
    ],
    // Without infantry, the set still follows the armour and artillery
    [[UnitType.TANK], { "move-out": 2, refuel: 1, "direct-from-hq": 2 }],
    [[UnitType.ARTILLERY], { "move-out": 2, "artillery-bombardment": 1, "direct-from-hq": 2 }],
    [[UnitType.TANK, UnitType.ARTILLERY], { "move-out": 2, refuel: 1, "artillery-bombardment": 1, "direct-from-hq": 1 }],
  ])("adds the unit-type cards for %j", (types, expected) => {
    const counts = countsById(withAlliedUnits(types));
    const unitCards = ["move-out", "refuel", "armor-assault", "artillery-bombardment", "direct-from-hq"];

    expect(Object.fromEntries(unitCards.filter((id) => counts[id]).map((id) => [id, counts[id]]))).toEqual(expected);
  });

  it("counts a side's paradropped units", () => {
    const scenario = { ...withAlliedUnits([UnitType.INFANTRY]), paradrop: { faction: "Allies" as const, unitType: UnitType.TANK, units: 1 } };

    expect(countsById(scenario).refuel).toBe(1);
  });

  it("names section cards after their section", () => {
    const deck = commandDeckFor(base, "Allies");
    const names = deck.map((card) => card.name);

    expect(names).toContainEqual({ es: "Batida en el flanco izquierdo", en: "Probe Left Flank" });
    expect(names).toContainEqual({ es: "Ataque en el centro", en: "Attack Center" });
    expect(deck.find((card) => card.id === "assault-right-1")!.description).toEqual({
      es: "Da órdenes a todas las unidades del flanco derecho.",
      en: "Order all units on the right flank.",
    });
  });
});
