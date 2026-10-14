import { createContext } from "react";
import type { ArmyView } from "../game-core/passAndPlay";

/**
 * Pass and play: the other army, for every map of the game screen to draw (its units, and its
 * orders once revealed). Null in the one-side game, where the other army is only on the table
 */
export const OpponentContext = createContext<ArmyView | null>(null);
