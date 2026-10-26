// game-core/unitSupplies.ts
// The actions mode's unit supplies as plain values: what a unit has when full, paying for an
// action, reloading, the cards that refill and the energy back at the end of the turn. Each
// function returns a new value and never changes the one it's given. The numbers are in
// data/unitSupplies.ts.
import { UnitType } from "./unit";
import {
  DEFENDER_SHORTFALL,
  ELITE_FULL_SUPPLIES,
  ENERGY_PER_TURN,
  EQUIPMENT,
  EQUIPMENT_CARRIED,
  Equipment,
  FULL_SUPPLIES,
  RELOAD,
  RESTING_ENERGY_PER_TURN,
  SUPPLIES,
  Supply,
} from "../data/unitSupplies";

/** What a unit has left. A supply its type doesn't use is missing, and counts as 0 */
export interface UnitSupplies {
  readonly amounts: Readonly<Partial<Record<Supply, number>>>;
  readonly equipment: Readonly<Partial<Record<Equipment, number>>>;
}

/** What an action or a shot costs */
export interface SupplyCost {
  readonly amounts?: Readonly<Partial<Record<Supply, number>>>;
  /** One of each of these pieces of equipment is used up */
  readonly equipment?: readonly Equipment[];
}

export const amountOf = (supplies: UnitSupplies, supply: Supply): number => supplies.amounts[supply] ?? 0;

/**
 * The supplies a unit spends and has run out of, for the mark on its token: no ammo or shells
 * means it can't fire, no fuel or energy that it can't be given most of its actions. Morale is
 * left out: a unit at 0 is shown as pinned and can only rally
 */
const MARKED_EMPTY: readonly Supply[] = [Supply.AMMO, Supply.SHELLS, Supply.FUEL, Supply.ENERGY];

export const emptySupplies = (supplies: UnitSupplies): Supply[] =>
  MARKED_EMPTY.filter((supply) => supplies.amounts[supply] === 0);

export const equipmentOf = (supplies: UnitSupplies, equipment: Equipment): number => supplies.equipment[equipment] ?? 0;

/** A unit's supplies when full: what it starts with and the most it can hold */
export function fullSupplies(unitType: UnitType, elite = false): UnitSupplies {
  const amounts = { ...FULL_SUPPLIES[unitType], ...(elite ? ELITE_FULL_SUPPLIES[unitType] : {}) };
  const carried = EQUIPMENT_CARRIED[unitType][elite ? "elite" : "normal"];
  const equipment: Partial<Record<Equipment, number>> = {};
  if (carried > 0) for (const kind of EQUIPMENT) equipment[kind] = carried;
  return { amounts, equipment };
}

/** What a unit starts the game with: full, less the defender's shortfall for the defending side */
export function startingSupplies(unitType: UnitType, elite: boolean, defending: boolean): UnitSupplies {
  const full = fullSupplies(unitType, elite);
  return defending ? withAmounts(full, full, (supply, current) => current - (DEFENDER_SHORTFALL[supply] ?? 0)) : full;
}

/** Each supply in `amounts` moved by `change(supply, current)`, kept between 0 and `full` */
function withAmounts(
  supplies: UnitSupplies,
  full: UnitSupplies,
  change: (supply: Supply, current: number) => number
): UnitSupplies {
  const amounts: Partial<Record<Supply, number>> = {};
  for (const supply of SUPPLIES) {
    if (supplies.amounts[supply] === undefined && full.amounts[supply] === undefined) continue;
    const max = full.amounts[supply] ?? 0;
    amounts[supply] = Math.max(0, Math.min(max, change(supply, amountOf(supplies, supply))));
  }
  return { amounts, equipment: supplies.equipment };
}

/** Whether the unit has everything the cost asks for */
export function canPay(supplies: UnitSupplies, cost: SupplyCost): boolean {
  const amountsOk = SUPPLIES.every((supply) => amountOf(supplies, supply) >= (cost.amounts?.[supply] ?? 0));
  return amountsOk && EQUIPMENT.every((kind) => equipmentOf(supplies, kind) >= countOf(cost.equipment, kind));
}

const countOf = (list: readonly Equipment[] | undefined, kind: Equipment): number =>
  list?.filter((each) => each === kind).length ?? 0;

/** The supplies left after paying the cost, or null when the unit can't pay it */
export function pay(supplies: UnitSupplies, cost: SupplyCost): UnitSupplies | null {
  if (!canPay(supplies, cost)) return null;
  const amounts = { ...supplies.amounts };
  for (const supply of SUPPLIES) {
    const spent = cost.amounts?.[supply] ?? 0;
    if (spent > 0) amounts[supply] = amountOf(supplies, supply) - spent;
  }
  const equipment = { ...supplies.equipment };
  for (const kind of cost.equipment ?? []) equipment[kind] = equipmentOf(supplies, kind) - 1;
  return { amounts, equipment };
}

/** What was paid given back (a shot taken back): never past what the unit had, since it came from there */
export function refund(supplies: UnitSupplies, cost: SupplyCost): UnitSupplies {
  const amounts = { ...supplies.amounts };
  for (const supply of SUPPLIES) {
    const spent = cost.amounts?.[supply] ?? 0;
    if (spent > 0) amounts[supply] = amountOf(supplies, supply) + spent;
  }
  const equipment = { ...supplies.equipment };
  for (const kind of cost.equipment ?? []) equipment[kind] = equipmentOf(supplies, kind) + 1;
  return { amounts, equipment };
}

/** The Reload action: ammo or shells back, never past full */
export const reload = (supplies: UnitSupplies, full: UnitSupplies): UnitSupplies =>
  withAmounts(supplies, full, (supply, current) => current + (RELOAD[supply] ?? 0));

/**
 * The cards that refill: the listed supplies back to full (Resupply: morale and ammo, a unit
 * at morale 0 too; Refuel: fuel), and with `equipment` every piece of equipment
 */
export function refill(
  supplies: UnitSupplies,
  full: UnitSupplies,
  refilled: readonly Supply[],
  { equipment = false }: { equipment?: boolean } = {}
): UnitSupplies {
  const topped = withAmounts(supplies, full, (supply, current) =>
    refilled.includes(supply) ? (full.amounts[supply] ?? 0) : current
  );
  return equipment ? { ...topped, equipment: { ...full.equipment } } : topped;
}

/**
 * Regroup: the unit that took the other's figures ends with the higher of the two of each supply
 * and each piece of equipment, never past its own full amount
 */
export function betterOf(supplies: UnitSupplies, other: UnitSupplies, full: UnitSupplies): UnitSupplies {
  const amounts = withAmounts(supplies, full, (supply, current) => Math.max(current, amountOf(other, supply))).amounts;
  const equipment: Partial<Record<Equipment, number>> = { ...supplies.equipment };
  for (const kind of Object.keys(full.equipment) as Equipment[]) {
    equipment[kind] = Math.min(equipmentOf(full, kind), Math.max(equipmentOf(supplies, kind), equipmentOf(other, kind)));
  }
  return { amounts, equipment };
}

/** How the unit spent the turn, which decides the energy it gets back */
export type TurnSpent = "rested" | "held" | "moved";

/** The energy back at the end of the turn: more for a unit that rested (had no action), none for one that moved */
export const energyBack = (spent: TurnSpent): number =>
  spent === "rested" ? RESTING_ENERGY_PER_TURN : spent === "held" ? ENERGY_PER_TURN : 0;

/** The end of the turn: energy back as `energyBack` says, never past full */
export const endOfTurn = (supplies: UnitSupplies, full: UnitSupplies, spent: TurnSpent): UnitSupplies =>
  withAmounts(supplies, full, (supply, current) => (supply === Supply.ENERGY ? current + energyBack(spent) : current));
