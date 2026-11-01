import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RevealView from "./RevealView";
import GameSession from "../../../game-core/gameSession";
import PassAndPlayMatch from "../../../game-core/passAndPlay";
import { moveUntilWaiting, playMovement } from "../../../game-core/ai/selfPlay";
import { turnedRound } from "../../../game-core/BoardManager";
import { STANDARD_BOARD } from "../../../game-core/boardSize";
import { same } from "../../../i18n/lang";
import { Faction } from "../../../types/faction";
import { Scenario } from "../../../types/scenario";

/** Face to face in row 4 (the Allies' view): the Axis infantry on (4,4) heads into the Allied one on (4,2), which rests */
const collidingMatch = () => {
  const scenario: Scenario = {
    id: "test",
    name: same("Test"),
    description: same(""),
    attacker: "Axis",
    tiles: {},
    units: { allies: { infantry: [{ row: 4, col: 2 }] }, axis: { infantry: [{ row: 4, col: 4 }] } },
  };
  const side = (faction: Faction) => new GameSession({ scenario, faction, figures: true });
  const match = new PassAndPlayMatch(scenario, { Allies: side("Allies"), Axis: side("Axis") });
  match.uncover();
  const axis = match.activeSession();
  axis.pickCard(null);
  axis.giveAction(turnedRound({ row: 4, col: 4 }, STANDARD_BOARD), "infantry:moveOut", turnedRound({ row: 4, col: 2 }, STANDARD_BOARD));
  axis.commitOrders();
  match.uncover();
  match.activeSession().pickCard(null);
  match.activeSession().commitOrders();
  return match;
};

describe("RevealView", () => {
  it("heads the column with the Close Assault painting once units have collided", () => {
    const match = collidingMatch();
    const { rerender } = render(<RevealView match={match} turn={1} viewer="Allies" />);
    expect(screen.queryByTestId("collision-painting")).not.toBeInTheDocument();

    moveUntilWaiting(match);
    rerender(<RevealView match={match} turn={1} viewer="Allies" />);
    expect(screen.getAllByTestId("collision")).toHaveLength(1);
    expect(screen.getByTestId("movement-status")).toHaveTextContent("Tira el choque para seguir moviendo.");
    expect(screen.getByTestId("collision-painting")).toHaveAttribute("src", expect.stringContaining("close-assault"));
  });

  it("says when Armor Forward went through enemy infantry, with no collision to roll", () => {
    const scenario: Scenario = {
      id: "test",
      name: same("Test"),
      description: same(""),
      attacker: "Axis",
      tiles: {},
      units: { allies: { infantry: [{ row: 4, col: 4 }] }, axis: { tank: [{ row: 4, col: 6 }] } },
    };
    const side = (faction: Faction) => new GameSession({ scenario, faction, figures: true });
    const match = new PassAndPlayMatch(scenario, { Allies: side("Allies"), Axis: side("Axis") });
    match.uncover();
    const axis = match.activeSession();
    axis.pickCard(null);
    axis.giveAction(turnedRound({ row: 4, col: 6 }, STANDARD_BOARD), "tank:armorForward", turnedRound({ row: 4, col: 2 }, STANDARD_BOARD));
    axis.commitOrders();
    match.uncover();
    match.activeSession().pickCard(null);
    match.activeSession().commitOrders();
    playMovement(match);

    render(<RevealView match={match} turn={1} viewer="Allies" />);
    expect(screen.queryAllByTestId("collision")).toHaveLength(0);
    expect(screen.getByTestId("overruns")).toHaveTextContent("atravesó infantería enemiga: le sale una bandera");
    expect(screen.getByTestId("overruns")).toHaveTextContent("Blindado (Eje) atravesó infantería (Aliados)");
  });

  it("moves the units by itself a hex at a time once they set off, and stops for the collision", () => {
    vi.useFakeTimers();
    try {
      const match = collidingMatch();
      render(<RevealView match={match} turn={1} viewer="Allies" />);
      fireEvent.click(screen.getByRole("button", { name: "Mover las unidades" }));
      expect(screen.getByTestId("movement-status")).toHaveTextContent("Las unidades se ponen en marcha…");
      act(() => vi.advanceTimersByTime(800));
      expect(match.getSnapshot().movement!.step).toBe(1);
      act(() => vi.advanceTimersByTime(800));
      // Into the Allied unit's hex: it waits for the roll
      expect(match.getSnapshot().movement!.waiting).toBe("collision");
      act(() => vi.advanceTimersByTime(5000));
      expect(match.getSnapshot().movement!.step).toBe(2);
      expect(screen.getByRole("button", { name: "Tirar el choque 1" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
