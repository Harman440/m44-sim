import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RevealView from "./RevealView";
import GameSession from "../../../game-core/gameSession";
import PassAndPlayMatch from "../../../game-core/passAndPlay";
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

    match.moveUnits();
    rerender(<RevealView match={match} turn={1} viewer="Allies" />);
    expect(screen.getAllByTestId("collision")).toHaveLength(1);
    expect(screen.getByTestId("collision-painting")).toHaveAttribute("src", expect.stringContaining("close-assault"));
  });
});
