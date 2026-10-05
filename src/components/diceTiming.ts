// How long thrown dice take to land, shared by the 2D and the 3D dice

/** Seconds one die takes from the throw to resting on its face */
export const ROLL_TIME = 0.75;
/** Seconds between one die and the next being thrown */
export const DIE_STAGGER = 0.12;

/** How long the dice take to land, in seconds, so what they mean can show after */
export const rollDuration = (dice: number): number => ROLL_TIME + Math.max(0, dice - 1) * DIE_STAGGER;
