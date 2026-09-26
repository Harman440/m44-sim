// game-core/dice.ts

export enum DieFace {
  INFANTRY = "infantry",
  TANK = "tank",
  GRENADE = "grenade",
  STAR = "star",
  FLAG = "flag",
}

/** The six sides of a Memoir '44 battle die */
export const DIE_SIDES: readonly DieFace[] = [
  DieFace.INFANTRY,
  DieFace.INFANTRY,
  DieFace.TANK,
  DieFace.GRENADE,
  DieFace.STAR,
  DieFace.FLAG,
];

/** Roll `count` battle dice; `random` returns [0, 1) like Math.random */
export function rollDice(count: number, random: () => number = Math.random): DieFace[] {
  return Array.from(
    { length: Math.max(0, Math.floor(count)) },
    () => DIE_SIDES[Math.floor(random() * DIE_SIDES.length)]!
  );
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
