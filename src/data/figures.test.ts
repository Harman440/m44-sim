import { describe, expect, it } from "vitest";
import { damagedFigures, freshFigures, healFigure, hitsPerFigure, hitsToDestroy, mendFigure, resultLimit, takeHits } from "./figures";
import { UnitType } from "../game-core/unit";

describe("figures", () => {
  it("takes 6 hits to destroy infantry, 6 armour (2 a figure) and 3 artillery", () => {
    expect(hitsToDestroy(UnitType.INFANTRY)).toBe(6);
    expect(hitsToDestroy(UnitType.TANK)).toBe(6);
    expect(hitsToDestroy(UnitType.ARTILLERY)).toBe(3);
  });

  it("loses an armour figure only once both its hits are taken", () => {
    const tank = freshFigures(UnitType.TANK);
    expect(takeHits(tank, 1, 2)).toEqual([1, 0, 0]);
    expect(takeHits(tank, 2, 2)).toEqual([0, 0]);
    expect(takeHits(tank, 5, 2)).toEqual([1]);
    expect(takeHits(tank, 9, 2)).toEqual([]);
    expect(takeHits(freshFigures(UnitType.INFANTRY), 5, 1)).toEqual([0]);
  });

  it("takes 3 hits for each figure of an elite tank, 9 in all; elite infantry is as any other", () => {
    expect(hitsToDestroy(UnitType.TANK, true)).toBe(9);
    expect(takeHits(freshFigures(UnitType.TANK), 2, hitsPerFigure(UnitType.TANK, true))).toEqual([2, 0, 0]);
    expect(takeHits(freshFigures(UnitType.TANK), 3, hitsPerFigure(UnitType.TANK, true))).toEqual([0, 0]);
    expect(hitsToDestroy(UnitType.INFANTRY, true)).toBe(hitsToDestroy(UnitType.INFANTRY));
  });

  it("hits the most damaged figure first, and the squad leader only once it's alone", () => {
    expect(takeHits([0, 1, 0], 1, 2)).toEqual([0, 0]);
    expect(takeHits([1, 2, 0], 1, 3)).toEqual([1, 0]);
    // A damaged leader behind healthy figures isn't hit while they stand
    expect(takeHits([0, 0, 1], 1, 2)).toEqual([1, 0, 1]);
    expect(takeHits([0, 1], 2, 2)).toEqual([1]);
    expect(takeHits([1], 1, 2)).toEqual([]);
  });

  it("counts the damaged figures", () => {
    expect(damagedFigures([1, 0, 1])).toBe(2);
    expect(damagedFigures(freshFigures(UnitType.INFANTRY))).toBe(0);
  });

  it("mends the most damaged figure (Mechanic)", () => {
    expect(mendFigure([1, 2, 0])).toEqual([1, 0, 0]);
    expect(mendFigure([0, 0])).toEqual([0, 0]);
  });

  it("brings a lost figure back at the front, up to full strength (Medic)", () => {
    expect(healFigure([0, 0], UnitType.INFANTRY)).toEqual([0, 0, 0]);
    expect(healFigure(freshFigures(UnitType.INFANTRY), UnitType.INFANTRY)).toHaveLength(6);
  });

  it("applies as many results as figures, one more with a card's extra dice", () => {
    expect(resultLimit(2, false)).toBe(2);
    expect(resultLimit(2, true)).toBe(3);
  });
});
