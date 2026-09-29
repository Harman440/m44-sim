import { describe, expect, it } from "vitest";
import { DieFace, DIE_SIDES, LONG_RANGE_DIE_SIDES, countFaces, rollDice } from "./dice";

describe("battle dice", () => {
  it("has the Memoir '44 faces: 2 infantry, 1 tank, 1 grenade, 1 supply, 1 flag", () => {
    expect(countFaces(DIE_SIDES)).toEqual({
      [DieFace.INFANTRY]: 2,
      [DieFace.TANK]: 1,
      [DieFace.GRENADE]: 1,
      [DieFace.SUPPLY]: 1,
      [DieFace.FLAG]: 1,
      [DieFace.MISS]: 0,
    });
  });

  it("maps each sixth of the random range to one side", () => {
    const rolls = [0, 0.2, 0.34, 0.5, 0.67, 0.99];
    let i = 0;

    expect(rollDice(6, () => rolls[i++]!)).toEqual([
      DieFace.INFANTRY,
      DieFace.INFANTRY,
      DieFace.TANK,
      DieFace.GRENADE,
      DieFace.SUPPLY,
      DieFace.FLAG,
    ]);
  });

  it("rolls the requested number of dice, and none for zero or less", () => {
    expect(rollDice(4)).toHaveLength(4);
    expect(rollDice(0)).toEqual([]);
    expect(rollDice(-2)).toEqual([]);
  });

  it("counts faces, including ones that didn't come up", () => {
    const counts = countFaces([DieFace.SUPPLY, DieFace.SUPPLY, DieFace.TANK]);

    expect(counts[DieFace.SUPPLY]).toBe(2);
    expect(counts[DieFace.TANK]).toBe(1);
    expect(counts[DieFace.FLAG]).toBe(0);
  });
});

describe("the long-range die", () => {
  it("has 8 sides: 3 infantry, tank, grenade, supply, flag and a miss", () => {
    expect(LONG_RANGE_DIE_SIDES).toHaveLength(8);
    expect(countFaces(LONG_RANGE_DIE_SIDES)).toEqual({ infantry: 3, tank: 1, grenade: 1, supply: 1, flag: 1, miss: 1 });
  });

  it("rolls with its own sides", () => {
    expect(rollDice(1, () => 0.99, LONG_RANGE_DIE_SIDES)).toEqual([DieFace.MISS]);
  });
});
