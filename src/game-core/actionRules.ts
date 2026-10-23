// game-core/actionRules.ts
// The actions mode: which actions a unit can be given this turn, and how far each one moves it.
// Plain functions over the data in data/unitActions.ts and the unit's supplies
// (game-core/unitSupplies.ts); GameSession gives the orders.
import { UnitType } from "./unit";
import type { FireOption, UnitAction } from "./unitAction";
import { SupplyCost, UnitSupplies, amountOf, canPay, fullSupplies } from "./unitSupplies";
import type { MoveLimits } from "./orderRules";
import type { MoveRules } from "./BoardManager";
import { FIRE_OPTIONS, MOVES_WITHOUT_SHOTS, PLAIN_ACTIONS, UNIT_ACTIONS, actionById } from "../data/unitActions";
import { RELOAD, SUPPLIES, Supply } from "../data/unitSupplies";

/**
 * Why a unit can't be given an action: the supply it lacks (morale: it's at 0 and can only be
 * given Morale Up; ammo or shells: the action fires and it has none), a piece of equipment, an
 * action of another unit type, one own tablets don't offer, nothing for it to mend (Medic
 * with no figure lost, Mechanic with no figure hit), or nothing it would change (`notNeeded`:
 * Reload with its ammo or shells full, Morale Up at full morale, Fortify where there are sandbags,
 * Camouflage with the badge on)
 */
export type ActionRefusal = Supply | "equipment" | "unitType" | "ownTablets" | "nothingToMend" | "notNeeded";

/** What the unit is and has, for checking an action */
export interface ActionContext {
  unitType: UnitType;
  supplies: UnitSupplies;
  /** Own tablets: only the actions they offer (no morale, so no Morale Up) */
  ownTablets: boolean;
  /**
   * Pass and play, which tracks figures: whether the unit has lost a figure (Medic) and has one
   * hit but not lost (Mechanic). Left out on own tablets, where the table knows
   */
  wounds?: { lost: boolean; damaged: boolean };
  /** Elite: what full is (Reload, Morale Up) */
  elite?: boolean;
  /** Its hex has sandbags already (Fortify) */
  sandbags?: boolean;
  /** It has the camouflage badge already (Camouflage) */
  camouflaged?: boolean;
}

/** The action would change nothing: see `ActionRefusal`'s `notNeeded` */
function notNeeded(action: UnitAction, { unitType, supplies, elite = false, sandbags = false, camouflaged = false }: ActionContext): boolean {
  const full = fullSupplies(unitType, elite);
  const isFull = (supply: Supply) => full.amounts[supply] !== undefined && amountOf(supplies, supply) >= amountOf(full, supply);
  switch (action.effect) {
    case "reload":
      return (Object.keys(RELOAD) as Supply[]).every((supply) => full.amounts[supply] === undefined || isFull(supply));
    case "moraleUp":
      return isFull(Supply.MORALE);
    case "fortify":
      return sandbags;
    case "camouflage":
      return camouflaged;
    default:
      return false;
  }
}

/** The actions a unit of this type is offered, in their list order */
export const actionsFor = (unitType: UnitType, ownTablets: boolean): readonly UnitAction[] =>
  UNIT_ACTIONS[unitType].filter((action) => !ownTablets || action.ownTablets);

/** What the action costs: own tablets don't track morale, so they never pay any (Infantry Assault) */
export function actionCost(action: UnitAction, ownTablets: boolean): SupplyCost {
  if (!ownTablets || !action.cost.amounts?.[Supply.MORALE]) return action.cost;
  const { [Supply.MORALE]: _morale, ...amounts } = action.cost.amounts;
  return { ...action.cost, amounts };
}

/** Why the unit can't be given the action, or null when it can */
export function actionRefusal(action: UnitAction, context: ActionContext): ActionRefusal | null {
  const { unitType, supplies, ownTablets, wounds } = context;
  if (action.unitType !== unitType) return "unitType";
  if (ownTablets && !action.ownTablets) return "ownTablets";
  if (wounds && ((action.effect === "medic" && !wounds.lost) || (action.effect === "mechanic" && !wounds.damaged))) {
    return "nothingToMend";
  }
  if (notNeeded(action, context)) return "notNeeded";
  // At morale 0 the unit can only be given Morale Up (a type without morale never is)
  if (supplies.amounts[Supply.MORALE] === 0 && action.effect !== "moraleUp") return Supply.MORALE;
  const cost = actionCost(action, ownTablets);
  if (!canPay(supplies, cost)) {
    const short = SUPPLIES.find((supply) => amountOf(supplies, supply) < (cost.amounts?.[supply] ?? 0));
    return short ?? "equipment";
  }
  // An action that fires needs a shot's worth of ammo or shells, except armour's moves: with no
  // shells left they move and don't fire
  const movesDry = action.move > 0 && MOVES_WITHOUT_SHOTS.includes(unitType);
  if (action.fire && !movesDry) {
    const options = FIRE_OPTIONS[unitType];
    if (!options.some((option) => canPay(supplies, option.cost))) {
      const needs = options.flatMap((option) => SUPPLIES.filter((supply) => (option.cost.amounts?.[supply] ?? 0) > 0));
      return needs[0] ?? "equipment";
    }
  }
  return null;
}

/** How far the action moves the unit, how far it may move and still fire, and its shots when it holds */
export const moveLimitsOf = (action: UnitAction): MoveLimits => ({
  maxMove: action.move,
  moveAndFire: action.fire ? (action.fireMove ?? action.move) : 0,
  holdShots: action.fire?.shots ?? 0,
});

/** How the action's move goes over the terrain (Armour Forward, Behind Enemy Lines ignore its limits) */
export const moveRulesOf = (action: UnitAction): MoveRules => (action.ignoresTerrain ? { ignoreTerrain: true } : {});

/** The shots the order gives the unit once it ends its move: none for an action that doesn't fire */
export const shotsOf = (action: UnitAction): number => action.fire?.shots ?? 0;

/** Why the unit can't fire a shot this way: the supply it lacks, or a piece of equipment; null when it can */
export function fireOptionRefusal(option: FireOption, supplies: UnitSupplies): Supply | "equipment" | null {
  if (canPay(supplies, option.cost)) return null;
  return SUPPLIES.find((supply) => amountOf(supplies, supply) < (option.cost.amounts?.[supply] ?? 0)) ?? "equipment";
}

/** The fire options of a unit type, the plain one first (the default, and what a collision spends) */
export const fireOptionsFor = (unitType: UnitType): readonly FireOption[] => FIRE_OPTIONS[unitType];

/** The unit's plain fire option: a shot with nothing chosen, and what a collision spends */
export const plainFireOption = (unitType: UnitType): FireOption => FIRE_OPTIONS[unitType][0]!;

/** The unit has the ammo or shells for at least one shot */
export const canFireAShot = (unitType: UnitType, supplies: UnitSupplies): boolean =>
  FIRE_OPTIONS[unitType].some((option) => canPay(supplies, option.cost));

/** The actions a plain move turns into for this unit type, in the order they're tried */
export const plainActionsFor = (unitType: UnitType): UnitAction[] =>
  PLAIN_ACTIONS[unitType].flatMap((id) => actionById(id) ?? []);

/**
 * The plain action for a move: the first one that reaches the hex and can fire from it, or else
 * the first that reaches it. `options` are the unit's allowed plain actions, in order
 */
export function plainActionForMove<T extends { reaches: boolean; fires: boolean }>(options: readonly T[]): T | null {
  return options.find((option) => option.reaches && option.fires) ?? options.find((option) => option.reaches) ?? null;
}
