import { useSyncExternalStore } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EndOfTurnView from "./EndOfTurnView";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { Side } from "../../../types/hex";
import { Position } from "../../../types/scenario";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };
const EMPTY: Position = { row: 2, col: 2 };

// A session in the final phase, after a battle where both units held
const makeFinalSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })],
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  session.issueOrder(INFANTRY, INFANTRY);
  session.issueOrder(TANK, TANK);
  session.commitOrders();
  session.startMovement();
  session.startBattle();
  session.endBattle();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return (
    <EndOfTurnView
      faction="Allies"
      session={session}
      game={game}
      attacking={session.attacking}
      onDrawCard={() => session.drawCard()}
      onEndTurn={() => session.endTurn()}
    />
  );
}

const setup = ({ openMap = true } = {}) => {
  const session = makeFinalSession();
  const { container } = render(<Harness session={session} />);
  if (openMap) fireEvent.click(screen.getByRole("button", { name: "Actualizar mapa" }));
  const hex = (p: Position) =>
    container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement;
  const tap = (p: Position) => fireEvent.click(hex(p));
  const isSelected = (p: Position) => hex(p).querySelector(".hexagon__tile--selected") !== null;
  const hasUnit = (p: Position) => session.board.getHex(p)!.hasUnit();
  return { session, container, tap, isSelected, hasUnit };
};

describe("EndOfTurnView map", () => {
  it("opens the map from the retreats step and counts the changes when back", () => {
    const { container, tap } = setup({ openMap: false });
    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.queryByTestId("map-edits")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar mapa" }));
    tap(INFANTRY);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar unidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.getByTestId("map-edits")).toHaveTextContent("1 cambio en el mapa");
  });

  it("removes a destroyed unit and undoes it", () => {
    const { tap, hasUnit } = setup();

    tap(INFANTRY);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar unidad" }));
    expect(hasUnit(INFANTRY)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(hasUnit(INFANTRY)).toBe(true);
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("moves the selected unit to the empty hex tapped next", () => {
    const { tap, hasUnit, isSelected } = setup();

    tap(TANK);
    tap(EMPTY);

    expect(hasUnit(EMPTY)).toBe(true);
    expect(hasUnit(TANK)).toBe(false);
    expect(isSelected(EMPTY)).toBe(false);
  });

  it("switches the selection to another unit instead of moving onto it", () => {
    const { tap, hasUnit, isSelected } = setup();

    tap(TANK);
    tap(INFANTRY);

    expect(isSelected(INFANTRY)).toBe(true);
    expect(isSelected(TANK)).toBe(false);
    expect(hasUnit(TANK)).toBe(true);
  });

  it("deselects on a second tap or Cancelar, and ignores empty hexes with nothing selected", () => {
    const { tap, isSelected, session } = setup();

    tap(TANK);
    tap(TANK);
    expect(isSelected(TANK)).toBe(false);

    tap(TANK);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(isSelected(TANK)).toBe(false);

    tap(EMPTY);
    expect(session.getSnapshot().battleEdits).toBe(0);
  });
});
