import { describe, expect, it } from "vitest";
import GameSession from "../gameSession";
import PassAndPlayMatch from "../passAndPlay";
import CommandCard from "../commandCard";
import { CombatCard } from "../combatCard";
import { AiView, aiStep, seenEnemies } from "./aiStep";
import { chooseCombatCards, knowsCard, markFor, rewardFor } from "./combatCardChoice";
import { standardBrain } from "./standardBrain";
import { allCombatCards } from "../../data/combatCards";
import { TurnPhase } from "../../types/gameManager";
import { Faction } from "../../types/faction";
import { Position, Scenario } from "../../types/scenario";
import { same } from "../../i18n/lang";
import { samePosition } from "../position";

// The computer plays the Allies, the defender (whole turns, with supplies, from turn 2); the
// Axis infantry stands up the board
const scenario: Scenario = {
  id: "test",
  name: same("Test"),
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 6, col: 4 }], tank: [{ row: 7, col: 8 }] },
    axis: { infantry: [{ row: 3, col: 4 }] },
  },
};
const ENEMY: Position = { row: 3, col: 4 };

const cards = () => Array.from({ length: 4 }, (_, i) => new CommandCard({ id: `all-${i}`, orders: 6 }));
const combat = (id: string): CombatCard => allCombatCards().find((card) => card.templateId === id)!;

/** The Allies' turn 2 with these two combat cards in the hand and `coins` supplies */
function turnWith(hand: [string, string], coins: number) {
  const session = (faction: Faction) =>
    new GameSession({
      scenario,
      faction,
      initialHandSize: 2,
      commandCards: cards(),
      combatCards: faction === "Allies" ? hand.map(combat) : [],
      figures: true,
    });
  const match = new PassAndPlayMatch(scenario, { Allies: session("Allies"), Axis: session("Axis") }, { computer: "Allies" });
  const allies = match.sessions.Allies;
  allies.startFirstTurn();
  if (coins > 0) allies.adjustCoins(coins);
  const view: AiView = { side: "Allies", session: allies, enemies: seenEnemies(match, "Allies"), random: () => 0 };
  return { match, allies, view };
}

const everyUnit = (view: AiView) =>
  view.session.board.getAllHexes().flatMap((hex) => (hex.unit ? [hex.getPosition()] : []));

describe("the computer's combat cards", () => {
  it("plays an attack card when an enemy is in reach and it has the supplies, never a card it doesn't know", () => {
    const { view } = turnWith(["barrage", "suppressive-fire"], 10);
    const chosen = chooseCombatCards(view, everyUnit(view), () => true);
    expect(chosen.map((card) => card.templateId)).toEqual(["barrage"]);
    expect(knowsCard(combat("suppressive-fire"))).toBe(false);

    const poor = turnWith(["barrage", "suppressive-fire"], 0);
    expect(chooseCombatCards(poor.view, everyUnit(poor.view), () => true)).toEqual([]);
  });

  it("marks the enemy's hex for an attack card", () => {
    const { allies, view } = turnWith(["barrage", "suppressive-fire"], 10);
    const barrage = allies.getSnapshot().combatHand.find((card) => card.templateId === "barrage")!;
    expect(allies.pickCard(allies.getSnapshot().hand[0]!, undefined, barrage)).toBe(true);
    const marking = allies.getSnapshot().marking!;
    expect(markFor(view, allies.getSnapshot().markable, marking)).toEqual(ENEMY);
  });

  it("plays its cards through a turn: the card, its mark and the orders", () => {
    const { match, allies } = turnWith(["barrage", "suppressive-fire"], 10);
    while (aiStep(match, "Allies", standardBrain, () => 0));
    const game = allies.getSnapshot();
    expect(game.phase).toBe(TurnPhase.MOVEMENT);
    expect(game.combatCardsPlayed.map((card) => card.templateId)).toEqual(["barrage"]);
    expect(game.markers.some((marker) => samePosition(marker, ENEMY))).toBe(true);
  });

  it("takes a combat card in the final phase while it holds fewer than two it knows how to play", () => {
    expect(rewardFor(turnWith(["suppressive-fire", "barrage"], 0).view)).toBe("combatCard");
    expect(rewardFor(turnWith(["explosives", "barrage"], 0).view)).toBe("coins");
  });

  it("takes back a card no unit can take, with its supplies, rather than wasting it", () => {
    // Mechanic needs a weakened armour or artillery unit with an order: there is none
    const { match, allies } = turnWith(["mechanic", "explosives"], 10);
    const mechanic = allies.getSnapshot().combatHand.find((card) => card.templateId === "mechanic")!;
    expect(allies.pickCard(allies.getSnapshot().hand[0]!, undefined, mechanic)).toBe(true);
    const coins = allies.getSnapshot().coins;
    while (aiStep(match, "Allies", standardBrain, () => 0));
    const game = allies.getSnapshot();
    expect(game.phase).toBe(TurnPhase.MOVEMENT);
    expect(game.combatCardsPlayed).toEqual([]);
    expect(game.coins).toBe(coins + mechanic.cost);
  });
});
