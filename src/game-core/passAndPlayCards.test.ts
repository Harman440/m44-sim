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

const battleCard = (match: PassAndPlayMatch, side: Faction, id: string) => {
  const session = match.sessions[side];
  return session.playBattleCombatCard(session.getSnapshot().combatHand.find((c) => c.templateId === id)!);
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
    expect(match.sessions.Axis.figuresAt(axisView(4, 3))).toBe(3);
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

  it("lets the Ambush card's unit fire first at the enemy attacking it", () => {
    const match = newMatch();
    toTurn2Battle(match);
    expect(battleCard(match, "Allies", "ambush")).toBe(true);
    expect(match.getSnapshot().battle!.card).toEqual({ side: "Allies", kind: "ambush", targets: [] });

    expect(match.ambush({ row: 4, col: 2 }, { row: 2, col: 4 })).toBe(false); // not adjacent
    expect(match.ambush({ row: 4, col: 2 }, { row: 4, col: 3 })).toBe(true);
    // 3 close assault dice, all hits on the Axis infantry
    expect(match.sessions.Axis.figuresAt(axisView(4, 3))).toBe(4);
    expect(match.getSnapshot().battle).toMatchObject({ card: null, pending: null });
    expect(match.ambush({ row: 4, col: 2 }, { row: 4, col: 3 })).toBe(false); // once
  });

  it("stops an enemy unit with Out of Ammo and moves it to its baseline, its player picking the hex", () => {
    const match = newMatch();
    toTurn2Battle(match);
    expect(battleCard(match, "Allies", "out-of-ammo")).toBe(true);
    const card = match.getSnapshot().battle!.card!;
    expect(card).toMatchObject({ side: "Allies", kind: "block" });
    expect(card.targets).toEqual(expect.arrayContaining([axisView(4, 3), axisView(2, 4)]));

    expect(match.block(axisView(4, 3))).toBe(true);
    const battle = match.getSnapshot().battle!;
    expect(battle).toMatchObject({ card: null, side: null, relocate: { side: "Axis", position: axisView(4, 3) } });
    const to = battle.relocate!.options[0]!;
    expect(to.row).toBe(8);
    expect(match.relocate(to)).toBe(true);

    const axis = match.sessions.Axis;
    expect(axis.board.getHex(to)?.unit?.getUnitType()).toBe(UnitType.INFANTRY);
    const infantry = axis.orderSummaries().find((s) => s.unitType === UnitType.INFANTRY)!;
    expect(infantry.shotsLeft).toBe(0);
    expect(match.getSnapshot().battle).toMatchObject({ relocate: null, side: "Axis" });
  });

  it("only lets Shell Shortage stop armor or artillery", () => {
    const match = newMatch();
    toTurn2Battle(match);
    expect(battleCard(match, "Allies", "shells-shortage")).toBe(true);
    expect(match.getSnapshot().battle!.card!.targets).toEqual([axisView(2, 4)]);
    expect(match.block(axisView(4, 3))).toBe(false);
    expect(match.block(axisView(2, 4))).toBe(true);
    const tank = match.sessions.Axis.orderSummaries().find((s) => s.unitType === UnitType.TANK)!;
    expect(tank.shotsLeft).toBe(0);
    expect(samePosition(tank.firingFrom, axisView(2, 4))).toBe(true);
    expect(match.sessions.Axis.getSnapshot().phase).toBe(TurnPhase.BATTLE);
  });

  it("sends an armor unit back to where it started with Out of Fuel", () => {
    const match = newMatch();
    // The Axis tank moves 1 hex west (its view: east) in turn 2
    const from = axisView(2, 4);
    const to = axisView(2, 5);
    toTurn2Battle(match, { moves: [[from, to]] });
    expect(battleCard(match, "Allies", "out-of-fuel")).toBe(true);
    expect(match.getSnapshot().battle!.card!.targets).toEqual([to]);

    expect(match.block(to)).toBe(true);
    const axis = match.sessions.Axis;
    expect(axis.board.getHex(from)?.unit?.getUnitType()).toBe(UnitType.TANK);
    expect(axis.board.getHex(to)?.unit).toBeNull();
    expect(axis.orderSummaries().find((s) => s.unitType === UnitType.TANK)!.shotsLeft).toBe(0);
  });
});
