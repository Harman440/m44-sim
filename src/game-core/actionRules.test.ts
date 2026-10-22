import { describe, expect, it } from "vitest";
import { UnitType } from "./unit";
import { actionRefusal, actionsFor, moveLimitsOf, moveRulesOf, plainActionForMove, plainActionsFor, shotsOf } from "./actionRules";
import { UnitSupplies, fullSupplies } from "./unitSupplies";
import { UNIT_ACTIONS, actionById } from "../data/unitActions";
import { Equipment, Supply } from "../data/unitSupplies";
import type { UnitAction } from "./unitAction";

const action = (id: string): UnitAction => actionById(id)!;

/** The unit's full supplies with some changed */
const suppliesWith = (unitType: UnitType, amounts: Partial<Record<Supply, number>>, equipment: Partial<Record<Equipment, number>> = {}): UnitSupplies => {
  const full = fullSupplies(unitType);
  return { amounts: { ...full.amounts, ...amounts }, equipment: { ...full.equipment, ...equipment } };
};

const refusal = (id: string, supplies: UnitSupplies, ownTablets = false) =>
  actionRefusal(action(id), { unitType: action(id).unitType, supplies, ownTablets });

describe("which actions a unit can be given", () => {
  it("allows every action of its type with full supplies, in pass and play", () => {
    for (const unitType of Object.values(UnitType)) {
      for (const each of UNIT_ACTIONS[unitType]) {
        expect(actionRefusal(each, { unitType, supplies: fullSupplies(unitType), ownTablets: false }), each.id).toBeNull();
      }
    }
  });

  it("refuses another unit type's action", () => {
    expect(actionRefusal(action("tank:assault"), { unitType: UnitType.INFANTRY, supplies: fullSupplies(UnitType.INFANTRY), ownTablets: false })).toBe("unitType");
  });

  it("leaves Morale Up out on own tablets, which don't track morale", () => {
    expect(refusal("infantry:moraleUp", fullSupplies(UnitType.INFANTRY), true)).toBe("ownTablets");
    expect(actionsFor(UnitType.INFANTRY, true).map((each) => each.id)).not.toContain("infantry:moraleUp");
    expect(actionsFor(UnitType.INFANTRY, false).map((each) => each.id)).toContain("infantry:moraleUp");
    expect(actionsFor(UnitType.TANK, true)).toEqual(UNIT_ACTIONS[UnitType.TANK]);
  });

  it("at morale 0 allows only Morale Up", () => {
    const shaken = suppliesWith(UnitType.INFANTRY, { [Supply.MORALE]: 0 });
    for (const each of UNIT_ACTIONS[UnitType.INFANTRY]) {
      expect(refusal(each.id, shaken), each.id).toBe(each.effect === "moraleUp" ? null : Supply.MORALE);
    }
  });

  it.each([
    // [action, the supplies it lacks, why]
    ["infantry:firefight", { [Supply.ENERGY]: 0 }, Supply.ENERGY],
    ["infantry:noRespite", { [Supply.ENERGY]: 1 }, Supply.ENERGY],
    ["infantry:behindEnemyLines", { [Supply.ENERGY]: 3 }, Supply.ENERGY],
    ["infantry:motorized", { [Supply.ENERGY]: 1 }, Supply.ENERGY],
    ["infantry:moraleUp", { [Supply.ENERGY]: 0 }, Supply.ENERGY],
    ["infantry:takeCover", { [Supply.ENERGY]: 0 }, Supply.ENERGY],
    ["infantry:firefight", { [Supply.AMMO]: 0 }, Supply.AMMO],
    ["infantry:assault", { [Supply.AMMO]: 0 }, Supply.AMMO],
    ["tank:assault", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["tank:armorForward", { [Supply.FUEL]: 1 }, Supply.FUEL],
    ["tank:firefight", { [Supply.SHELLS]: 0 }, Supply.SHELLS],
    ["tank:assault", { [Supply.SHELLS]: 0 }, Supply.SHELLS],
    ["artillery:bombardment", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["artillery:reposition", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["artillery:fortify", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["artillery:firefight", { [Supply.SHELLS]: 0 }, Supply.SHELLS],
  ] as const)("refuses %s without enough (%o): %s", (id, amounts, why) => {
    expect(refusal(id, suppliesWith(action(id).unitType, amounts))).toBe(why);
  });

  it.each([
    ["infantry:medic", Equipment.MEDIC_KIT],
    ["infantry:camouflage", Equipment.CAMOUFLAGE_NET],
    ["infantry:fortify", Equipment.SANDBAGS],
  ] as const)("refuses %s without its %s", (id, kind) => {
    expect(refusal(id, suppliesWith(UnitType.INFANTRY, {}, { [kind]: 0 }))).toBe("equipment");
  });

  it("lets actions that don't fire go without ammo or shells, and free ones without energy or fuel", () => {
    expect(refusal("infantry:moveOut", suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 0 }))).toBeNull();
    expect(refusal("infantry:reload", suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 0, [Supply.ENERGY]: 0 }))).toBeNull();
    expect(refusal("tank:reload", suppliesWith(UnitType.TANK, { [Supply.SHELLS]: 0, [Supply.FUEL]: 0 }))).toBeNull();
    expect(refusal("tank:mechanic", suppliesWith(UnitType.TANK, { [Supply.FUEL]: 0 }))).toBeNull();
    expect(refusal("tank:firefight", suppliesWith(UnitType.TANK, { [Supply.FUEL]: 0 }))).toBeNull();
  });
});

describe("how far an action moves", () => {
  it.each([
    ["infantry:firefight", { maxMove: 0, moveAndFire: 0, holdShots: 1 }],
    ["infantry:assault", { maxMove: 1, moveAndFire: 1, holdShots: 1 }],
    ["infantry:moveOut", { maxMove: 2, moveAndFire: 0, holdShots: 0 }],
    ["infantry:motorized", { maxMove: 3, moveAndFire: 0, holdShots: 0 }],
    ["infantry:behindEnemyLines", { maxMove: 3, moveAndFire: 3, holdShots: 1 }],
    ["infantry:takeCover", { maxMove: 1, moveAndFire: 0, holdShots: 0 }],
    ["tank:assault", { maxMove: 3, moveAndFire: 3, holdShots: 1 }],
    ["tank:mechanic", { maxMove: 0, moveAndFire: 0, holdShots: 0 }],
    ["artillery:bombardment", { maxMove: 0, moveAndFire: 0, holdShots: 2 }],
    ["artillery:reposition", { maxMove: 2, moveAndFire: 0, holdShots: 0 }],
  ])("%s", (id, limits) => {
    expect(moveLimitsOf(action(id))).toEqual(limits);
    expect(shotsOf(action(id))).toBe(limits.holdShots);
  });

  it("ignores terrain limits only for Armour Forward and Behind Enemy Lines", () => {
    const ignoring = Object.values(UNIT_ACTIONS).flat().filter((each) => moveRulesOf(each).ignoreTerrain).map((each) => each.id);
    expect(ignoring).toEqual(["infantry:behindEnemyLines", "tank:armorForward"]);
  });
});

describe("the plain action for a move", () => {
  it("tries Firefight, Assault, Move Out and Motorized for infantry; Firefight and Assault for tanks; Firefight and Reposition for artillery", () => {
    const ids = (unitType: UnitType) => plainActionsFor(unitType).map((each) => each.id);
    expect(ids(UnitType.INFANTRY)).toEqual(["infantry:firefight", "infantry:assault", "infantry:moveOut", "infantry:motorized"]);
    expect(ids(UnitType.TANK)).toEqual(["tank:firefight", "tank:assault"]);
    expect(ids(UnitType.ARTILLERY)).toEqual(["artillery:firefight", "artillery:reposition"]);
  });

  it("picks the first that reaches the hex and fires from it, else the first that reaches it", () => {
    const options = [
      { id: "a", reaches: false, fires: false },
      { id: "b", reaches: true, fires: false },
      { id: "c", reaches: true, fires: true },
    ];
    expect(plainActionForMove(options)?.id).toBe("c");
    expect(plainActionForMove(options.slice(0, 2))?.id).toBe("b");
    expect(plainActionForMove(options.slice(0, 1))).toBeNull();
  });
});
