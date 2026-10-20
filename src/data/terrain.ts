// data/terrain.ts
// What each terrain does, in one place: how units move through it, whether a
// unit that moves onto it can still fire, and whether it hides a target from
// sight. The dice a target on it is fired at with are in fireQuestions.ts
// (TARGET_TERRAIN_MODIFIERS).
//
// To add a terrain: a HexType, its rules here, its name in the labels and its
// dice in fireQuestions.ts (the compiler asks for each), and its art in
// scripts/compose-board.mjs.
import { HexType, MovementRule } from "../types/hex";

export interface TerrainRules {
  /** NORMAL: units move on through it; STOP: a unit that enters it ends its move; BLOCK: no unit can enter it or stand on it */
  movement: MovementRule;
  /** A unit that moves onto it can still fire this turn */
  fireAfterMove: boolean;
  /** Blocks line of sight when it lies between a unit and its target (the ends never block) */
  blocksSight: boolean;
  /** Only entered as the first hex of a move, from the hex the move starts on (official hedgerow rule) */
  firstStepOnly?: boolean;
  /** A unit whose move starts on it moves 1 hex (official hedgerow rule) */
  leaveOneHex?: boolean;
  /** A target on it is fired at as if it were on this terrain instead */
  firesAs?: HexType;
  /** A move that starts on it or enters it is at most this many hexes long, whatever cards add (house beach rule) */
  moveThrough?: number;
  /** A unit on it can't fire, whether it moved or not (house ocean rule) */
  noFire?: boolean;
  /** A unit on it can't retreat: each hex it should retreat is a hit instead (house ocean rule) */
  noRetreat?: boolean;
}

export const TERRAIN: Record<HexType, TerrainRules> = {
  [HexType.PLAINS]: { movement: MovementRule.NORMAL, fireAfterMove: true, blocksSight: false },
  [HexType.FOREST]: { movement: MovementRule.STOP, fireAfterMove: false, blocksSight: true },
  [HexType.HILL]: { movement: MovementRule.NORMAL, fireAfterMove: true, blocksSight: true },
  [HexType.TOWN]: { movement: MovementRule.STOP, fireAfterMove: false, blocksSight: true },
  [HexType.HEDGEROW]: {
    movement: MovementRule.STOP,
    fireAfterMove: false,
    blocksSight: true,
    firstStepOnly: true,
    leaveOneHex: true,
  },
  // Water: no unit can enter it or stand on it, and it doesn't block sight
  [HexType.RIVER]: { movement: MovementRule.BLOCK, fireAfterMove: false, blocksSight: false },
  [HexType.LAKE]: { movement: MovementRule.BLOCK, fireAfterMove: false, blocksSight: false },
  // Plays like plains (house rule)
  [HexType.BRIDGE]: { movement: MovementRule.NORMAL, fireAfterMove: true, blocksSight: false, firesAs: HexType.PLAINS },
  // House rules: slow going in the sand; a swamp holds a unit, and lets it out one hex at a time.
  // Both are fired at as open ground
  [HexType.BEACH]: { movement: MovementRule.NORMAL, fireAfterMove: true, blocksSight: false, firesAs: HexType.PLAINS, moveThrough: 2 },
  [HexType.SWAMP]: { movement: MovementRule.STOP, fireAfterMove: true, blocksSight: false, leaveOneHex: true, firesAs: HexType.PLAINS },
  // House rule: a unit in the sea wades in and out a hex at a time, can't fire, and can't fall back
  [HexType.OCEAN]: {
    movement: MovementRule.NORMAL,
    fireAfterMove: false,
    blocksSight: false,
    firesAs: HexType.PLAINS,
    moveThrough: 1,
    noFire: true,
    noRetreat: true,
  },
};
