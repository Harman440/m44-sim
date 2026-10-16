import { describe, expect, it } from "vitest";
import CommandCard from "./commandCard";
import { CombatCard } from "./combatCard";
import { sortCombatHand, sortCommandHand } from "./handOrder";
import { Side } from "../types/hex";
import { UnitType } from "./unit";
import { same } from "../i18n/lang";

const command = (id: string, options: Partial<ConstructorParameters<typeof CommandCard>[0]> = {}) =>
  new CommandCard({ id, name: same(id), ...options });

describe("sortCommandHand", () => {
  it("puts left cards on the left, tactics in the middle and right cards on the right", () => {
    const hand = [
      command("right", { sections: [Side.RIGHT] }),
      command("tactic", { tactic: true }),
      command("left", { sections: [Side.LEFT] }),
      command("all", {}),
      command("center", { sections: [Side.CENTER] }),
      command("chosen", { sections: "chosen" }),
      command("armor", { unitTypes: [UnitType.TANK] }),
    ];

    expect(sortCommandHand(hand).map((card) => card.id)).toEqual(["left", "all", "center", "tactic", "chosen", "armor", "right"]);
  });

  it("keeps cards of the same place in the order they were drawn", () => {
    const hand = [command("b", { sections: [Side.LEFT] }), command("a", { sections: [Side.LEFT] })];

    expect(sortCommandHand(hand).map((card) => card.id)).toEqual(["b", "a"]);
  });
});

describe("sortCombatHand", () => {
  const combat = (id: string, cost: number): CombatCard => ({ id, name: same(id), description: same(""), cost });

  it("puts the cards that can be played first, then those that can't, cheaper first in each", () => {
    const hand = [combat("pricey", 6), combat("barrage", 4), combat("medic", 2), combat("costly", 7)];

    expect(sortCombatHand(hand, (card) => card.cost <= 5).map((card) => card.id)).toEqual(["medic", "barrage", "pricey", "costly"]);
  });
});
