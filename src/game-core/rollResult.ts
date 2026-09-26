// game-core/rollResult.ts
import { DieFace } from "./dice";
import { ShotTarget, faceEarnsCoin, faceHits, faceRetreats } from "../data/hitRules";

/** What a roll means on the table */
export interface RollResult {
  hits: number;
  retreats: number;
  /** Coins earned from stars that didn't count as hits */
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
