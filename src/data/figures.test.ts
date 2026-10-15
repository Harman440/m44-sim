import { describe, expect, it } from "vitest";
import { figuresLeft, hitsToDestroy, resultLimit } from "./figures";
import { UnitType } from "../game-core/unit";

describe("figures", () => {
  it("takes 6 hits to destroy infantry, 6 armour (2 a figure) and 3 artillery", () => {
    expect(hitsToDestroy(UnitType.INFANTRY)).toBe(6);
    expect(hitsToDestroy(UnitType.TANK)).toBe(6);
    expect(hitsToDestroy(UnitType.ARTILLERY)).toBe(3);
  });

  it("loses an armour figure only once both its hits are taken", () => {
    expect(figuresLeft(UnitType.TANK, 0)).toBe(3);
    expect(figuresLeft(UnitType.TANK, 1)).toBe(3);
    expect(figuresLeft(UnitType.TANK, 2)).toBe(2);
    expect(figuresLeft(UnitType.TANK, 5)).toBe(1);
    expect(figuresLeft(UnitType.TANK, 9)).toBe(0);
    expect(figuresLeft(UnitType.INFANTRY, 5)).toBe(1);
  });

  it("applies as many results as figures, one more with a card's extra dice", () => {
    expect(resultLimit(2, false)).toBe(2);
    expect(resultLimit(2, true)).toBe(3);
  });
});
