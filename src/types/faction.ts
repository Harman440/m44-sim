// types/faction.ts

/** The side a device plays; stored in saves as this exact string */
export type Faction = "Allies" | "Axis";

export const FACTIONS: readonly Faction[] = ["Allies", "Axis"];

export const isFaction = (value: unknown): value is Faction =>
  FACTIONS.includes(value as Faction);

/** What the menu starts a pass and play match with: both sides play on this device */
export type MatchSetup = Omit<GameSetup, "faction"> & {
  /** The side whose end of the table the device sits at: the map is always seen from it */
  mainSide: Faction;
  /** The computer plays the other side */
  computer?: boolean;
};

/** What the menu starts a game with */
export interface GameSetup {
  scenarioId: string;
  faction: Faction;
  /** Shots at range roll the 8-sided long-range die (both players should agree) */
  longRangeDie: boolean;
  /** Test mode: every combat card in hand, to try them all */
  testMode?: boolean;
  /** Experimental rule: a destroyed artillery unit leaves its crew as an infantry unit */
  artilleryCrew?: boolean;
  /** Fog of war in a match against the computer (game-core/fogOfWar.ts); on unless switched off */
  fogOfWar?: boolean;
}
