// data/unitSupplies.ts
// The actions mode's unit supplies (house rules): what each unit carries when full, what a
// reload brings back and the energy recovered each turn. Change the numbers here;
// game-core/unitSupplies.ts spends and refills them.
import { UnitType } from "../game-core/unit";

/** What a unit spends on its actions and its shots, and gets back */
export enum Supply {
  /** Infantry: one less for each flag rolled on it; at 0 it can only be given Morale Up */
  MORALE = "morale",
  /** Infantry: spent on actions, a little back at the end of a turn it didn't move in */
  ENERGY = "energy",
  /** Infantry: one per shot, back with Reload */
  AMMO = "ammo",
  /** Armour and artillery: spent on actions, only back with the Refuel card */
  FUEL = "fuel",
  /** Armour and artillery: one per shot, back with Reload */
  SHELLS = "shells",
}

/** The equipment infantry carries, each used up by one action or fire option and given back by Resupply */
export enum Equipment {
  /** The Explosives fire option */
  EXPLOSIVES = "explosives",
  /** The Fortify action */
  SANDBAGS = "sandbags",
  /** The Medic action */
  MEDIC_KIT = "medicKit",
  /** The Camouflage action */
  CAMOUFLAGE_NET = "camouflageNet",
}

export const SUPPLIES: readonly Supply[] = Object.values(Supply);
export const EQUIPMENT: readonly Equipment[] = Object.values(Equipment);

/** A unit's supplies when full: what it starts with and the most it can hold */
export const FULL_SUPPLIES: Record<UnitType, Partial<Record<Supply, number>>> = {
  [UnitType.INFANTRY]: { [Supply.MORALE]: 5, [Supply.ENERGY]: 5, [Supply.AMMO]: 2 },
  [UnitType.TANK]: { [Supply.FUEL]: 5, [Supply.SHELLS]: 2 },
  [UnitType.ARTILLERY]: { [Supply.FUEL]: 1, [Supply.SHELLS]: 2 },
};

/** An elite unit's supplies that differ from its type's */
export const ELITE_FULL_SUPPLIES: Partial<Record<UnitType, Partial<Record<Supply, number>>>> = {
  [UnitType.INFANTRY]: { [Supply.MORALE]: 10, [Supply.ENERGY]: 10 },
  [UnitType.TANK]: { [Supply.FUEL]: 7 },
};

/** How many of each piece of equipment a unit carries when full (only infantry has any) */
export const EQUIPMENT_CARRIED: Record<UnitType, { normal: number; elite: number }> = {
  [UnitType.INFANTRY]: { normal: 1, elite: 2 },
  [UnitType.TANK]: { normal: 0, elite: 0 },
  [UnitType.ARTILLERY]: { normal: 0, elite: 0 },
};

/**
 * What each unit of the scenario's defending side starts the game without (there's no extra turn
 * for the attacker), never below 0. It still reloads up to full
 */
export const DEFENDER_SHORTFALL: Partial<Record<Supply, number>> = { [Supply.AMMO]: 1, [Supply.SHELLS]: 1 };

/** What the Reload action brings back, never past full */
export const RELOAD: Partial<Record<Supply, number>> = { [Supply.AMMO]: 2, [Supply.SHELLS]: 2 };

/** Energy infantry gets back at the end of a turn it didn't move in, never past full (none after moving) */
export const ENERGY_PER_TURN = 1;

/** Energy infantry with no action this turn (resting) gets back instead */
export const RESTING_ENERGY_PER_TURN = 2;
