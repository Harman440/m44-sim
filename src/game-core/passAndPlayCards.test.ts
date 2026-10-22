import { describe, expect, it } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch from "./passAndPlay";
import { UnitType } from "./unit";
import { turnedRound } from "./BoardManager";
import { STANDARD_BOARD } from "./boardSize";
import { samePosition } from "./position";
import { Faction } from "../types/faction";
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
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 4, col: 2 }], tank: [{ row: 6, col: 2 }] },
    axis: { infantry: [{ row: 4, col: 3 }], tank: [{ row: 2, col: 4 }] },
  },
};

/** Test mode: plenty of supplies to play any card. Every die shows `face` (0: infantry, 5: flag) */
const newMatch = (face = 0, map: Scenario = scenario) => {
  const side = (faction: Faction) =>
    new GameSession({
      scenario: map,
      faction,
      testMode: true,
      figures: true,
      random: () => face / 6,
    });
  return new PassAndPlayMatch(map, { Allies: side("Allies"), Axis: side("Axis") });
};

const axisView = (row: number, col: number) => turnedRound({ row, col }, STANDARD_BOARD);

/**
 * The side holding the device plays a command card (by id, none by default), marks its hexes
 * (its own view), gives the moves, hold orders to every other unit, and locks them
 */
const play = (
  match: PassAndPlayMatch,
  { card, marks = [], moves = [] }: { card?: string; marks?: Position[]; moves?: [Position, Position][] } = {}
) => {
  match.uncover();
  const session = match.activeSession();
  const held = card ? session.getSnapshot().cards.find((each) => each.card.id === card)!.card : null;
  expect(session.pickCard(held)).toBe(true);
  marks.forEach((mark) => expect(session.markHex(mark)).toBe(true));
  moves.forEach(([from, to]) => expect(session.issueOrder(from, to)).toBe(true));
  while (session.getSnapshot().orderable.length > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** Turn 1 played as given, up to its battle */
const toBattle = (match: PassAndPlayMatch, axis: Parameters<typeof play>[1] = {}, allies: Parameters<typeof play>[1] = {}) => {
  play(match, axis);
  play(match, allies);
  expect(match.moveUnits()).toBe(true);
  expect(match.finishReveal()).toBe(true);
};

describe("attack cards and wire in the shared battle", () => {
  it("rolls an attack card on its marked hexes before anyone fires, dealing the hits there", () => {
    const match = newMatch(); // the attack die shows infantry: hits on infantry
    toBattle(match, {}, { card: "barrage", marks: [{ row: 4, col: 3 }] });

    const battle = match.getSnapshot().battle!;
    expect(battle).toMatchObject({ attacks: ["Allies"], side: null });
    expect(match.endBattle()).toBe(false);

    expect(match.rollAttacks("Axis")).toBe(false);
    expect(match.rollAttacks("Allies")).toBe(true);
    // Barrage rolls 4 dice on the hex: 4 hits on the Axis infantry
    expect(match.sessions.Axis.figuresAt(axisView(4, 3))).toBe(INFANTRY_FIGURES - 4);
    expect(match.getSnapshot().battle).toMatchObject({ attacks: [], side: "Axis" });
  });

  it("lets infantry on barbed wire remove it instead of firing, from both sides' boards", () => {
    const wired: Scenario = { ...scenario, wire: [{ row: 4, col: 2 }] };
    const match = newMatch(0, wired);
    toBattle(match);
    const allies = match.sessions.Allies;
    const infantry = allies.getSnapshot().orders.findIndex((o) => samePosition(o.end, { row: 4, col: 2 }));

    expect(match.removeWire(infantry)).toBe(false); // the Axis goes first
    match.holdFire(match.getSnapshot().battle!.fireable[0]!);
    expect(match.removeWire(infantry)).toBe(true);
    expect(allies.board.getHex({ row: 4, col: 2 })!.wire).toBe(false);
    expect(match.sessions.Axis.board.getHex(axisView(4, 2))!.wire).toBe(false);
    expect(allies.shotsLeft(infantry)).toBe(0);
    expect(match.getSnapshot().battle).toMatchObject({ side: "Axis" });
  });

  it("takes the wire a tank went through off the other side's board once the orders are carried out", () => {
    const wired: Scenario = { ...scenario, wire: [{ row: 5, col: 2 }] };
    const match = newMatch(0, wired);
    const axis = match.sessions.Axis;
    play(match);
    play(match, { moves: [[{ row: 6, col: 2 }, { row: 5, col: 2 }]] });
    // Hidden from the Axis until the orders are carried out
    expect(axis.board.getHex(axisView(5, 2))!.wire).toBe(true);

    expect(match.moveUnits()).toBe(true);
    expect(match.sessions.Allies.board.getHex({ row: 5, col: 2 })!.wire).toBe(false);
    expect(axis.board.getHex(axisView(5, 2))!.wire).toBe(false);
  });
});
