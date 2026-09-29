// game-core/rollResult.ts
import { DieFace } from "./dice";
import { ShotTarget, faceEarnsCoin, faceHits, faceRetreats } from "../data/hitRules";

/** What a roll means on the table */
export interface RollResult {
  hits: number;
  retreats: number;
  /** Coins earned from supply faces that didn't count as hits */
  coins: number;
  /** The faces that hit, in the order rolled */
  hitFaces: DieFace[];
}

/** Read a roll against its target, with the rules in data/hitRules.ts */
export function readRoll(faces: readonly DieFace[], target: ShotTarget): RollResult {
  const hitFaces = faces.filter((face) => faceHits(face, target));
  return {
    hits: hitFaces.length,
    retreats: faces.filter(faceRetreats).length,
    coins: faces.filter((face) => faceEarnsCoin(face, target)).length,
    hitFaces,
  };
}

/** The results a shot applies: the dice at the `kept` indexes, or all of them when null */
export function appliedFaces(faces: readonly DieFace[], kept: readonly number[] | null): DieFace[] {
  return kept === null ? [...faces] : faces.filter((_, i) => kept.includes(i));
}

/** `kept` names distinct dice of a roll of `dice` dice */
export function isKeptList(kept: unknown, dice: number): kept is number[] {
  return (
    Array.isArray(kept) &&
    kept.every((i) => Number.isInteger(i) && i >= 0 && i < dice) &&
    new Set(kept).size === kept.length
  );
}
