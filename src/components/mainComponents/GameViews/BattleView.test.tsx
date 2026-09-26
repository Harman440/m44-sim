import { useSyncExternalStore } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BattleView from "./BattleView";
import GameSession from "../../../game-core/gameSession";
import CommandCard, { CommandCardType } from "../../../game-core/commandCard";
import { Position } from "../../../types/scenario";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };
const EMPTY: Position = { row: 2, col: 2 };

// A session already in the battle phase, with both units given hold orders
const makeBattleSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      tiles: {},
      units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "left", type: CommandCardType.LEFT, maxTotalOrders: 2 })],
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  session.issueOrder(INFANTRY, INFANTRY);
  session.issueOrder(TANK, TANK);
  session.commitOrders();
  session.startBattle();
  return session;
};

function Harness({ session, onFinishTurn }: { session: GameSession; onFinishTurn: () => void }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <BattleView boardSide="Allies" session={session} game={game} onFinishTurn={onFinishTurn} />;
}

const setup = () => {
  const session = makeBattleSession();
  const onFinishTurn = vi.fn();
  const { container } = render(<Harness session={session} onFinishTurn={onFinishTurn} />);
  const hex = (p: Position) =>
    container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement;
  const tap = (p: Position) => fireEvent.click(hex(p));
  const isSelected = (p: Position) => hex(p).querySelector(".hexagon__tile--selected") !== null;
  const hasUnit = (p: Position) => session.board.getHex(p)!.hasUnit();
  return { session, onFinishTurn, tap, isSelected, hasUnit };
};

describe("BattleView", () => {
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

  it("finishes the turn from the Terminar Turno button", () => {
    const { onFinishTurn } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Terminar Turno" }));

    expect(onFinishTurn).toHaveBeenCalledTimes(1);
  });
});
