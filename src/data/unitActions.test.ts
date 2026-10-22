import { describe, expect, it } from "vitest";
import { ARTILLERY_ACTIONS, FIRE_OPTIONS, INFANTRY_ACTIONS, TANK_ACTIONS, UNIT_ACTIONS, actionById, fireOptionById } from "./unitActions";
import { Equipment, Supply } from "./unitSupplies";
import { UnitType } from "../game-core/unit";
import type { SupplyCost } from "../game-core/unitSupplies";
import type { UnitAction } from "../game-core/unitAction";

const ACTIONS = Object.values(UNIT_ACTIONS).flat();
/** The card paintings, by file name without `.webp` (as `CardArt` finds them) */
const PAINTINGS = new Set(
  Object.keys(import.meta.glob("../assets/cards/*.webp")).map((path) => path.slice(path.lastIndexOf("/") + 1, -".webp".length))
);
const OPTIONS = Object.values(FIRE_OPTIONS).flat();

/** A cost as "2 energy + sandbags", to compare with the house rules' list */
const costText = (cost: SupplyCost): string =>
  [
    ...Object.entries(cost.amounts ?? {}).map(([supply, amount]) => `${amount} ${supply}`),
    ...(cost.equipment ?? []),
  ].join(" + ") || "free";

const summary = (actions: readonly UnitAction[]) =>
  Object.fromEntries(
    actions.map((each) => [each.id.split(":")[1], `${costText(each.cost)}, move ${each.move}, ${each.fire ? `${each.fire.shots} shot` : "no fire"}`])
  );

describe("unit actions", () => {
  it("has unique ids, each named after its unit type", () => {
    expect(new Set(ACTIONS.map((each) => each.id)).size).toBe(ACTIONS.length);
    for (const each of ACTIONS) expect(each.id.startsWith(`${each.unitType}:`)).toBe(true);
    expect(actionById("tank:mechanic")?.effect).toBe("mechanic");
    expect(actionById("nope")).toBeUndefined();
  });

  it("names and describes every action and fire option in both languages", () => {
    for (const each of [...ACTIONS, ...OPTIONS]) {
      expect(each.name.es && each.name.en, each.id).toBeTruthy();
      expect(each.description.es && each.description.en, each.id).toBeTruthy();
    }
  });

  it("shows a card painting that exists", () => {
    for (const each of [...ACTIONS, ...OPTIONS]) {
      expect(PAINTINGS.has(each.painting), each.id).toBe(true);
    }
  });

  it("costs and moves infantry as the house rules say", () => {
    expect(summary(INFANTRY_ACTIONS)).toEqual({
      firefight: "1 energy, move 0, 1 shot",
      assault: "1 energy, move 1, 1 shot",
      noRespite: "2 energy, move 1, 1 shot",
      closeAssault: "1 energy, move 0, 1 shot",
      moveOut: "1 energy, move 2, no fire",
      medic: "medicKit, move 0, no fire",
      behindEnemyLines: "4 energy, move 3, 1 shot",
      motorized: "2 energy, move 3, no fire",
      moraleUp: "1 energy, move 0, no fire",
      camouflage: "2 energy + camouflageNet, move 0, no fire",
      fortify: "2 energy + sandbags, move 0, no fire",
      takeCover: "1 energy, move 1, no fire",
      reload: "free, move 0, no fire",
    });
  });

  it("costs and moves armour and artillery as the house rules say", () => {
    expect(summary(TANK_ACTIONS)).toEqual({
      firefight: "free, move 0, 1 shot",
      assault: "1 fuel, move 3, 1 shot",
      armorForward: "2 fuel, move 3, 1 shot",
      mechanic: "free, move 0, no fire",
      reload: "free, move 0, no fire",
    });
    expect(summary(ARTILLERY_ACTIONS)).toEqual({
      firefight: "free, move 0, 1 shot",
      bombardment: "1 fuel, move 0, 2 shot",
      reposition: "1 fuel, move 2, no fire",
      fortify: "1 fuel, move 0, no fire",
      reload: "free, move 0, no fire",
    });
  });

  it("fires No Respite with the units that didn't move, Behind Enemy Lines first, and Close Assault only in close assault with 1 extra die", () => {
    expect(actionById("infantry:noRespite")?.fire?.round).toBe("unmoved");
    expect(actionById("infantry:behindEnemyLines")).toMatchObject({ ignoresTerrain: true, moveAfterBattle: 3, fire: { round: "first" } });
    expect(actionById("infantry:closeAssault")?.fire).toEqual({ shots: 1, closeAssaultOnly: true, bonusDice: 1 });
    expect(actionById("tank:armorForward")?.ignoresTerrain).toBe(true);
  });

  it("offers every action on own tablets but Morale Up, as they don't track morale", () => {
    expect(ACTIONS.filter((each) => !each.ownTablets).map((each) => each.id)).toEqual(["infantry:moraleUp"]);
  });
});

describe("fire options", () => {
  it("spend 1 ammo for infantry and 1 shell for armour and artillery", () => {
    for (const each of FIRE_OPTIONS[UnitType.INFANTRY]) expect(each.cost.amounts).toEqual({ [Supply.AMMO]: 1 });
    for (const each of [...FIRE_OPTIONS[UnitType.TANK], ...FIRE_OPTIONS[UnitType.ARTILLERY]]) {
      expect(each.cost.amounts).toEqual({ [Supply.SHELLS]: 1 });
    }
  });

  it("give Explosives 1 extra die in close assault only, using up the explosives", () => {
    expect(fireOptionById("infantry:explosives")).toMatchObject({
      closeAssaultOnly: true,
      closeAssaultBonus: { dice: 1 },
      cost: { equipment: [Equipment.EXPLOSIVES] },
    });
  });

  it("give armour's normal fire 1 extra die in close assault if it didn't move, and suppressive fire to infantry and armour only", () => {
    expect(fireOptionById("tank:normal")?.closeAssaultBonus).toEqual({ dice: 1, unmoved: true });
    expect(OPTIONS.filter((each) => each.die === "suppressive").map((each) => each.unitType)).toEqual([UnitType.INFANTRY, UnitType.TANK]);
  });
});
