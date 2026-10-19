import { describe, expect, it } from "vitest";
import { countMedals, heldObjectives, winnerOf } from "./victory";
import { UnitType } from "./unit";
import { same } from "../i18n/lang";

const objectives = [
  { faction: "Allies" as const, name: same("Bridge"), hexes: [{ row: 2, col: 3 }, { row: 5, col: 10 }] },
  { faction: "Axis" as const, name: same("Town"), hexes: [{ row: 4, col: 6 }] },
];

describe("victory", () => {
  it("counts an objective hex only for its own side, while one of its units stands there", () => {
    const held = heldObjectives(objectives, {
      Allies: [{ row: 2, col: 3 }, { row: 4, col: 6 }],
      Axis: [{ row: 5, col: 10 }],
    });
    expect(held).toEqual({ Allies: [{ row: 2, col: 3 }], Axis: [] });
  });

  it("gives a side a medal for each enemy unit destroyed and each objective it holds", () => {
    const medals = countMedals(
      { Allies: [UnitType.INFANTRY], Axis: [UnitType.TANK, UnitType.ARTILLERY] },
      { Allies: [{ row: 2, col: 3 }], Axis: [] }
    );
    expect(medals).toEqual({
      Allies: { destroyed: 2, objectives: 1, total: 3 },
      Axis: { destroyed: 1, objectives: 0, total: 1 },
    });
  });

  it("is won by the side that reaches the medals, the one with more when both do, and goes on when they're level", () => {
    const victory = { medals: 3 };
    const side = (total: number) => ({ destroyed: total, objectives: 0, total });
    const units = { Allies: 5, Axis: 5 };
    expect(winnerOf(victory, { Allies: side(2), Axis: side(2) }, units)).toBeNull();
    expect(winnerOf(victory, { Allies: side(3), Axis: side(1) }, units)).toEqual({ winner: "Allies", wipedOut: false });
    expect(winnerOf(victory, { Allies: side(3), Axis: side(4) }, units)).toEqual({ winner: "Axis", wipedOut: false });
    expect(winnerOf(victory, { Allies: side(3), Axis: side(3) }, units)).toBeNull();
  });

  it("is lost by a side with no units left, whatever the medals", () => {
    const none = { destroyed: 0, objectives: 0, total: 0 };
    expect(winnerOf({ medals: 6 }, { Allies: none, Axis: none }, { Allies: 0, Axis: 2 })).toEqual({ winner: "Axis", wipedOut: true });
  });
});
