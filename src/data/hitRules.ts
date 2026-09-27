// data/hitRules.ts
// What each die face means for the target, from the house rules. Change the
// rules here; game-core/rollResult.ts adds them up.
import { DieFace } from "../game-core/dice";
import { UnitType } from "../game-core/unit";

/** What the dice were rolled against */
export interface ShotTarget {
  unitType: UnitType;
  /** The target is adjacent (or it was a collision) */
  closeAssault: boolean;
  /** Stars hit too (Barrage, Air Power, Air Bombardment) */
  starsHit?: boolean;
  /** Rolled on the 8-sided long-range die by this type of unit (its grenade doesn't hit a tank fired on by infantry) */
  longRangeFirer?: UnitType;
}

/**
 * Whether a face is a hit on the target:
 * - a miss (long-range die) never hits
 * - the matching unit symbol hits (there is no artillery face)
 * - a grenade hits any unit, except a tank when infantry fires the long-range die
 * - a star hits artillery in close assault (house rule), and any unit for the attack combat cards
 */
export function faceHits(face: DieFace, { unitType, closeAssault, starsHit = false, longRangeFirer }: ShotTarget): boolean {
  switch (face) {
    case DieFace.INFANTRY:
      return unitType === UnitType.INFANTRY;
    case DieFace.TANK:
      return unitType === UnitType.TANK;
    case DieFace.GRENADE:
      return !(longRangeFirer === UnitType.INFANTRY && unitType === UnitType.TANK);
    case DieFace.STAR:
      return starsHit || (closeAssault && unitType === UnitType.ARTILLERY);
    case DieFace.FLAG:
    case DieFace.MISS:
      return false;
  }
}

/** A flag makes the target retreat */
export const faceRetreats = (face: DieFace): boolean => face === DieFace.FLAG;

/** A star earns a coin, unless it counted as a hit */
export const faceEarnsCoin = (face: DieFace, target: ShotTarget): boolean =>
  face === DieFace.STAR && !faceHits(face, target);
