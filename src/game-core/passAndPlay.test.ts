import { describe, expect, it, vi } from "vitest";
import GameSession from "./gameSession";
import PassAndPlayMatch from "./passAndPlay";
import { SavedGame } from "./saveGame";
import { scenarios } from "../data/scenarios";
import { commandDeckFor } from "../data/commandCards";
import { combatDeckFor } from "../data/combatCards";
import { Faction } from "../types/faction";
import { TurnPhase } from "../types/gameManager";
import { Side } from "../types/hex";

const scenario = scenarios[0]!;

const newSession = (faction: Faction) =>
  new GameSession({
    scenario,
    faction,
    initialHandSize: scenario.initialHandSize[faction === "Axis" ? "axis" : "allies"],
    commandCards: commandDeckFor(scenario, faction),
    combatCards: combatDeckFor(scenario, faction),
  });

const restoreSide = (saved: SavedGame) =>
  GameSession.restore(saved, scenario, commandDeckFor(scenario, saved.faction), combatDeckFor(scenario, saved.faction));

const newMatch = () => new PassAndPlayMatch(scenario, { Allies: newSession("Allies"), Axis: newSession("Axis") });

const other = (faction: Faction): Faction => (faction === "Axis" ? "Allies" : "Axis");

describe("PassAndPlayMatch", () => {
  it("starts with the attacker, behind the cover screen", () => {
    const match = newMatch();
    expect(match.getSnapshot()).toEqual({ active: scenario.attacker, covered: true });
    expect(match.activeSession().faction).toBe(scenario.attacker);
  });

  it("keeps each side's own game: the attacker plays the extra turn, the defender waits", () => {
    const match = newMatch();
    expect(match.sessions[scenario.attacker].getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
    expect(match.sessions[other(scenario.attacker)].getSnapshot().phase).toBe(TurnPhase.AWAIT_ATTACKER);
  });

  it("uncovers for the player holding the device, and covers again when it's passed", () => {
    const match = newMatch();
    const first = scenario.attacker;

    expect(match.pass()).toBe(false); // nobody has shown their side yet
    expect(match.uncover()).toBe(true);
    expect(match.getSnapshot()).toEqual({ active: first, covered: false });
    expect(match.uncover()).toBe(false);

    expect(match.pass()).toBe(true);
    expect(match.getSnapshot()).toEqual({ active: other(first), covered: true });
    expect(match.activeSession().faction).toBe(other(first));
  });

  it("tells listeners about its own changes and either side's", () => {
    const match = newMatch();
    const listener = vi.fn();
    const unsubscribe = match.subscribe(listener);

    match.uncover();
    expect(listener).toHaveBeenCalledTimes(1);
    match.sessions[other(scenario.attacker)].startFirstTurn();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    match.pass();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("refuses sessions of the wrong side", () => {
    expect(() => new PassAndPlayMatch(scenario, { Allies: newSession("Axis"), Axis: newSession("Axis") })).toThrow();
  });

  it("saves and restores both sides, behind the cover screen", () => {
    const match = newMatch();
    match.uncover();
    const attacker = match.activeSession();
    const card = attacker.getSnapshot().hand[0]!;
    attacker.pickCard(card, attacker.cardNeedsSection(card) ? Side.LEFT : undefined);
    match.pass();
    match.uncover();

    const saved = JSON.parse(JSON.stringify(match.save()));
    const restored = PassAndPlayMatch.restore(saved, scenario, restoreSide);

    expect(restored.getSnapshot()).toEqual({ active: other(scenario.attacker), covered: true });
    expect(restored.sessions[scenario.attacker].getSnapshot().phase).toBe(attacker.getSnapshot().phase);
    expect(restored.sessions[scenario.attacker].getSnapshot().hand.map((c) => c.id)).toEqual(
      attacker.getSnapshot().hand.map((c) => c.id)
    );
  });

  it("drops a save of another version", () => {
    const saved = { ...newMatch().save(), version: 0 };
    expect(() => PassAndPlayMatch.restore(saved as never, scenario, restoreSide)).toThrow();
  });
});
