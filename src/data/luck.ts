// data/luck.ts
// The luck meter (house rules): how far each unit's luck goes and what each point does to its
// dice. game-core/luck.ts rolls with it.

/** Luck goes from −LUCK_LIMIT to +LUCK_LIMIT, and starts at 0 */
export const LUCK_LIMIT = 3;

/** What each point of luck adds to (or takes from) a die's chance of a hit face */
export const LUCK_PER_POINT = 0.05;
