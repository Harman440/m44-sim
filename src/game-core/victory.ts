// game-core/victory.ts
// Winning a scenario (pass and play, where the app knows both armies): each
// enemy unit destroyed is a medal, and each objective hex a medal for its side
// while one of its units stands on it at the end of a turn. At the end of each
// turn, a side that has reached the scenario's medals wins, the one with more
// when both have; with as many each, the game goes on. A side with no units
// left loses.
import { Objective, Position, Victory } from "../types/scenario";
import { Faction, FACTIONS } from "../types/faction";
import { includesPosition } from "./position";
import { UnitType } from "./unit";

/** A side's medals: for the enemy units it destroyed and the objective hexes it holds */
export interface SideMedals {
  destroyed: number;
  objectives: number;
  total: number;
}

export type Medals = Record<Faction, SideMedals>;

/** The end of a match */
export interface MatchResult {
  winner: Faction;
  /** The turn it was won at the end of */
  turn: number;
  medals: Medals;
  /** The loser had no units left */
  wipedOut: boolean;
  /** Each side's units destroyed, by type */
  lost: Record<Faction, UnitType[]>;
}

const otherSide = (faction: Faction): Faction => (faction === "Axis" ? "Allies" : "Axis");

/** The objective hexes each side holds: its own objectives' hexes with one of its units on them (Allies' view) */
export function heldObjectives(
  objectives: readonly Objective[],
  units: Record<Faction, readonly Position[]>
): Record<Faction, Position[]> {
  const held = (side: Faction) =>
    objectives
      .filter((objective) => objective.faction === side)
      .flatMap((objective) => objective.hexes.filter((hex) => includesPosition(units[side], hex)));
  return { Allies: held("Allies"), Axis: held("Axis") };
}

/** Each side's medals, from the units each side lost and the objective hexes each holds */
export function countMedals(lost: Record<Faction, readonly UnitType[]>, held: Record<Faction, readonly Position[]>): Medals {
  const medals = (side: Faction): SideMedals => {
    const destroyed = lost[otherSide(side)].length;
    const objectives = held[side].length;
    return { destroyed, objectives, total: destroyed + objectives };
  };
  return { Allies: medals("Allies"), Axis: medals("Axis") };
}

/**
 * The winner at the end of a turn, if there is one: a side wiped out loses; otherwise a side that
 * has reached the medals wins, the one with more if both have. Null while the game goes on
 */
export function winnerOf(
  victory: Victory,
  medals: Medals,
  unitsLeft: Record<Faction, number>
): { winner: Faction; wipedOut: boolean } | null {
  const wiped = FACTIONS.filter((side) => unitsLeft[side] === 0);
  if (wiped.length === 1) return { winner: otherSide(wiped[0]!), wipedOut: true };
  const reached = FACTIONS.filter((side) => medals[side].total >= victory.medals);
  if (reached.length === 0) return null;
  const [allies, axis] = [medals.Allies.total, medals.Axis.total];
  if (allies === axis) return null;
  return { winner: allies > axis ? "Allies" : "Axis", wipedOut: false };
}
