// game-core/ai/selfPlay.ts
// The computer against itself, for tests: each side played by a brain, the
// steps both players share taken as they would, with seeded dice and decks.
import GameSession from "../gameSession";
import PassAndPlayMatch, { armyOf } from "../passAndPlay";
import { aiStep, Brain } from "./aiStep";
import { commandDeckFor } from "../../data/commandCards";
import { combatDeckFor } from "../../data/combatCards";
import { FACTIONS, Faction } from "../../types/faction";
import { Scenario } from "../../types/scenario";

/** A seeded random source, [0, 1) like Math.random (mulberry32) */
export const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const newSession = (scenario: Scenario, faction: Faction, random: () => number) =>
  new GameSession({
    scenario,
    faction,
    initialHandSize: scenario.initialHandSize[faction === "Axis" ? "axis" : "allies"],
    commandCards: commandDeckFor(scenario, faction),
    combatCards: combatDeckFor(scenario, faction),
    figures: true,
    random,
  });

/** What both players do together on the shared screens: the reveal, the movement, ending the battle */
export function sharedStep(match: PassAndPlayMatch): boolean {
  const { revealTurn, movement, battle } = match.getSnapshot();
  if (revealTurn !== null) {
    if (!movement) return match.moveUnits();
    const next = movement.collisions.findIndex((collision) => !collision.rolled);
    return next >= 0 ? match.rollCollision(next) : match.finishReveal();
  }
  if (battle && battle.side === null && !battle.retreat && !battle.ground && battle.attacks.length === 0) {
    return match.endBattle();
  }
  return false;
}

export const unitsLeft = (match: PassAndPlayMatch) => FACTIONS.map((side) => armyOf(match.sessions[side]).length);

/** Each side's figures left on the board */
export const figuresLeft = (match: PassAndPlayMatch): Record<Faction, number> => {
  const count = (side: Faction) =>
    armyOf(match.sessions[side]).reduce((sum, { position }) => sum + (match.sessions[side].figuresAt(position) ?? 0), 0);
  return { Allies: count("Allies"), Axis: count("Axis") };
};

/**
 * Play a match with a brain on each side, until `turns` turns are over, a side has won or a side
 * has no units left. `random` drives the dice and the brains; the decks shuffle with Math.random, so a test
 * that wants the same game twice mocks it with the same seed
 */
export function playOut(
  scenario: Scenario,
  brains: Record<Faction, Brain>,
  random: () => number,
  turns: number,
  { computer = "Axis" }: { computer?: Faction } = {}
): PassAndPlayMatch {
  const match = new PassAndPlayMatch(
    scenario,
    { Allies: newSession(scenario, "Allies", random), Axis: newSession(scenario, "Axis", random) },
    { computer }
  );
  // The computer's side acts second, as against a person
  const order = computer === "Axis" ? FACTIONS : [...FACTIONS].reverse();
  let steps = 0;
  while (Math.min(...FACTIONS.map((side) => match.sessions[side].getSnapshot().turn)) <= turns) {
    if (unitsLeft(match).includes(0) || match.getSnapshot().result) break;
    const moved = order.some((side) => aiStep(match, side, brains[side], random)) || sharedStep(match);
    if (!moved) {
      const phases = FACTIONS.map((side) => {
        const game = match.sessions[side].getSnapshot();
        const detail = {
          ordersLeft: game.ordersLeft,
          orderable: game.orderable.length,
          marking: game.marking?.card.id ?? null,
          markable: game.markable.length,
          assigning: game.assigning && { card: game.assigning.card.id, positions: game.assigning.positions.length },
          played: game.combatCardsPlayed.map((card) => card.id),
        };
        return `${side}: phase ${game.phase} ${JSON.stringify(detail)}`;
      }).join(", ");
      throw new Error(`Stuck in ${scenario.id} after ${steps} steps: ${phases}`);
    }
    if (++steps > 20_000) throw new Error(`No end in ${scenario.id}`);
  }
  return match;
}
