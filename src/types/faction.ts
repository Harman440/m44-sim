// types/faction.ts

/** The side a device plays; stored in saves as this exact string */
export type Faction = "Allies" | "Axis";

export const FACTIONS: readonly Faction[] = ["Allies", "Axis"];

export const isFaction = (value: unknown): value is Faction =>
  FACTIONS.includes(value as Faction);

/** What the menu starts a game with */
export interface GameSetup {
  scenarioId: string;
  faction: Faction;
  /** Shots at range roll the 8-sided long-range die (both players should agree) */
  longRangeDie: boolean;
  /** Test mode: every combat card in hand, to try them all */
  testMode?: boolean;
}
