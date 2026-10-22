import { describe, expect, it } from "vitest";
import { LABELS } from ".";
import { DieFace } from "../game-core/dice";
import Hex from "../game-core/hex";
import Unit, { UnitType } from "../game-core/unit";
import { HexType } from "../types/hex";
import { moveLimits } from "../game-core/orderRules";
import { LANGS } from "../i18n/lang";

describe("Spanish descriptions", () => {
  const { describeFaces, describeHex, describeMovement } = LABELS.es;

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
    const limits = moveLimits(new Unit(unitType));
    expect(describeMovement(limits)).toBe(text);
  });

  it("explains limits that stop a unit moving, or firing", () => {
    expect(describeMovement({ maxMove: 0, moveAndFire: 0, holdShots: 1 })).toBe("No puede moverse con esta carta");
    expect(describeMovement({ maxMove: 2, moveAndFire: 0, holdShots: 0 })).toBe("Mueve hasta 2 casillas; no puede disparar");
  });

  it("sums up a roll by face, or says it had no effect", () => {
    const { INFANTRY, GRENADE } = DieFace;
    expect(describeFaces([GRENADE, INFANTRY, INFANTRY])).toBe("2 × Infantería · 1 × Granada");
    expect(describeFaces([])).toBe("sin efecto");
  });
});

describe("English descriptions", () => {
  const { describeFaces, describeHex, describeMovement, coins, describeRoll } = LABELS.en;

  it("describes a hex by its unit and terrain, elite units included", () => {
    const hex = new Hex({ row: 0, col: 0 }, HexType.FOREST);

    expect(describeHex(hex)).toBe("forest");
    hex.placeUnit(new Unit(UnitType.INFANTRY, true));
    expect(describeHex(hex)).toBe("Elite infantry in forest");
  });

  it("names a unit from its type and badge", () => {
    expect(LABELS.en.unitKind(UnitType.TANK)).toBe("Tank");
    expect(LABELS.en.unitKind(UnitType.INFANTRY, true)).toBe("Elite infantry");
    expect(LABELS.es.unitKind(UnitType.INFANTRY, true)).toBe("Infantería de élite");
  });

  it("explains how a unit moves and fires", () => {
    const limits = moveLimits(new Unit(UnitType.INFANTRY));
    expect(describeMovement(limits)).toBe("Moves up to 2 hexes; can fire if it moves up to 1 hex");
  });

  it("counts dice faces, supplies and roll results", () => {
    const { INFANTRY, GRENADE } = DieFace;
    expect(describeFaces([GRENADE, INFANTRY, INFANTRY])).toBe("2 × Infantry · 1 × Grenade");
    expect(coins(1)).toBe("1 supply");
    expect(describeRoll({ hits: 1, retreats: 2, coins: 3, hitFaces: [] })).toBe("1 hit · 2 retreats · +3 supplies");
  });
});

describe("every language", () => {
  it.each(LANGS)("names every unit, terrain and section in %s", (lang) => {
    const labels = LABELS[lang];
    for (const table of [labels.units, labels.terrain, labels.sections, labels.sectionsShort, labels.dieFaces, labels.deckReasons]) {
      Object.values(table).forEach((text) => expect(text).not.toBe(""));
    }
  });
});
