import { describe, expect, it } from "vitest";
import { COMBAT_DECKS, combatDeckFor } from "./combatCards";
import { scenarios } from "./scenarios";

describe("combat card data", () => {
  const deck = combatDeckFor(scenarios[0]!, "Allies");

  it("builds the standard deck: 22 order cards (no Sniper) and 30 battle cards", () => {
    expect(deck.filter((card) => card.phase === "order")).toHaveLength(22);
    expect(deck.filter((card) => card.phase === "battle")).toHaveLength(30);
  });

  it("gives every card a unique id, a Spanish text and a cost", () => {
    expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
    deck.forEach((card) => {
      expect(card.name).not.toBe("");
      expect(card.description).not.toBe("");
      expect(card.cost).toBeGreaterThan(0);
    });
  });

  it("uses the standard deck unless the scenario names another", () => {
    expect(combatDeckFor({ ...scenarios[0]!, combatDecks: { axis: "standard" } }, "Axis")).toBe(deck);
    expect(Object.keys(COMBAT_DECKS)).toEqual(["standard"]);
  });
});
