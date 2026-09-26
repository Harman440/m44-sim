import { describe, expect, it } from "vitest";
import { describeFaces, describeHex, describeMovement } from "./labels";
import { DieFace } from "./game-core/dice";
import Hex from "./game-core/hex";
import Unit, { UnitType } from "./game-core/unit";
import { HexType } from "./types/hex";

describe("Spanish descriptions", () => {
  it("describes a hex by its unit and terrain", () => {
    const hex = new Hex({ row: 0, col: 0 }, HexType.FOREST);

    expect(describeHex(hex)).toBe("bosque");
    hex.placeUnit(new Unit(UnitType.TANK));
    expect(describeHex(hex)).toBe("Tanque en bosque");
  });

  it.each([
    [UnitType.INFANTRY, "Mueve hasta 2 casillas; puede disparar si mueve hasta 1 casilla"],
    [UnitType.TANK, "Mueve hasta 3 casillas; puede disparar si mueve hasta 3 casillas"],
    [UnitType.ARTILLERY, "Mueve hasta 1 casilla; si se mueve no puede disparar"],
  ])("explains how %s moves and fires", (unitType, text) => {
    expect(describeMovement(new Unit(unitType))).toBe(text);
  });

  it("sums up a roll by face, or says it had no effect", () => {
    const { INFANTRY, GRENADE } = DieFace;
    expect(describeFaces([GRENADE, INFANTRY, INFANTRY])).toBe("2 × Infantería · 1 × Granada");
    expect(describeFaces([])).toBe("sin efecto");
  });
});
