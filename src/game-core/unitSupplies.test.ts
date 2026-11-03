import { describe, expect, it } from "vitest";
import { UnitType } from "./unit";
import { amountOf, betterOf, canPay, emptySupplies, endOfTurn, equipmentOf, fullSupplies, pay, refill, refund, reload, startingSupplies } from "./unitSupplies";
import { Equipment, Supply } from "../data/unitSupplies";

const infantry = fullSupplies(UnitType.INFANTRY);
const tank = fullSupplies(UnitType.TANK);

describe("what a unit has run out of", () => {
  it("names the spendable supplies at 0, and never morale (a unit at 0 is shown as pinned)", () => {
    expect(emptySupplies(infantry)).toEqual([]);
    expect(emptySupplies({ ...infantry, amounts: { ...infantry.amounts, [Supply.AMMO]: 0 } })).toEqual([Supply.AMMO]);
    expect(emptySupplies({ ...infantry, amounts: { [Supply.MORALE]: 0, [Supply.ENERGY]: 0, [Supply.AMMO]: 0 } })).toEqual([
      Supply.AMMO,
      Supply.ENERGY,
    ]);
    // A supply its type doesn't use isn't "empty": infantry has no fuel
    expect(emptySupplies({ ...tank, amounts: { [Supply.FUEL]: 0, [Supply.SHELLS]: 1 } })).toEqual([Supply.FUEL]);
  });
});

describe("unit supplies", () => {
  it("fills infantry with morale 4, energy 5, ammo 2 and one of each piece of equipment", () => {
    expect(infantry.amounts).toEqual({ morale: 4, energy: 5, ammo: 2 });
    expect(infantry.equipment).toEqual({ explosives: 1, sandbags: 1, medicKit: 1, camouflageNet: 1 });
  });

  it("gives elite infantry morale 10, energy 10 and two of each piece of equipment", () => {
    const elite = fullSupplies(UnitType.INFANTRY, true);
    expect(elite.amounts).toEqual({ morale: 10, energy: 10, ammo: 2 });
    expect(equipmentOf(elite, Equipment.SANDBAGS)).toBe(2);
  });

  it("fills armour with fuel 5 (7 elite) and shells 2, artillery with fuel 1 and shells 2, and no equipment", () => {
    expect(tank.amounts).toEqual({ fuel: 5, shells: 2 });
    expect(fullSupplies(UnitType.TANK, true).amounts).toEqual({ fuel: 7, shells: 2 });
    expect(fullSupplies(UnitType.ARTILLERY).amounts).toEqual({ fuel: 1, shells: 2 });
    expect(tank.equipment).toEqual({});
  });

  it("starts the defending side with 1 ammo or shell less, and reloads it up to full", () => {
    expect(startingSupplies(UnitType.INFANTRY, false, true)).toEqual({ ...infantry, amounts: { morale: 4, energy: 5, ammo: 1 } });
    expect(startingSupplies(UnitType.TANK, true, true).amounts).toEqual({ fuel: 7, shells: 1 });
    expect(startingSupplies(UnitType.ARTILLERY, false, true).amounts).toEqual({ fuel: 1, shells: 1 });
    expect(startingSupplies(UnitType.TANK, false, false)).toEqual(tank);
    expect(amountOf(reload(startingSupplies(UnitType.TANK, false, true), tank), Supply.SHELLS)).toBe(2);
  });

  it("pays a cost in supplies and equipment, without changing what it was given", () => {
    const paid = pay(infantry, { amounts: { [Supply.ENERGY]: 2 }, equipment: [Equipment.SANDBAGS] });
    expect(paid && amountOf(paid, Supply.ENERGY)).toBe(3);
    expect(paid && equipmentOf(paid, Equipment.SANDBAGS)).toBe(0);
    expect(amountOf(infantry, Supply.ENERGY)).toBe(5);
  });

  it("refuses a cost the unit can't pay", () => {
    expect(pay(infantry, { amounts: { [Supply.ENERGY]: 6 } })).toBeNull();
    expect(canPay(tank, { amounts: { [Supply.AMMO]: 1 } })).toBe(false);
    const noSandbags = pay(infantry, { equipment: [Equipment.SANDBAGS] })!;
    expect(canPay(noSandbags, { equipment: [Equipment.SANDBAGS] })).toBe(false);
  });

  it("reloads 2 ammo or shells, never past full", () => {
    const empty = pay(infantry, { amounts: { [Supply.AMMO]: 2 } })!;
    expect(amountOf(reload(empty, infantry), Supply.AMMO)).toBe(2);
    const oneShell = pay(tank, { amounts: { [Supply.SHELLS]: 1 } })!;
    expect(reload(oneShell, tank).amounts).toEqual({ fuel: 5, shells: 2 });
  });

  it("refills the listed supplies and, if asked, the equipment", () => {
    const spent = pay(infantry, {
      amounts: { [Supply.MORALE]: 4, [Supply.AMMO]: 2, [Supply.ENERGY]: 3 },
      equipment: [Equipment.EXPLOSIVES],
    })!;
    const resupplied = refill(spent, infantry, [Supply.MORALE, Supply.AMMO], { equipment: true });
    expect(resupplied.amounts).toEqual({ morale: 4, energy: 2, ammo: 2 });
    expect(equipmentOf(resupplied, Equipment.EXPLOSIVES)).toBe(1);
    expect(equipmentOf(refill(spent, infantry, [Supply.AMMO]), Equipment.EXPLOSIVES)).toBe(0);
  });

  it("gets 1 energy back at the end of a turn it held, 2 when resting, none after moving, never past full", () => {
    const tired = pay(infantry, { amounts: { [Supply.ENERGY]: 4 } })!;
    expect(amountOf(endOfTurn(tired, infantry, "held"), Supply.ENERGY)).toBe(2);
    expect(amountOf(endOfTurn(tired, infantry, "rested"), Supply.ENERGY)).toBe(3);
    expect(amountOf(endOfTurn(tired, infantry, "moved"), Supply.ENERGY)).toBe(1);
    expect(amountOf(endOfTurn(infantry, infantry, "rested"), Supply.ENERGY)).toBe(5);
    expect(endOfTurn(tank, tank, "rested")).toEqual(tank);
  });

  it("gives back what a shot paid, amounts and equipment", () => {
    const cost = { amounts: { [Supply.AMMO]: 1 }, equipment: [Equipment.EXPLOSIVES] };
    const paid = pay(infantry, cost)!;
    expect(amountOf(paid, Supply.AMMO)).toBe(1);
    expect(refund(paid, cost)).toEqual(infantry);
  });
});

describe("Regroup's supplies", () => {
  it("keeps the higher of each supply and piece of equipment, never past full", () => {
    const tired = { amounts: { ...infantry.amounts, [Supply.ENERGY]: 1, [Supply.AMMO]: 2 }, equipment: { ...infantry.equipment, [Equipment.MEDIC_KIT]: 0 } };
    const other = { amounts: { ...infantry.amounts, [Supply.ENERGY]: 4, [Supply.AMMO]: 0 }, equipment: { ...infantry.equipment, [Equipment.SANDBAGS]: 0 } };
    const merged = betterOf(tired, other, infantry);
    expect(amountOf(merged, Supply.ENERGY)).toBe(4);
    expect(amountOf(merged, Supply.AMMO)).toBe(2);
    expect(equipmentOf(merged, Equipment.MEDIC_KIT)).toBe(1);
    expect(equipmentOf(merged, Equipment.SANDBAGS)).toBe(1);
    // An elite giver's extra doesn't go past a regular unit's full
    expect(betterOf(infantry, fullSupplies(UnitType.INFANTRY, true), infantry)).toEqual(infantry);
  });
});
