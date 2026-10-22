// game-core/dice.ts

export enum DieFace {
  INFANTRY = "infantry",
  TANK = "tank",
  GRENADE = "grenade",
  SUPPLY = "supply",
  FLAG = "flag",
}

/** The faces of the normal battle die */
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

/** The battle die with Suppressive Fire: 1 infantry, 1 grenade, 3 flags and 1 supply */
export const SUPPRESSIVE_DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.GRENADE,
  DieFace.FLAG,
  DieFace.FLAG,
  DieFace.FLAG,
  DieFace.SUPPLY,
];

/** The long-range die with Suppressive Fire: 2 infantry, 4 flags and 2 supplies */
export const LONG_RANGE_SUPPRESSIVE_DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.FLAG,
  DieFace.FLAG,
  DieFace.FLAG,
  DieFace.FLAG,
  DieFace.SUPPLY,
  DieFace.SUPPLY,
];

/** Which die a roll uses */
export type DieKind = "battle" | "longRange" | "attack" | "suppressive" | "longRangeSuppressive";
export const DIE_KINDS: readonly DieKind[] = ["battle", "longRange", "attack", "suppressive", "longRangeSuppressive"];

export const SIDES_OF: Record<DieKind, readonly DieFace[]> = {
  battle: DIE_SIDES,
  longRange: LONG_RANGE_DIE_SIDES,
  attack: ATTACK_DIE_SIDES,
  suppressive: SUPPRESSIVE_DIE_SIDES,
  longRangeSuppressive: LONG_RANGE_SUPPRESSIVE_DIE_SIDES,
};

/** The 8-sided dice (an octahedron in 3D) */
export const isEightSided = (die: DieKind): boolean => SIDES_OF[die].length === 8;

/** The die a shot rolls with Suppressive Fire on: the suppressive die of the same shape */
export const suppressed = (die: DieKind): DieKind =>
  die === "battle" ? "suppressive" : die === "longRange" ? "longRangeSuppressive" : die;

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
