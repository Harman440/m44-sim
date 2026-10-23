import { describe, expect, it } from "vitest";
import { UnitType } from "./unit";
import {
  actionCost,
  actionRefusal,
  actionsFor,
  canFireAShot,
  fireOptionRefusal,
  moveLimitsOf,
  moveRulesOf,
  plainActionForMove,
  plainActionsFor,
  plainFireOption,
  shotsOf,
} from "./actionRules";
import { UnitSupplies, fullSupplies } from "./unitSupplies";
import { UNIT_ACTIONS, actionById, fireOptionById } from "../data/unitActions";
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
  it("allows every action of its type with full supplies, in pass and play, but the ones that would change nothing", () => {
    const pointless = ["infantry:moraleUp", "infantry:reload", "tank:reload", "artillery:reload"];
    for (const unitType of Object.values(UnitType)) {
      for (const each of UNIT_ACTIONS[unitType]) {
        const why = actionRefusal(each, { unitType, supplies: fullSupplies(unitType), ownTablets: false });
        expect(why, each.id).toBe(pointless.includes(each.id) ? "notNeeded" : null);
      }
    }
  });

  it("refuses what would change nothing: Reload when full, Morale Up at full morale, Fortify on sandbags, Camouflage with the badge", () => {
    const infantry = fullSupplies(UnitType.INFANTRY);
    const context = { unitType: UnitType.INFANTRY, supplies: infantry, ownTablets: false };
    expect(refusal("infantry:reload", suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 1 }))).toBeNull();
    expect(refusal("infantry:moraleUp", suppliesWith(UnitType.INFANTRY, { [Supply.MORALE]: 3 }))).toBeNull();
    expect(refusal("tank:reload", suppliesWith(UnitType.TANK, { [Supply.SHELLS]: 1 }))).toBeNull();
    // Elite infantry holds more morale: 5 isn't full
    expect(actionRefusal(action("infantry:moraleUp"), { ...context, elite: true, supplies: suppliesWith(UnitType.INFANTRY, { [Supply.MORALE]: 5 }) })).toBeNull();
    expect(actionRefusal(action("infantry:fortify"), { ...context, sandbags: true })).toBe("notNeeded");
    expect(actionRefusal(action("infantry:fortify"), context)).toBeNull();
    expect(actionRefusal(action("infantry:camouflage"), { ...context, camouflaged: true })).toBe("notNeeded");
    expect(actionRefusal(action("artillery:fortify"), { unitType: UnitType.ARTILLERY, supplies: fullSupplies(UnitType.ARTILLERY), ownTablets: false, sandbags: true })).toBe("notNeeded");
  });

  it("costs morale only where it's tracked: own tablets pay Infantry Assault's energy alone", () => {
    expect(actionCost(action("infantry:assault"), false).amounts).toEqual({ [Supply.ENERGY]: 3, [Supply.MORALE]: 2 });
    expect(actionCost(action("infantry:assault"), true).amounts).toEqual({ [Supply.ENERGY]: 3 });
    expect(actionCost(action("infantry:firefight"), true)).toBe(action("infantry:firefight").cost);
    expect(refusal("infantry:assault", suppliesWith(UnitType.INFANTRY, { [Supply.MORALE]: 1 }))).toBe(Supply.MORALE);
    expect(refusal("infantry:assault", suppliesWith(UnitType.INFANTRY, { [Supply.MORALE]: 2 }))).toBeNull();
    expect(refusal("infantry:assault", suppliesWith(UnitType.INFANTRY, { [Supply.MORALE]: 1 }), true)).toBeNull();
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
      const why = refusal(each.id, shaken);
      // Reload with its ammo full has nothing to do whatever its morale
      if (each.effect === "reload") expect(why, each.id).toBe("notNeeded");
      else expect(why, each.id).toBe(each.effect === "moraleUp" ? null : Supply.MORALE);
    }
  });

  it.each([
    // [action, the supplies it lacks, why]
    ["infantry:firefight", { [Supply.ENERGY]: 0 }, Supply.ENERGY],
    ["infantry:noRespite", { [Supply.ENERGY]: 1 }, Supply.ENERGY],
    ["infantry:behindEnemyLines", { [Supply.ENERGY]: 4 }, Supply.ENERGY],
    ["infantry:motorized", { [Supply.ENERGY]: 3 }, Supply.ENERGY],
    ["infantry:assault", { [Supply.ENERGY]: 2 }, Supply.ENERGY],
    ["infantry:moraleUp", { [Supply.ENERGY]: 0, [Supply.MORALE]: 2 }, Supply.ENERGY],
    ["infantry:takeCover", { [Supply.ENERGY]: 0 }, Supply.ENERGY],
    ["infantry:firefight", { [Supply.AMMO]: 0 }, Supply.AMMO],
    ["infantry:assault", { [Supply.AMMO]: 0 }, Supply.AMMO],
    ["tank:assault", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["tank:armorForward", { [Supply.FUEL]: 1 }, Supply.FUEL],
    ["tank:firefight", { [Supply.SHELLS]: 0 }, Supply.SHELLS],
    ["artillery:bombardment", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["artillery:reposition", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["artillery:fortify", { [Supply.FUEL]: 0 }, Supply.FUEL],
    ["artillery:firefight", { [Supply.SHELLS]: 0 }, Supply.SHELLS],
  ] as const)("refuses %s without enough (%o): %s", (id, amounts, why) => {
    expect(refusal(id, suppliesWith(action(id).unitType, amounts))).toBe(why);
  });

  it("lets armour with no shells take an action that moves: it moves and doesn't fire; infantry has Move Out", () => {
    const dry = suppliesWith(UnitType.TANK, { [Supply.SHELLS]: 0 });
    expect(refusal("tank:assault", dry)).toBeNull();
    expect(refusal("tank:armorForward", dry)).toBeNull();
    expect(refusal("tank:firefight", dry)).toBe(Supply.SHELLS);
    expect(refusal("infantry:assault", suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 0 }))).toBe(Supply.AMMO);
  });

  it.each([
    ["infantry:medic", Equipment.MEDIC_KIT],
    ["infantry:camouflage", Equipment.CAMOUFLAGE_NET],
    ["infantry:fortify", Equipment.SANDBAGS],
  ] as const)("refuses %s without its %s", (id, kind) => {
    expect(refusal(id, suppliesWith(UnitType.INFANTRY, {}, { [kind]: 0 }))).toBe("equipment");
  });

  it("lets actions that don't fire go without ammo or shells, and free ones without energy or fuel", () => {
    expect(refusal("infantry:motorized", suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 0 }))).toBeNull();
    expect(refusal("infantry:reload", suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 0, [Supply.ENERGY]: 0 }))).toBeNull();
    expect(refusal("tank:reload", suppliesWith(UnitType.TANK, { [Supply.SHELLS]: 0, [Supply.FUEL]: 0 }))).toBeNull();
    expect(refusal("tank:mechanic", suppliesWith(UnitType.TANK, { [Supply.FUEL]: 0 }))).toBeNull();
    expect(refusal("tank:firefight", suppliesWith(UnitType.TANK, { [Supply.FUEL]: 0 }))).toBeNull();
  });
});

describe("how far an action moves", () => {
  it.each([
    ["infantry:firefight", { maxMove: 0, moveAndFire: 0, holdShots: 1 }],
    ["infantry:assault", { maxMove: 2, moveAndFire: 2, holdShots: 1 }],
    ["infantry:moveOut", { maxMove: 2, moveAndFire: 1, holdShots: 1 }],
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
  it("tries Firefight, Move Out, Assault and Motorized for infantry; Firefight and Assault for tanks; Firefight and Reposition for artillery", () => {
    const ids = (unitType: UnitType) => plainActionsFor(unitType).map((each) => each.id);
    expect(ids(UnitType.INFANTRY)).toEqual(["infantry:firefight", "infantry:moveOut", "infantry:assault", "infantry:motorized"]);
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

describe("how a unit fires a shot", () => {
  it("fires plainly by default, and a collision spends that", () => {
    expect(plainFireOption(UnitType.INFANTRY).id).toBe("infantry:normal");
    expect(plainFireOption(UnitType.TANK).id).toBe("tank:normal");
    expect(plainFireOption(UnitType.ARTILLERY).id).toBe("artillery:fire");
  });

  it("refuses an option the unit can't pay for: the ammo or shell, or the explosives", () => {
    const explosives = fireOptionById("infantry:explosives")!;
    expect(fireOptionRefusal(explosives, fullSupplies(UnitType.INFANTRY))).toBeNull();
    expect(fireOptionRefusal(explosives, suppliesWith(UnitType.INFANTRY, { [Supply.AMMO]: 0 }))).toBe(Supply.AMMO);
    expect(fireOptionRefusal(explosives, suppliesWith(UnitType.INFANTRY, {}, { [Equipment.EXPLOSIVES]: 0 }))).toBe("equipment");
    expect(fireOptionRefusal(fireOptionById("tank:normal")!, suppliesWith(UnitType.TANK, { [Supply.SHELLS]: 0 }))).toBe(Supply.SHELLS);
  });

  it("knows whether the unit has anything left to fire", () => {
    expect(canFireAShot(UnitType.ARTILLERY, fullSupplies(UnitType.ARTILLERY))).toBe(true);
    expect(canFireAShot(UnitType.ARTILLERY, suppliesWith(UnitType.ARTILLERY, { [Supply.SHELLS]: 0 }))).toBe(false);
  });
});
