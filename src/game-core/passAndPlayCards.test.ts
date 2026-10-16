import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch from "./passAndPlay";
import CommandCard from "./commandCard";
import { UnitType } from "./unit";
import { turnedRound } from "./BoardManager";
import { samePosition } from "./position";
import { allCombatCards } from "../data/combatCards";
import { Faction } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Position, Scenario } from "../types/scenario";
import { same } from "../i18n/lang";
import { FIGURES } from "../data/figures";

const INFANTRY_FIGURES = FIGURES[UnitType.INFANTRY].figures;

// The Axis attacks. In the Allies' view: Allied infantry (4,2) and tank (6,2);
// Axis infantry (4,3), next to it, and tank (2,4)
const scenario: Scenario = {
  id: "cards",
  name: same("Cards"),
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 4, col: 2 }], tank: [{ row: 6, col: 2 }] },
    axis: { infantry: [{ row: 4, col: 3 }], tank: [{ row: 2, col: 4 }] },
  },
};

// Cards that order every unit, and a Close Assault card
const cards = () => [
  ...Array.from({ length: 8 }, (_, i) => new CommandCard({ id: `all-${i}`, orders: 6 })),
  new CommandCard({ id: "close-assault", orders: 0, closeAssaultOnly: true }),
];

/** Test mode: every combat card in hand and plenty of supplies. Every die shows `face` (0: infantry, 5: flag) */
const newMatch = (face = 0) => {
  const side = (faction: Faction) =>
    new GameSession({
      scenario,
      faction,
      initialHandSize: 9,
      commandCards: cards(),
      combatCards: allCombatCards(),
      testMode: true,
      figures: true,
      random: () => face / 6,
    });
  return new PassAndPlayMatch(scenario, { Allies: side("Allies"), Axis: side("Axis") });
};

const axisView = (row: number, col: number) => turnedRound({ row, col });

/**
 * The side holding the device plays a command card (by id, "all-0" by default) with an order
 * combat card, marks its hexes (its own view), gives hold orders and locks them
 */
const play = (
  match: PassAndPlayMatch,
  { card = "all", combat, marks = [], moves = [] }: { card?: string; combat?: string; marks?: Position[]; moves?: [Position, Position][] } = {}
) => {
  match.uncover();
  const session = match.activeSession();
  const game = session.getSnapshot();
  const command = game.hand.find((c) => c.id.startsWith(card))!;
  const combatCard = combat ? game.combatHand.find((c) => c.templateId === combat)! : undefined;
  expect(session.pickCard(command, undefined, combatCard)).toBe(true);
  marks.forEach((mark) => expect(session.markHex(mark)).toBe(true));
  moves.forEach(([from, to]) => expect(session.issueOrder(from, to)).toBe(true));
  while (session.getSnapshot().ordersLeft > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** The Axis' extra turn with hold orders and no battle, then turn 2 played as given, up to its battle */
const toTurn2Battle = (match: PassAndPlayMatch, axis: Parameters<typeof play>[1] = {}, allies: Parameters<typeof play>[1] = {}) => {
  play(match);
  expect(match.moveUnits()).toBe(true);
  expect(match.finishReveal()).toBe(true);
  // Nobody fires in turn 1
  while (match.getSnapshot().battle?.side) match.holdFire(match.getSnapshot().battle!.fireable[0]!);
  expect(match.endBattle()).toBe(true);
  match.uncover();
  const axisSession = match.sessions.Axis;
  if (axisSession.getSnapshot().needsRewardChoice) axisSession.chooseReward("coins");
  expect(axisSession.endTurn()).toBe(true);
  play(match, axis);
  play(match, allies);
  expect(match.moveUnits()).toBe(true);
  expect(match.finishReveal()).toBe(true);
};

describe("combat cards in the shared battle", () => {
  it("rolls an attack card on its marked hexes before anyone fires, dealing the hits there", () => {
    const match = newMatch(); // the attack die shows infantry: hits on infantry
    toTurn2Battle(match, {}, { combat: "barrage", marks: [{ row: 4, col: 3 }] });

    const battle = match.getSnapshot().battle!;
    expect(battle).toMatchObject({ attacks: ["Allies"], side: null });
    expect(match.endBattle()).toBe(false);

    expect(match.rollAttacks("Axis")).toBe(false);
    expect(match.rollAttacks("Allies")).toBe(true);
    // Barrage rolls 4 dice on the hex: 4 hits on the Axis infantry
    expect(match.sessions.Axis.figuresAt(axisView(4, 3))).toBe(INFANTRY_FIGURES - 4);
    expect(match.getSnapshot().battle).toMatchObject({ attacks: [], side: "Axis" });
  });

  it("marks the Close Assault card's units next to an enemy, to fire in close assault", () => {
    const match = newMatch();
    play(match, { card: "close-assault" });
    match.moveUnits();
    match.finishReveal();

    const axis = match.sessions.Axis;
    const orders = axis.getSnapshot().orders;
    // The infantry next to the Allied infantry, not the tank
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ closeAssaultOnly: true, end: axisView(4, 3) });
    expect(match.getSnapshot().battle).toMatchObject({ side: "Axis", fireable: [0] });
    expect(axis.fireTargetsFor(0).map((t) => t.position)).toEqual([axisView(4, 2)]);
  });

  it("lets Fortify's infantry put sandbags on its hex instead of firing, which count against the enemy's next shots", () => {
    const match = newMatch();
    toTurn2Battle(match, {}, { combat: "fortify" });
    const allies = match.sessions.Allies;
    const infantry = allies.getSnapshot().orders.findIndex((o) => samePosition(o.end, { row: 4, col: 2 }));

    // The Axis, the attacker, goes first in the group
    expect(match.fortify(infantry)).toBe(false);
    match.holdFire(match.getSnapshot().battle!.fireable[0]!);
    expect(match.getSnapshot().battle).toMatchObject({ side: "Allies" });

    expect(match.fortify(infantry)).toBe(true);
    expect(allies.board.getHex({ row: 4, col: 2 })!.sandbags).toBe(true);
    expect(match.sessions.Axis.enemyAt(axisView(4, 2))?.sandbags).toBe(true);
    expect(match.getSnapshot().battle).toMatchObject({ side: "Axis" });
  });

  it("rolls Concentrated Fire's units together at one enemy, in one go before the enemy answers", () => {
    const match = newMatch(); // every die shows infantry: hits on infantry
    toTurn2Battle(match, {}, { combat: "concentrated-fire" });
    match.holdFire(match.getSnapshot().battle!.fireable[0]!);
    const allies = match.sessions.Allies;
    const orderAt = (p: Position) => allies.getSnapshot().orders.findIndex((o) => samePosition(o.end, p));
    const infantry = orderAt({ row: 4, col: 2 });
    const tank = orderAt({ row: 6, col: 2 });
    const target = { row: 4, col: 3 };
    const options = allies.joinable(infantry, { position: target, infantry: true, sandbags: false });
    expect(options.map((o) => o.order)).toEqual([tank]);

    expect(match.fire(infantry, target, { joined: [tank] })).toBe(true);
    const shot = allies.getSnapshot().shots.at(-2)!;
    expect(shot.joined).toEqual([tank]);
    // All the dice hit the Axis infantry at once, which loses that many figures (or is destroyed)
    expect(match.sessions.Axis.figuresAt(axisView(4, 3)) ?? 0).toBe(Math.max(0, INFANTRY_FIGURES - shot.dice));
    expect(allies.shotsLeft(tank)).toBe(0);
    expect(match.getSnapshot().battle).toMatchObject({ side: "Axis" });
  });
});
