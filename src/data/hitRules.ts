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
}

/**
 * Whether a face is a hit on the target:
 * - the matching unit symbol hits (there is no artillery face)
 * - a grenade hits any unit
 * - a star hits artillery in close assault (house rule), and any unit for the attack combat cards
 */
export function faceHits(face: DieFace, { unitType, closeAssault, starsHit = false }: ShotTarget): boolean {
  switch (face) {
    case DieFace.INFANTRY:
      return unitType === UnitType.INFANTRY;
    case DieFace.TANK:
      return unitType === UnitType.TANK;
    case DieFace.GRENADE:
      return true;
    case DieFace.STAR:
      return starsHit || (closeAssault && unitType === UnitType.ARTILLERY);
    case DieFace.FLAG:
      return false;
  }
}

/** A flag makes the target retreat */
export const faceRetreats = (face: DieFace): boolean => face === DieFace.FLAG;

/** A star earns a coin, unless it counted as a hit */
export const faceEarnsCoin = (face: DieFace, target: ShotTarget): boolean =>
  face === DieFace.STAR && !faceHits(face, target);
