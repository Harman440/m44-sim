// game-core/dice.ts

export enum DieFace {
  INFANTRY = "infantry",
  TANK = "tank",
  GRENADE = "grenade",
  SUPPLY = "supply",
  FLAG = "flag",
}

/** The faces of the normal battle die, which also name the Reinforcements table */
export type SixSidedFace = DieFace;
export const SIX_SIDED_FACES: readonly SixSidedFace[] = [
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.SUPPLY,
  DieFace.FLAG,
];

/** The six sides of a Memoir '44 battle die */
export const DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.SUPPLY,
  DieFace.FLAG,
];

/**
 * The eight sides of the house long-range die (switched on per game, rolled
 * at targets that aren't adjacent): no grenade, so infantry is hit 3/8 and
 * any other unit 2/8, and two supplies
 */
export const LONG_RANGE_DIE_SIDES: readonly DieFace[] = [
  DieFace.TANK,
  DieFace.TANK,
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.FLAG,
  DieFace.SUPPLY,
  DieFace.SUPPLY,
];

/**
 * The die of the attack combat cards (Barrage, Air Power, Air Bombardment):
 * the battle die with a second grenade for the supply, since the supply hit
 * on these cards. Infantry is hit 4/6, any other unit 3/6.
 */
export const ATTACK_DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.GRENADE,
  DieFace.FLAG,
];

/** Which die a roll uses */
export type DieKind = "battle" | "longRange" | "attack";
export const DIE_KINDS: readonly DieKind[] = ["battle", "longRange", "attack"];

export const SIDES_OF: Record<DieKind, readonly DieFace[]> = {
  battle: DIE_SIDES,
  longRange: LONG_RANGE_DIE_SIDES,
  attack: ATTACK_DIE_SIDES,
};

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
