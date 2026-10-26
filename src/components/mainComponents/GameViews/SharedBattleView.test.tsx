import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import SharedBattleView from "./SharedBattleView";
import GameSession from "../../../game-core/gameSession";
import PassAndPlayMatch from "../../../game-core/passAndPlay";
import { same } from "../../../i18n/lang";
import { Faction } from "../../../types/faction";
import { Position, Scenario } from "../../../types/scenario";

/** The Axis attacks, so it fires first; one unit each */
const battleOf = (allies: Position, axis: Position, computer: Faction | null = null) => {
  const scenario: Scenario = {
    id: "test",
    name: same("Test"),
    description: same(""),
    attacker: "Axis",
    tiles: {},
    units: { allies: { infantry: [allies] }, axis: { infantry: [axis] } },
  };
  const side = (faction: Faction) => new GameSession({ scenario, faction, figures: true, random: () => 0.5 });
  const match = new PassAndPlayMatch(scenario, { Allies: side("Allies"), Axis: side("Axis") }, { computer });
  // The Axis (the attacker, first to give orders) holds; the Allies rest, so only the Axis fires
  for (const faction of ["Axis", "Allies"] as const) {
    match.uncover();
    const session = match.sessions[faction];
    session.pickCard(null);
    if (faction === "Axis") for (const position of session.getSnapshot().orderable) session.issueOrder(position, position);
    session.commitOrders();
  }
  match.moveUnits();
  match.finishReveal();
  return match;
};

describe("SharedBattleView", () => {
  it("picks the only unit that can fire and its only target, and keeps the target when the way of firing changes", () => {
    render(<SharedBattleView match={battleOf({ row: 4, col: 2 }, { row: 4, col: 3 })} />);

    expect(screen.getByTestId("firing-unit")).toBeInTheDocument();
    expect(screen.getByTestId("fire-target")).toBeInTheDocument();
    const options = within(screen.getByTestId("fire-options"));
    fireEvent.click(options.getByRole("button", { name: /^Fuego de supresión/ }));
    expect(screen.getByTestId("fire-target")).toBeInTheDocument();
    expect(screen.getByTestId("fire-option-text")).toHaveTextContent(/supresión/);
  });

  it("says how many of the side's units are left to fire", () => {
    render(<SharedBattleView match={battleOf({ row: 4, col: 2 }, { row: 4, col: 3 })} />);

    expect(screen.getByTestId("left-to-fire")).toHaveTextContent("Queda 1 unidad por disparar");
  });

  it("lists the units left to fire with their ammo", () => {
    render(<SharedBattleView match={battleOf({ row: 4, col: 2 }, { row: 4, col: 3 })} />);

    const rows = within(screen.getByTestId("to-fire-list")).getAllByTestId("to-fire-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByRole("img", { name: /Munición/ })).toBeInTheDocument();
  });

  it("passes over a unit with nothing to fire at, and says so", () => {
    render(<SharedBattleView match={battleOf({ row: 8, col: 6 }, { row: 0, col: 6 })} />);

    expect(screen.queryByTestId("firing-unit")).not.toBeInTheDocument();
    expect(screen.getByTestId("no-target")).toHaveTextContent("Eje: 1 unidad no tiene a qué disparar y no dispara.");
    expect(screen.getByText("Ninguna unidad puede disparar ya.")).toBeInTheDocument();
  });

  it("centres the map on the computer's unit as it fires", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<SharedBattleView match={battleOf({ row: 4, col: 2 }, { row: 4, col: 3 }, "Axis")} />);
      const viewWidth = () => Number(container.querySelector("svg.board__svg")!.getAttribute("viewBox")!.split(" ")[2]);
      const before = viewWidth();
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByTestId("shot-dice")).toBeInTheDocument();
      expect(viewWidth()).toBeLessThan(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
