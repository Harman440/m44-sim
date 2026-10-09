import { describe, expect, it } from "vitest";
import BoardManager from "./BoardManager";
import { fireTargets, hasLineOfSight, hexDistance } from "./fireTargets";
import { UnitType } from "./unit";
import CommandCard from "./commandCard";
import { HexType } from "../types/hex";
import { Position } from "../types/scenario";
import { Scenario } from "../types/scenario";
import { positionKey } from "./position";
import { same } from "../i18n/lang";

const board = (tiles: Scenario["tiles"] = {}, units: Scenario["units"]["allies"] = {}) =>
  new BoardManager({
    id: "test",
    name: "Test",
    description: same(""),
    initialHandSize: { allies: 1, axis: 1 },
    attacker: "Allies",
    tiles,
    units: { allies: units, axis: {} },
  } as Scenario);

const at = (targets: ReturnType<typeof fireTargets>, p: Position) =>
  targets.find((t) => positionKey(t.position) === positionKey(p));

describe("hexDistance", () => {
  it("counts hexes on the offset grid, odd rows shifted right", () => {
    expect(hexDistance({ row: 4, col: 4 }, { row: 4, col: 5 })).toBe(1);
    // Row 3 is odd: its hex 3-3 sits between 4-3 and 4-4
    expect(hexDistance({ row: 4, col: 4 }, { row: 3, col: 3 })).toBe(1);
    expect(hexDistance({ row: 4, col: 4 }, { row: 3, col: 4 })).toBe(1);
    expect(hexDistance({ row: 4, col: 4 }, { row: 3, col: 5 })).toBe(2);
    expect(hexDistance({ row: 4, col: 4 }, { row: 1, col: 4 })).toBe(3);
    expect(hexDistance({ row: 0, col: 0 }, { row: 0, col: 6 })).toBe(6);
  });
});

describe("hasLineOfSight", () => {
  const from = { row: 4, col: 2 };
  const to = { row: 4, col: 5 };

  it("is clear over open ground, and always to an adjacent hex", () => {
    expect(hasLineOfSight(board(), from, to)).toBe(true);
    expect(hasLineOfSight(board({ forest: [{ row: 4, col: 3 }] }), from, { row: 4, col: 3 })).toBe(true);
  });

  it("is blocked by a forest, town, hill or hedgerow in between, but not at the ends", () => {
    for (const terrain of ["forest", "town", "hill", "hedgerow"] as const) {
      expect(hasLineOfSight(board({ [terrain]: [{ row: 4, col: 3 }] }), from, to)).toBe(false);
    }
    expect(hasLineOfSight(board({ forest: [to, from] }), from, to)).toBe(true);
  });

  it("sees over rivers, lakes and bridges", () => {
    for (const terrain of ["river", "lake", "bridge"] as const) {
      expect(hasLineOfSight(board({ [terrain]: [{ row: 4, col: 3 }] }), from, to)).toBe(true);
    }
  });

  it("from a hill to a hill, sees over the hills in between (official hill rule)", () => {
    const hills = board({ hill: [from, { row: 4, col: 3 }, { row: 4, col: 4 }, to] });
    expect(hasLineOfSight(hills, from, to)).toBe(true);
    // Not from open ground
    expect(hasLineOfSight(board({ hill: [{ row: 4, col: 3 }, to] }), from, to)).toBe(false);
  });

  it("is blocked by one of this side's units in between", () => {
    expect(hasLineOfSight(board({}, { infantry: [{ row: 4, col: 4 }] }), from, to)).toBe(false);
  });

  it("along the edge between two hexes, is blocked only when both block", () => {
    // Straight up two rows: the line runs along the edge between 3-3 and 3-4
    const a = { row: 4, col: 4 };
    const b = { row: 2, col: 4 };
    expect(hexDistance(a, b)).toBe(2);
    expect(hasLineOfSight(board({ forest: [{ row: 3, col: 3 }] }), a, b)).toBe(true);
    expect(hasLineOfSight(board({ forest: [{ row: 3, col: 4 }] }), a, b)).toBe(true);
    expect(hasLineOfSight(board({ forest: [{ row: 3, col: 3 }, { row: 3, col: 4 }] }), a, b)).toBe(false);
  });
});

describe("fireTargets", () => {
  const from = { row: 4, col: 4 };

  it("lists the hexes in range with their dice, without this side's units", () => {
    const b = board({ forest: [{ row: 4, col: 5 }] }, { infantry: [from, { row: 4, col: 3 }] });
    const targets = fireTargets(b, from, { unitType: UnitType.INFANTRY, card: null });

    expect(targets.every((t) => t.distance >= 1 && t.distance <= 3)).toBe(true);
    expect(at(targets, { row: 4, col: 3 })).toBeUndefined(); // own unit
    expect(at(targets, from)).toBeUndefined();
    expect(at(targets, { row: 4, col: 5 })).toMatchObject({ distance: 1, terrain: HexType.FOREST, dice: 2 });
    expect(at(targets, { row: 4, col: 6 })).toMatchObject({ distance: 2, terrain: HexType.PLAINS, dice: 2 });
  });

  it("gives 0 dice where terrain takes them all (infantry 3 hexes away into forest), and adds the card's dice", () => {
    const b = board({ forest: [{ row: 4, col: 7 }] });
    expect(at(fireTargets(b, from, { unitType: UnitType.INFANTRY, card: null }), { row: 4, col: 7 })!.dice).toBe(0);

    const card = new CommandCard({ id: "bonus", orders: 1, fireBonus: [{ dice: 1 }] });
    expect(at(fireTargets(b, from, { unitType: UnitType.INFANTRY, card }), { row: 4, col: 7 })!.dice).toBe(1);
  });

  it("reaches only adjacent hexes in close assault", () => {
    const targets = fireTargets(board(), from, { unitType: UnitType.TANK, card: null, closeAssaultOnly: true });
    expect(targets).toHaveLength(6);
    expect(targets.every((t) => t.distance === 1)).toBe(true);
  });

  it("fires from a hill at a hill as if it were open ground", () => {
    const b = board({ hill: [from, { row: 4, col: 5 }] });
    expect(at(fireTargets(b, from, { unitType: UnitType.TANK, card: null }), { row: 4, col: 5 })!.dice).toBe(3);
    const low = board({ hill: [{ row: 4, col: 5 }] });
    expect(at(fireTargets(low, from, { unitType: UnitType.TANK, card: null }), { row: 4, col: 5 })!.dice).toBe(2);
  });

  it("gives armour in a town 2 dice fewer at every target", () => {
    const b = board({ town: [from] });
    const tank = fireTargets(b, from, { unitType: UnitType.TANK, card: null });
    expect(at(tank, { row: 4, col: 5 })!.dice).toBe(1);
    expect(at(tank, { row: 4, col: 7 })!.dice).toBe(1);
    expect(at(fireTargets(b, from, { unitType: UnitType.INFANTRY, card: null }), { row: 4, col: 5 })!.dice).toBe(3);
  });

  it("never offers water, and fires at a bridge as at open ground", () => {
    const b = board({ river: [{ row: 4, col: 5 }], lake: [{ row: 3, col: 4 }], bridge: [{ row: 5, col: 4 }] });
    const targets = fireTargets(b, from, { unitType: UnitType.INFANTRY, card: null });
    expect(at(targets, { row: 4, col: 5 })).toBeUndefined();
    expect(at(targets, { row: 3, col: 4 })).toBeUndefined();
    expect(at(targets, { row: 5, col: 4 })).toMatchObject({ terrain: HexType.BRIDGE, dice: 3 });
    expect(at(targets, { row: 4, col: 6 })).toMatchObject({ distance: 2, dice: 2, lineOfSight: true }); // over the river
  });

  it("marks hexes out of sight", () => {
    const b = board({ town: [{ row: 4, col: 5 }] });
    const targets = fireTargets(b, from, { unitType: UnitType.INFANTRY, card: null });
    expect(at(targets, { row: 4, col: 5 })!.lineOfSight).toBe(true);
    expect(at(targets, { row: 4, col: 6 })!.lineOfSight).toBe(false);
  });

  it("lets artillery fire without line of sight", () => {
    const b = board({ town: [{ row: 4, col: 5 }] }, { infantry: [{ row: 4, col: 6 }] });
    const targets = fireTargets(b, from, { unitType: UnitType.ARTILLERY, card: null });
    expect(at(targets, { row: 4, col: 7 })!.lineOfSight).toBe(true); // behind the town and a unit
    expect(targets.every((t) => t.lineOfSight)).toBe(true);
  });
});
