// data/hitRules.ts
// What each die face means for the target, from the house rules. Change the
// rules here; game-core/rollResult.ts adds them up.
import { DieFace, DieKind } from "../game-core/dice";
import { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { Scenario } from "../types/scenario";
import { hasUnits } from "./commandCards";

/**
 * What the dice were rolled against. Only whether the target is infantry
 * matters: the tank face hits armour and artillery alike.
 */
export interface ShotTarget {
  infantry: boolean;
  /** The target is adjacent (or it was a collision) */
  closeAssault: boolean;
  /** The die rolled: the battle die, the 8-sided long-range die or the attack cards' die */
  die: DieKind;
}

/**
 * Whether a face is a hit on the target:
 * - the infantry face hits infantry, the tank face any other unit
 * - a grenade hits any unit
 * - a supply never hits (it earns a coin) and a flag makes the target retreat
 */
export function faceHits(face: DieFace, { infantry }: ShotTarget): boolean {
  switch (face) {
    case DieFace.INFANTRY:
      return infantry;
    case DieFace.TANK:
      return !infantry;
    case DieFace.GRENADE:
      return true;
    case DieFace.SUPPLY:
    case DieFace.FLAG:
      return false;
  }
}

/** A flag makes the target retreat */
export const faceRetreats = (face: DieFace): boolean => face === DieFace.FLAG;

/** A supply face earns a coin, unless it counted as a hit */
export const faceEarnsCoin = (face: DieFace, target: ShotTarget): boolean =>
  face === DieFace.SUPPLY && !faceHits(face, target);

/** What an enemy unit fired at can be: infantry, and any other unit (armour or artillery) */
export interface TargetKinds {
  infantry: boolean;
  other: boolean;
}

/**
 * What the enemy starts the scenario with (paratroopers included), so a shot
 * only asks whether its target is infantry when the enemy has both. The app
 * doesn't track the enemy's losses, and a unit the Reinforcements card brings
 * is rare enough to be picked by hand (the picker's "Cambiar").
 */
export function enemyTargetKinds(scenario: Scenario, faction: Faction): TargetKinds {
  const enemy: Faction = faction === "Axis" ? "Allies" : "Axis";
  const has = (type: UnitType) => hasUnits(scenario, enemy, type);
  const kinds = { infantry: has(UnitType.INFANTRY), other: has(UnitType.TANK) || has(UnitType.ARTILLERY) };
  // A scenario without enemy units shouldn't leave nothing to pick
  return kinds.infantry || kinds.other ? kinds : { infantry: true, other: true };
}

/** The only kind the target can be (true: infantry), or null when the player has to say */
export const onlyTargetKind = ({ infantry, other }: TargetKinds): boolean | null =>
  infantry && other ? null : infantry;
