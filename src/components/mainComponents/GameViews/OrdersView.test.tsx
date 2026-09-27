import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersView from "./OrdersView";
import { INVALID_FLASH_MS } from "../../useHexFlash";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { Side } from "../../../types/hex";
import { Position } from "../../../types/scenario";

// Allies: two infantry on the left flank (orderable with a LEFT card) and one on the right
const LEFT_A: Position = { row: 7, col: 1 };
const LEFT_B: Position = { row: 7, col: 3 };
const RIGHT: Position = { row: 8, col: 11 };

const makeSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 3, axis: 3 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 })],
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <OrdersView faction="Allies" session={session} game={game} />;
}

const setup = () => {
  const session = makeSession();
  const { container } = render(<Harness session={session} />);
  const hex = (p: Position) =>
    container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement;
  const tap = (p: Position) => fireEvent.click(hex(p));
  const isSelected = (p: Position) => hex(p).querySelector(".hexagon__tile--selected") !== null;
  const isFlashing = (p: Position) => hex(p).querySelector(".hexagon__flash-invalid") !== null;
  return { session, container, tap, isSelected, isFlashing };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OrdersView selecting units", () => {
  it("selects an orderable unit and deselects it when tapped again", () => {
    const { tap, isSelected } = setup();

    tap(LEFT_A);
    expect(isSelected(LEFT_A)).toBe(true);
    expect(screen.getByRole("button", { name: "Mantener y disparar" })).toBeInTheDocument();

    tap(LEFT_A);
    expect(isSelected(LEFT_A)).toBe(false);
    expect(screen.queryByRole("button", { name: "Mantener y disparar" })).not.toBeInTheDocument();
  });

  it("switches the selection when another orderable unit is tapped", () => {
    const { tap, isSelected } = setup();

    tap(LEFT_A);
    tap(LEFT_B);

    expect(isSelected(LEFT_A)).toBe(false);
    expect(isSelected(LEFT_B)).toBe(true);
  });

  it("cancels the selection with the Cancelar button", () => {
    const { tap, isSelected, session } = setup();

    tap(LEFT_A);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(isSelected(LEFT_A)).toBe(false);
    expect(session.getSnapshot().orders).toHaveLength(0);
  });
});

describe("OrdersView giving orders", () => {
  it("moves the selected unit to a highlighted hex and draws its arrow", () => {
    const { tap, session, container } = setup();

    tap(LEFT_A);
    tap({ row: 6, col: 1 });

    expect(session.getSnapshot().orders).toHaveLength(1);
    expect(session.board.getHex({ row: 6, col: 1 })!.hasUnit()).toBe(true);
    expect(container.querySelectorAll("g.order-arrow")).toHaveLength(1);
  });

  it("gives a hold-and-fire order from the button, with no arrow", () => {
    const { tap, session, container } = setup();

    tap(LEFT_A);
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));

    const [order] = session.getSnapshot().orders;
    expect(order!.start).toEqual(LEFT_A);
    expect(order!.end).toEqual(LEFT_A);
    expect(order!.canFire).toBe(true);
    expect(container.querySelector('[data-position="7-1"] .unit__badge--fire')).not.toBeNull();
    expect(container.querySelectorAll("g.order-arrow")).toHaveLength(0);
  });
});

describe("OrdersView invalid taps", () => {
  it("flashes a unit that can't be ordered, then clears the flash", () => {
    const { tap, isFlashing } = setup();

    tap(RIGHT);
    expect(isFlashing(RIGHT)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(INVALID_FLASH_MS);
    });
    expect(isFlashing(RIGHT)).toBe(false);
  });

  it("flashes a hex the selected unit can't reach and keeps the selection", () => {
    const { tap, isFlashing, isSelected, session } = setup();
    const outOfRange = { row: 2, col: 1 };

    tap(LEFT_A);
    tap(outOfRange);

    expect(isFlashing(outOfRange)).toBe(true);
    expect(isSelected(LEFT_A)).toBe(true);
    expect(session.getSnapshot().orders).toHaveLength(0);
  });

  it("ignores an empty hex when nothing is selected", () => {
    const { tap, isFlashing } = setup();
    const empty = { row: 2, col: 1 };

    tap(empty);

    expect(isFlashing(empty)).toBe(false);
  });
});

describe("OrdersView after committing", () => {
  it("locks the board and shows the confirmation", () => {
    const { tap, isSelected, container } = setup();
    for (const unit of [LEFT_A, LEFT_B]) {
      tap(unit);
      fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));
    }

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Órdenes" }));

    expect(container.querySelector(".board__svg--locked")).not.toBeNull();
    expect(container.querySelector(".board__stamp")).toHaveTextContent("Órdenes confirmadas");
    expect(screen.getByText(/Ya no se pueden cambiar/)).toBeInTheDocument();
    tap(LEFT_A);
    expect(isSelected(LEFT_A)).toBe(false);
    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument();
  });
});
