import { createContext } from "react";
import type { ArmyView } from "../game-core/passAndPlay";
import type { UnitStrength } from "../game-core/gameSession";
import type { Faction } from "../types/faction";

/** Pass and play: what every map of the game screen draws besides this side's own units */
export interface SharedBoard {
  /** The other army: its units, and its orders once revealed */
  opponent: ArmyView;
  /** This side's units' figures and retreats */
  strength: readonly UnitStrength[];
}

/** Null in the one-side game, where the other army is only on the table */
export const OpponentContext = createContext<SharedBoard | null>(null);

/**
 * Pass and play: the side every map is seen from (the match's main side), so the board doesn't
 * turn round each time the device changes hands. Null in the one-side game: a side sees its own
 */
export const ViewSideContext = createContext<Faction | null>(null);
