// game-core/luck.ts
// The luck meter: each unit's luck nudges its dice toward hits (or misses), and moves on its
// streak. Pure functions over the numbers in data/luck.ts; GameSession keeps each unit's luck.
import type { DieFace } from "./dice";
import { LUCK_LIMIT, LUCK_PER_POINT } from "../data/luck";

/** Whether a face hits the target fired at (its symbol or a grenade: data/hitRules.ts `faceHits`) */
export type IsHit = (face: DieFace) => boolean;

/** The die's chance of a hit face on the target: the share of its sides that hit */
export const hitChance = (sides: readonly DieFace[], isHit: IsHit): number =>
  sides.length === 0 ? 0 : sides.filter(isHit).length / sides.length;

const clampLuck = (luck: number): number => Math.max(-LUCK_LIMIT, Math.min(LUCK_LIMIT, luck));

/** The chance of a hit face with this luck: each point moves it by `LUCK_PER_POINT`, never past 0 or 1 */
export const luckyChance = (chance: number, luck: number): number =>
  Math.max(0, Math.min(1, chance + clampLuck(luck) * LUCK_PER_POINT));

/**
 * The face a die shows with luck, from the die's one draw `r` in [0, 1): the draw picks a side as
 * without luck, and where it falls within that side decides whether luck turns it, so no extra
 * draw is needed. Good luck turns some misses into one of the die's hit faces, bad luck some hits
 * into one of its misses, so the die keeps its own faces and each kind its share
 */
export function luckyFace(sides: readonly DieFace[], isHit: IsHit, luck: number, r: number): DieFace {
  const scaled = r * sides.length;
  const face = sides[Math.min(sides.length - 1, Math.floor(scaled))]!;
  // Where the draw falls within its side: as uniform as the draw itself
  const within = scaled - Math.floor(scaled);
  const chance = hitChance(sides, isHit);
  const lucky = luckyChance(chance, luck);
  const hit = isHit(face);
  // How likely the face is turned: so that chance + (1 − chance) · turn = lucky, or chance · (1 − turn) = lucky
  const turn = lucky > chance && !hit ? (lucky - chance) / (1 - chance) : lucky < chance && hit ? (chance - lucky) / chance : 0;
  const into = sides.filter((side) => isHit(side) !== hit);
  if (turn === 0 || into.length === 0 || within < 1 - turn) return face;
  // The top `turn` of the side is turned; the rest of the draw picks what it turns into
  const rest = (within - (1 - turn)) / turn;
  return into[Math.min(into.length - 1, Math.floor(rest * into.length))]!;
}

/**
 * The meter after a die: down by (1 − p) on a hit, up by p on a miss, where p is the die's own
 * chance of a hit. Without luck it doesn't drift, however hard the target is to hit; with luck it
 * drifts back toward 0. Never past the limits
 */
export const nextLuck = (luck: number, hit: boolean, chance: number): number =>
  clampLuck(hit ? luck - (1 - chance) : luck + chance);

/** Roll `count` dice with luck: each die nudged by the luck it has then, which moves after it */
export function rollWithLuck(
  count: number,
  sides: readonly DieFace[],
  isHit: IsHit,
  luck: number,
  random: () => number
): { faces: DieFace[]; luck: number } {
  const chance = hitChance(sides, isHit);
  const faces: DieFace[] = [];
  let now = luck;
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    const face = luckyFace(sides, isHit, now, random());
    faces.push(face);
    now = nextLuck(now, isHit(face), chance);
  }
  return { faces, luck: now };
}
