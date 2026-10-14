import { describe, expect, it, vi } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch, { armyOf, otherSide } from "./passAndPlay";
import { SavedGame } from "./saveGame";
import CommandCard from "./commandCard";
import { UnitType } from "./unit";
import { turnedRound } from "./BoardManager";
import { Faction } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

// Axis attacks: it plays turn 1 alone
const scenario: Scenario = {
  id: "test",
  name: "Test",
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Axis",
  tiles: {},
  units: {
    allies: { infantry: [{ row: 7, col: 1 }], tank: [{ row: 8, col: 6 }] },
    axis: { infantry: [{ row: 1, col: 3 }] },
  },
};

// Cards that order every unit, so a turn needs no section
const cards = () => Array.from({ length: 8 }, (_, i) => new CommandCard({ id: `all-${i}`, orders: 6 }));

const newSession = (faction: Faction) => new GameSession({ scenario, faction, initialHandSize: 2, commandCards: cards() });

const restoreSide = (saved: SavedGame) => GameSession.restore(saved, scenario, cards());

const newMatch = () => new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") });

/** The side holding the device picks a card and gives hold orders to every unit, then locks them */
const giveOrders = (match: PassAndPlayMatch) => {
  match.uncover();
  const session = match.activeSession();
  expect(session.pickCard(session.getSnapshot().hand[0]!)).toBe(true);
  while (session.getSnapshot().ordersLeft > 0) {
    const position = session.getSnapshot().orderable[0]!;
    expect(session.issueOrder(position, position)).toBe(true);
  }
  expect(session.commitOrders()).toBe(true);
};

/** Movement, battle and the final phase of the side holding the device, to the next turn */
const finishTurn = (match: PassAndPlayMatch) => {
  match.uncover();
  const session = match.activeSession();
  expect(session.startBattle()).toBe(true);
  expect(session.endBattle()).toBe(true);
  if (session.getSnapshot().needsRewardChoice) expect(session.chooseReward("coins")).toBe(true);
  expect(session.endTurn()).toBe(true);
};

describe("PassAndPlayMatch", () => {
  it("starts with the attacker, behind the cover screen, while the defender waits", () => {
    const match = newMatch();
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    expect(match.activeSession().faction).toBe("Axis");
    expect(match.sessions.Axis.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
    expect(match.sessions.Allies.getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
  });

  it("uncovers for the player holding the device, and covers again when it's passed", () => {
    const match = newMatch();

    expect(match.pass()).toBe(false); // nobody has shown their side yet
    expect(match.uncover()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: false });
    expect(match.uncover()).toBe(false);
    expect(match.pass()).toBe(false); // the Allies wait out the Axis' extra turn

    giveOrders(match);
    finishTurn(match);
    expect(match.pass()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true });
    expect(match.activeSession().faction).toBe("Allies");
  });

  it("keeps the device with the attacker through the extra turn, then starts the defender's turn 2", () => {
    const match = newMatch();
    giveOrders(match);
    // The defender has no orders to give in turn 1
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: false, revealTurn: null });

    finishTurn(match);

    expect(match.sessions.Allies.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
    expect(match.sessions.Axis.getSnapshot()).toMatchObject({ phase: TurnPhase.PICK_CARDS, turn: 2 });
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: false });
  });

  it("hands the device over when a side locks its orders, then reveals both", () => {
    const match = newMatch();
    giveOrders(match);
    finishTurn(match);

    giveOrders(match); // the Axis' turn 2
    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true, revealTurn: null });

    giveOrders(match); // the Allies'
    expect(match.getSnapshot()).toMatchObject({ revealTurn: 2 });
    expect(match.pass()).toBe(false);
    expect(match.uncover()).toBe(false);

    expect(match.finishReveal()).toBe(true);
    expect(match.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    expect(match.finishReveal()).toBe(false);
  });

  it("hands the device to a side still finishing the last turn", () => {
    const match = newMatch();
    giveOrders(match);
    finishTurn(match);
    giveOrders(match);
    giveOrders(match);
    match.finishReveal();

    finishTurn(match); // the Axis' turn 2
    giveOrders(match); // and its turn 3 orders, while the Allies are still moving in turn 2

    expect(match.getSnapshot()).toMatchObject({ active: "Allies", covered: true, revealTurn: null });
    expect(match.activeSession().getSnapshot()).toMatchObject({ phase: TurnPhase.MOVEMENT, turn: 2 });
  });

  it("tells listeners about its own changes and either side's", () => {
    const match = newMatch();
    const listener = vi.fn();
    const unsubscribe = match.subscribe(listener);

    match.uncover();
    expect(listener).toHaveBeenCalledTimes(1);
    match.activeSession().pickCard(match.activeSession().getSnapshot().hand[0]!);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    match.pass();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lists each side's army where it stands, turned round for the other side", () => {
    const match = newMatch();
    const axis = armyOf(match.sessions.Axis);
    expect(axis).toHaveLength(1);
    expect(axis[0]!.unit.getUnitType()).toBe(UnitType.INFANTRY);
    // The Axis sees its own board turned round
    expect(turnedRound(axis[0]!.position)).toEqual({ row: 1, col: 3 });
    expect(armyOf(match.sessions.Allies).map((u) => u.position)).toEqual(
      expect.arrayContaining([{ row: 7, col: 1 }, { row: 8, col: 6 }])
    );
  });

  it("shows the other army where it stands, hiding its orders until they're revealed", () => {
    const match = newMatch();
    giveOrders(match);
    finishTurn(match);

    // The Axis moves its infantry one hex, still in secret
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(axis.getSnapshot().hand[0]!);
    const from = axis.getSnapshot().orderable[0]!;
    const to = { row: from.row, col: from.col - 1 }; // the next hex in the row
    expect(axis.issueOrder(from, to)).toBe(true);
    expect(axis.commitOrders()).toBe(true);

    expect(match.opponentOf("Allies")).toEqual({ faction: "Axis", units: [{ position: from, unit: expect.anything() }], orders: [] });

    giveOrders(match); // the Allies' orders: both are revealed
    expect(match.opponentOf("Allies").units[0]!.position).toEqual(to);
    expect(match.opponentOf("Allies").orders).toHaveLength(1);
    expect(match.opponentOf("Axis").orders).toHaveLength(2);

    match.finishReveal();
    expect(match.opponentOf("Allies").orders).toHaveLength(1);
  });

  it("refuses sessions of the wrong side", () => {
    expect(() => new PassAndPlayMatch(scenario, { Allies: newSession("Axis"), Axis: newSession("Axis") })).toThrow();
  });

  it("saves and restores both sides and the turn revealed, behind the cover screen", () => {
    const match = newMatch();
    giveOrders(match);
    finishTurn(match);
    giveOrders(match);
    giveOrders(match);
    match.finishReveal();
    match.uncover();

    const saved = JSON.parse(JSON.stringify(match.save()));
    const restored = PassAndPlayMatch.restore(saved, scenario, restoreSide);

    expect(restored.getSnapshot()).toMatchObject({ active: "Axis", covered: true, revealTurn: null });
    for (const side of ["Allies", "Axis"] as const) {
      expect(restored.sessions[side].getSnapshot()).toMatchObject({ phase: TurnPhase.MOVEMENT, turn: 2 });
    }
    expect(otherSide(restored.getSnapshot().active)).toBe("Allies");
  });

  it("drops a save of another version", () => {
    const saved = { ...newMatch().save(), version: 0 };
    expect(() => PassAndPlayMatch.restore(saved as never, scenario, restoreSide)).toThrow();
  });
});
