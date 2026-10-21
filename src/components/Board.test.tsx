import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Board from "./Board";
import { ViewSideContext } from "./OpponentContext";
import BoardManager from "../game-core/BoardManager";
import type { ArmyView } from "../game-core/passAndPlay";
import { Scenario } from "../types/scenario";
import { same } from "../i18n/lang";

// Allied infantry behind sandbags at (6,2); the Axis infantry's at (2,4) in the Allies' view, (6,8) in its own
const scenario: Scenario = {
  id: "sandbags",
  name: same("Sandbags"),
  description: same(""),
  initialHandSize: { allies: 2, axis: 2 },
  attacker: "Allies",
  tiles: {},
  units: { allies: { infantry: [{ row: 6, col: 2 }] }, axis: { infantry: [{ row: 2, col: 4 }] } },
  sandbags: [{ row: 6, col: 2 }, { row: 2, col: 4 }],
};

const armyOf = (board: BoardManager, faction: "Allies" | "Axis"): ArmyView => ({
  faction,
  units: board.getAllHexes().flatMap((hex) => (hex.unit ? [{ position: hex.getPosition(), unit: hex.unit }] : [])),
  orders: [],
  camouflaged: [],
  sandbags: board.getAllHexes().flatMap((hex) => (hex.sandbags ? [hex.getPosition()] : [])),
});

/** The props every map passes, with nothing picked */
const plain = { onTileClick: () => {}, unitHexPosition: null, possibleMovePositions: [], possibleMoveAndFirePositions: [], orders: [] };

const turnedOf = (container: HTMLElement, side: string) =>
  container.querySelector(`[data-sandbags-side="${side}"] image`)?.hasAttribute("transform");

describe("Board sandbags", () => {
  it("draws both armies' sandbags, each facing its enemy: the other side's turned round", () => {
    const allies = new BoardManager(scenario, "Allies");
    const axis = new BoardManager(scenario, "Axis");

    const { container } = render(<Board {...plain} boardManager={allies} faction="Allies" opponent={armyOf(axis, "Axis")} />);

    expect(container.querySelector('[data-sandbags-side="Allies"]')).toHaveAttribute("data-sandbags-at", "6-2");
    expect(container.querySelector('[data-sandbags-side="Axis"]')).toHaveAttribute("data-sandbags-at", "6-8");
    expect(turnedOf(container, "Allies")).toBe(false);
    expect(turnedOf(container, "Axis")).toBe(true);
  });

  it("keeps them facing their enemy when the other side's board is drawn from the main side", () => {
    const allies = new BoardManager(scenario, "Allies");
    const axis = new BoardManager(scenario, "Axis");

    const { container } = render(
      <ViewSideContext.Provider value="Allies">
        <Board {...plain} boardManager={axis} faction="Axis" opponent={armyOf(allies, "Allies")} />
      </ViewSideContext.Provider>
    );

    expect(turnedOf(container, "Allies")).toBe(false);
    expect(turnedOf(container, "Axis")).toBe(true);
  });

  it("turns the Axis' sandbags round in the map editor, seen from the Allies", () => {
    const board = new BoardManager(scenario, "Allies", { bothSides: true });

    const { container } = render(
      <Board {...plain} boardManager={board} faction="Allies" unitFactionAt={(p) => (p.row === 2 ? "Axis" : "Allies")} />
    );

    expect(turnedOf(container, "Allies")).toBe(false);
    expect(turnedOf(container, "Axis")).toBe(true);
  });
});

describe("Board fog of war", () => {
  it("darkens the hexes out of sight and leaves off the hidden units with their sandbags", () => {
    const allies = new BoardManager(scenario, "Allies");
    const axis = new BoardManager(scenario, "Axis");

    const { container } = render(
      <Board
        {...plain}
        boardManager={allies}
        faction="Allies"
        opponent={armyOf(axis, "Axis")}
        fog={{ dark: [{ row: 0, col: 0 }, { row: 6, col: 2 }], hidden: [{ row: 6, col: 2 }] }}
      />
    );

    expect([...container.querySelectorAll("[data-fog-at]")].map((hex) => hex.getAttribute("data-fog-at"))).toEqual(["0-0", "6-2"]);
    expect(container.querySelector('[data-unit-at="6-2"]')).toBeNull();
    expect(container.querySelector('[data-sandbags-side="Allies"]')).toBeNull();
    expect(container.querySelector('[data-faction="Axis"]')).not.toBeNull();
  });
});
