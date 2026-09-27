// game-core/dice.ts

export enum DieFace {
  INFANTRY = "infantry",
  TANK = "tank",
  GRENADE = "grenade",
  STAR = "star",
  FLAG = "flag",
  /** Only on the 8-sided long-range die */
  MISS = "miss",
}

/** The faces of the normal 6-sided die (the 8-sided die adds MISS) */
export type SixSidedFace = Exclude<DieFace, DieFace.MISS>;
export const SIX_SIDED_FACES: readonly SixSidedFace[] = [
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.STAR,
  DieFace.FLAG,
];

/** The six sides of a Memoir '44 battle die */
export const DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.STAR,
  DieFace.FLAG,
];

/**
 * The eight sides of the house long-range die (an experiment, switched on per
 * game): fewer hits than the normal die at range, and a blank side
 */
export const LONG_RANGE_DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.STAR,
  DieFace.FLAG,
  DieFace.MISS,
];

/** Roll `count` dice with these sides (the normal battle die by default); `random` returns [0, 1) like Math.random */
export function rollDice(
  count: number,
  random: () => number = Math.random,
  sides: readonly DieFace[] = DIE_SIDES
): DieFace[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => sides[Math.floor(random() * sides.length)]!);
}

/** How many of each face a roll shows */
export function countFaces(faces: readonly DieFace[]): Record<DieFace, number> {
  const counts = Object.fromEntries(Object.values(DieFace).map((face) => [face, 0])) as Record<
    DieFace,
    number
  >;
  faces.forEach((face) => counts[face]++);
  return counts;
}
