import { createContext } from "react";
import type { Objective, Position } from "../types/scenario";
import type { Faction } from "../types/faction";
import type { Medals } from "../game-core/victory";

/** Pass and play with a scenario's victory conditions: the medals and the objective hexes */
export interface VictoryInfo {
  /** Medals to win */
  medals: number;
  standing: Medals;
  objectives: readonly Objective[];
  /** The objective hexes each side held at the end of the last turn (Allies' view) */
  held: Record<Faction, readonly Position[]>;
}

/** Null outside a match, or for a scenario without victory conditions */
export const VictoryContext = createContext<VictoryInfo | null>(null);
