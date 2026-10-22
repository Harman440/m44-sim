import { describe, expect, it } from "vitest";
import { cardCost, cardsOf, isReady, sideHasCard, turnsLeft } from "./actionCard";
import { ACTION_CARDS, CARD_COOLDOWN_TURNS, actionCardById } from "../data/actionCards";
import { scenarios } from "../data/scenarios";
import type { Scenario } from "../types/scenario";

const scenario: Scenario = scenarios[0]!;
const card = (id: string) => actionCardById(id)!;
const ids = (held: ReturnType<typeof cardsOf>) => held.map((each) => each.card.id);

describe("the actions mode's command cards", () => {
  it("are the seven cards of the house rules, at their costs", () => {
    expect(Object.fromEntries(ACTION_CARDS.map((each) => [each.id, each.cost]))).toEqual({
      "finest-hour": 15,
      resupply: 9,
      refuel: 10,
      "air-bombardment": 8,
      reinforcements: 10,
      barrage: 8,
      "air-power": 7,
    });
    for (const each of ACTION_CARDS) expect(each.name.es && each.name.en && each.description.es && each.description.en).toBeTruthy();
  });

  it("give a side the air cards only with air sorties, and Barrage only with big guns", () => {
    const noAir: Scenario = { ...scenario, airPower: { allies: 0, axis: 2 }, bigGuns: ["Allies"] };

    expect(ids(cardsOf(noAir, "Allies"))).toEqual(["finest-hour", "resupply", "refuel", "reinforcements", "barrage"]);
    expect(ids(cardsOf(noAir, "Axis"))).toEqual(["finest-hour", "resupply", "refuel", "air-bombardment", "reinforcements", "air-power"]);
    expect(sideHasCard({ ...scenario, airPower: undefined, bigGuns: undefined }, "Axis", card("barrage"))).toBe(true);
  });

  it("cost a side what the scenario says, or what the card says", () => {
    const cheaper: Scenario = { ...scenario, cardCosts: { allies: { "air-power": 4 }, axis: {} } };

    expect(cardCost(cheaper, "Allies", card("air-power"))).toBe(4);
    expect(cardCost(cheaper, "Axis", card("air-power"))).toBe(7);
    expect(cardsOf(cheaper, "Allies").find((each) => each.card.id === "finest-hour")?.cost).toBe(15);
  });

  it("wait 3 turns after they're played: played on turn 2, ready again on turn 5", () => {
    expect(CARD_COOLDOWN_TURNS).toBe(3);
    expect(isReady(undefined, 1)).toBe(true);
    expect(turnsLeft(2, 3)).toBe(2);
    expect(isReady(2, 4)).toBe(false);
    expect(isReady(2, 5)).toBe(true);
    expect(turnsLeft(2, 9)).toBe(0);
  });
});
