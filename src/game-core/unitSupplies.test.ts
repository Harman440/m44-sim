import { describe, expect, it } from "vitest";
import { UnitType } from "./unit";
import { amountOf, canPay, endOfTurn, equipmentOf, fullSupplies, pay, refill, reload } from "./unitSupplies";
import { Equipment, Supply } from "../data/unitSupplies";

const infantry = fullSupplies(UnitType.INFANTRY);
const tank = fullSupplies(UnitType.TANK);

describe("unit supplies", () => {
  it("fills infantry with morale 5, energy 5, ammo 2 and one of each piece of equipment", () => {
    expect(infantry.amounts).toEqual({ morale: 5, energy: 5, ammo: 2 });
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
      amounts: { [Supply.MORALE]: 5, [Supply.AMMO]: 2, [Supply.ENERGY]: 3 },
      equipment: [Equipment.EXPLOSIVES],
    })!;
    const resupplied = refill(spent, infantry, [Supply.MORALE, Supply.AMMO], { equipment: true });
    expect(resupplied.amounts).toEqual({ morale: 5, energy: 2, ammo: 2 });
    expect(equipmentOf(resupplied, Equipment.EXPLOSIVES)).toBe(1);
    expect(equipmentOf(refill(spent, infantry, [Supply.AMMO]), Equipment.EXPLOSIVES)).toBe(0);
  });

  it("gets 1 energy back at the end of the turn, 2 when resting, never past full", () => {
    const tired = pay(infantry, { amounts: { [Supply.ENERGY]: 4 } })!;
    expect(amountOf(endOfTurn(tired, infantry, false), Supply.ENERGY)).toBe(2);
    expect(amountOf(endOfTurn(tired, infantry, true), Supply.ENERGY)).toBe(3);
    expect(amountOf(endOfTurn(infantry, infantry, true), Supply.ENERGY)).toBe(5);
    expect(endOfTurn(tank, tank, true)).toEqual(tank);
  });
});
