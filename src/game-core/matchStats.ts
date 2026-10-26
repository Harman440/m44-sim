// game-core/matchStats.ts
// What a side did over a whole game, for the end of a pass and play match: the dice it rolled and
// what they showed, its shots and collisions, the attack cards and the cards played. Counted from
// the turn log and the turn still open (the match ends in the battle, before the turn is logged).
import { DieFace } from "./dice";
import type { GameSnapshot } from "./gameSession";
import type { Localized } from "../i18n/lang";

export interface SideStats {
  /** Dice rolled, every roll counted: shots, collisions and attack cards */
  dice: number;
  /** How many dice showed each face */
  faces: Record<DieFace, number>;
  /** Battle shots rolled (a unit that removed barbed wire instead rolled nothing) */
  shots: number;
  /** Rolls of collisions in the movement phase */
  collisions: number;
  /** Rolls of attack cards on marked hexes (Barrage, Air Power…) */
  cardAttacks: number;
  /** The command cards played, in turn order */
  cardsPlayed: Localized[];
}

const noFaces = (): Record<DieFace, number> =>
  Object.fromEntries(Object.values(DieFace).map((face) => [face, 0])) as Record<DieFace, number>;

/** A side's stats from its session: the finished turns, then the turn being played */
export function sideStats(game: Pick<GameSnapshot, "log" | "shots" | "cardAttacks" | "playedCard">): SideStats {
  const stats: SideStats = { dice: 0, faces: noFaces(), shots: 0, collisions: 0, cardAttacks: 0, cardsPlayed: [] };
  const count = (faces: readonly DieFace[]) => {
    stats.dice += faces.length;
    for (const face of faces) stats.faces[face] += 1;
  };
  const turns = [
    ...game.log,
    { shots: game.shots, cardAttacks: game.cardAttacks, card: game.playedCard && { name: game.playedCard.name } },
  ];
  for (const turn of turns) {
    if (turn.card) stats.cardsPlayed.push(turn.card.name);
    for (const shot of turn.shots) {
      if (shot.faces.length === 0) continue;
      count(shot.faces);
      if (shot.collision) stats.collisions += 1;
      else stats.shots += 1;
    }
    for (const attack of turn.cardAttacks) {
      if (attack.faces.length === 0) continue;
      count(attack.faces);
      stats.cardAttacks += 1;
    }
  }
  return stats;
}
