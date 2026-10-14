import { createContext } from "react";
import type { ArmyView } from "../game-core/passAndPlay";
import type { UnitStrength } from "../game-core/gameSession";

/** Pass and play: what every map of the game screen draws besides this side's own units */
export interface SharedBoard {
  /** The other army: its units, and its orders once revealed */
  opponent: ArmyView;
  /** This side's units' figures and retreats */
  strength: readonly UnitStrength[];
}

/** Null in the one-side game, where the other army is only on the table */
export const OpponentContext = createContext<SharedBoard | null>(null);
