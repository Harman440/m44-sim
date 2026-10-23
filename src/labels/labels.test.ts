import { describe, expect, it } from "vitest";
import { LABELS } from ".";
import { DieFace } from "../game-core/dice";
import Hex from "../game-core/hex";
import Unit, { UnitType } from "../game-core/unit";
import { Supply } from "../data/unitSupplies";
import { fullSupplies } from "../game-core/unitSupplies";
import { HexType } from "../types/hex";
import { moveLimitsOf } from "../game-core/actionRules";
import { actionById } from "../data/unitActions";
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
    ["infantry:assault", "Mueve hasta 2 casillas; puede disparar si mueve hasta 2 casillas"],
    ["infantry:moveOut", "Mueve hasta 2 casillas; puede disparar si mueve hasta 1 casilla"],
    ["tank:assault", "Mueve hasta 3 casillas; puede disparar si mueve hasta 3 casillas"],
    ["artillery:reposition", "Mueve hasta 2 casillas; no puede disparar"],
    ["artillery:firefight", "No se mueve; dispara"],
    ["infantry:reload", "No se mueve ni dispara"],
  ])("explains how %s moves and fires", (id, text) => {
    expect(describeMovement(moveLimitsOf(actionById(id)!))).toBe(text);
  });

  it("explains limits that stop a unit moving, or firing", () => {
    expect(describeMovement({ maxMove: 2, moveAndFire: 0, holdShots: 1 })).toBe("Mueve hasta 2 casillas; si se mueve no puede disparar");
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
    expect(describeMovement(moveLimitsOf(actionById("infantry:moveOut")!))).toBe("Moves up to 2 hexes; can fire if it moves up to 1 hex");
    expect(describeMovement(moveLimitsOf(actionById("tank:firefight")!))).toBe("Doesn't move; fires");
  });

  it("lists a unit's supplies, and why an action can't be given", () => {
    expect(LABELS.en.describeSupplies(fullSupplies(UnitType.TANK))).toBe("Fuel 5 · Shells 2");
    expect(LABELS.es.describeSupplies(fullSupplies(UnitType.INFANTRY))).toBe(
      "Moral 5 · Energía 5 · Munición 2 · Explosivos 1 · Sacos terreros 1 · Botiquín 1 · Red de camuflaje 1"
    );
    expect(LABELS.en.actionRefusals[Supply.ENERGY]).toBe("No energy");
    expect(LABELS.es.describeCost(actionById("infantry:fortify")!.cost)).toBe("2 energía + sacos terreros");
    expect(LABELS.en.describeCost(actionById("tank:reload")!.cost)).toBe("free");
    expect(LABELS.en.describeCost({ amounts: { [Supply.SHELLS]: 1 } })).toBe("1 shell");
    expect(LABELS.es.describeCost({ amounts: { [Supply.SHELLS]: 2 } })).toBe("2 proyectiles");
    expect(LABELS.es.actionRefusals[Supply.MORALE]).toBe("Moral 0");
  });

  it("counts dice faces, supplies and roll results", () => {
    const { INFANTRY, GRENADE } = DieFace;
    expect(describeFaces([GRENADE, INFANTRY, INFANTRY])).toBe("2 × Infantry · 1 × Grenade");
    expect(coins(1)).toBe("1 supply");
    expect(describeRoll({ hits: 1, retreats: 2, coins: 3, hitFaces: [] })).toBe("1 hit · 2 retreats · +3 supplies");
  });
});

describe("every language", () => {
  it.each(LANGS)("names every unit, terrain and die face in %s", (lang) => {
    const labels = LABELS[lang];
    for (const table of [labels.units, labels.terrain, labels.dieFaces]) {
      Object.values(table).forEach((text) => expect(text).not.toBe(""));
    }
  });
});
