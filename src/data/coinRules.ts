// data/coinRules.ts
// What coins buy and earn, from the house rules. Change the numbers here;
// game-core/coins.ts adds up each turn. Supply faces earn coins as data/hitRules.ts says.
import { UnitType } from "../game-core/unit";

/**
 * An extra order for any unit, by its type, with none of the command card's benefits; as many
 * per turn as the player can pay
 */
export const EXTRA_ORDER_COST: Record<UnitType, number> = {
  [UnitType.INFANTRY]: 3,
  [UnitType.TANK]: 4,
  [UnitType.ARTILLERY]: 4,
};

/** Taken in the final phase instead of a combat card */
export const END_OF_TURN_COINS = 2;

/** Coins each side starts the game with */
export const STARTING_COINS = 0;

/** Test mode: the coins a side has at the start of every turn, at least, to play any card */
export const TEST_MODE_COINS = 99;
