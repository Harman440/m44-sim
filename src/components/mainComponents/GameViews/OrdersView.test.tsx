import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersView from "./OrdersView";
import { INVALID_FLASH_MS } from "../../useHexFlash";
import GameSession from "../../../game-core/gameSession";
import { actionCardById } from "../../../data/actionCards";
import { Position } from "../../../types/scenario";
import { TurnPhase } from "../../../types/gameManager";
import { same } from "../../../i18n/lang";
import { DEFAULT_SETTINGS, SettingsContext } from "../../../settings";

// Allies: two infantry on the left flank and one on the right
const LEFT_A: Position = { row: 7, col: 1 };
const LEFT_B: Position = { row: 7, col: 3 };
const RIGHT: Position = { row: 8, col: 11 };

const makeSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: { es: "Test", en: "Test" },
      description: same(""),
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
    },
    faction: "Allies",
  });
  session.pickCard(null);
  return session;
};

function Harness({ session, handLeaving = false }: { session: GameSession; handLeaving?: boolean }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <OrdersView faction="Allies" session={session} game={game} handLeaving={handLeaving} />;
}

/** Pick one of the selected unit's actions from the list, by the start of its name */
const pickAction = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));

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

describe("OrdersView sandbags", () => {
  it("warns that a unit on sandbags loses them if it moves, and says so when it does", () => {
    const { session, tap } = setup();
    session.board.getHex(LEFT_A)!.setSandbags(true);

    tap(LEFT_A);
    pickAction("Asalto de Infantería");
    expect(screen.getByTestId("sandbags-warning")).toHaveTextContent("si se mueve, los pierde");
    tap({ row: 6, col: 1 });

    expect(session.board.getHex(LEFT_A)!.sandbags).toBe(false);
    expect(screen.getByTestId("sandbags-left")).toHaveTextContent("deja sus sacos terreros");
  });

  it("says nothing when the unit holds behind its sandbags", () => {
    const { session, tap } = setup();
    session.board.getHex(LEFT_A)!.setSandbags(true);

    tap(LEFT_A);
    pickAction("Escaramuza");

    expect(session.board.getHex(LEFT_A)!.sandbags).toBe(true);
    expect(screen.queryByTestId("sandbags-left")).not.toBeInTheDocument();
  });
});

describe("OrdersView selecting units", () => {
  it("selects an orderable unit and deselects it when tapped again", () => {
    const { tap, isSelected } = setup();

    tap(LEFT_A);
    expect(isSelected(LEFT_A)).toBe(true);
    expect(screen.getByRole("list", { name: "Acciones" })).toBeInTheDocument();

    tap(LEFT_A);
    expect(isSelected(LEFT_A)).toBe(false);
    expect(screen.queryByRole("list", { name: "Acciones" })).not.toBeInTheDocument();
  });

  it("lists the unit's actions with their cost, and its supplies", () => {
    const { tap } = setup();

    tap(LEFT_A);
    const actions = within(screen.getByRole("list", { name: "Acciones" }));
    expect(actions.getByRole("button", { name: /^Fortificar/ })).toHaveTextContent("2 energía + sacos terreros");
    expect(actions.getByRole("button", { name: /^Recargar/ })).toHaveTextContent("gratis");
    // Own tablets don't track morale
    expect(actions.queryByRole("button", { name: /^Subir la moral/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("unit-supplies")).toHaveTextContent("Moral 5 · Energía 5 · Munición 2");
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
  it("moves the selected unit to a highlighted hex with the action picked, and draws its arrow", () => {
    const { tap, session, container } = setup();

    tap(LEFT_A);
    tap({ row: 6, col: 1 }); // no action picked yet
    expect(session.getSnapshot().orders).toHaveLength(0);
    pickAction("Asalto de Infantería");
    tap({ row: 6, col: 1 });

    expect(session.getSnapshot().orders).toHaveLength(1);
    expect(session.getSnapshot().orders[0]!.action).toBe("infantry:assault");
    expect(session.board.getHex({ row: 6, col: 1 })!.hasUnit()).toBe(true);
    expect(container.querySelectorAll("g.order-arrow")).toHaveLength(1);
  });

  it("gives an action that doesn't move at once, with no arrow", () => {
    const { tap, session, container } = setup();

    tap(LEFT_A);
    pickAction("Escaramuza");

    const [order] = session.getSnapshot().orders;
    expect(order!.start).toEqual(LEFT_A);
    expect(order!.end).toEqual(LEFT_A);
    expect(order!.canFire).toBe(true);
    expect(container.querySelector('[data-unit-at="7-1"] .unit__badge--fire')).not.toBeNull();
    expect(container.querySelectorAll("g.order-arrow")).toHaveLength(0);
  });

  it("keeps a moving action's unit in its hex from the button, or goes back to the list", () => {
    const { tap, session } = setup();

    tap(LEFT_A);
    pickAction("En marcha");
    fireEvent.click(screen.getByRole("button", { name: "Otra acción" }));
    pickAction("Asalto de Infantería");
    fireEvent.click(screen.getByRole("button", { name: "Quedarse en su casilla y disparar" }));

    expect(session.getSnapshot().orders[0]).toMatchObject({ action: "infantry:assault", end: LEFT_A, shots: 1 });
  });

  it("changes the action of a unit that stays in its hex", () => {
    const { tap, session } = setup();
    tap(LEFT_A);
    pickAction("Escaramuza");

    tap(LEFT_A);
    expect(screen.getByText("Orden: Escaramuza")).toBeInTheDocument();
    pickAction("Fortificar");

    expect(session.getSnapshot().orders.map((order) => order.action)).toEqual(["infantry:fortify"]);
  });
});

describe("OrdersView invalid taps", () => {
  it("flashes a unit that can't be ordered (it moved with its order), then clears the flash", () => {
    const { tap, isFlashing } = setup();
    const moved = { row: 8, col: 10 };
    tap(RIGHT);
    pickAction("Asalto de Infantería");
    tap(moved);

    tap(moved);
    expect(isFlashing(moved)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(INVALID_FLASH_MS);
    });
    expect(isFlashing(moved)).toBe(false);
  });

  it("flashes a hex the selected unit can't reach and keeps the selection", () => {
    const { tap, isFlashing, isSelected, session } = setup();
    const outOfRange = { row: 2, col: 1 };

    tap(LEFT_A);
    pickAction("Asalto de Infantería");
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

describe("OrdersView confirming", () => {
  it("goes straight to the movement phase", () => {
    const { session, tap } = setup();
    for (const unit of [LEFT_A, LEFT_B]) {
      tap(unit);
      pickAction("Escaramuza");
    }

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Órdenes" }));

    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
  });
});

describe("OrdersView the card played", () => {
  /** The defender at turn 2, with plenty of supplies, playing this card */
  const withCard = (cardId: string, { handLeaving = false } = {}) => {
    const session = new GameSession({
      scenario: {
        id: "test",
        name: { es: "Test", en: "Test" },
        description: same(""),
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
      },
      faction: "Allies",
      testMode: true,
    });
    session.pickCard(actionCardById(cardId)!);
    const { container } = render(<Harness session={session} handLeaving={handLeaving} />);
    const tap = (p: Position) => fireEvent.click(container.querySelector(`[data-position="${p.row}-${p.col}"]`)!);
    return { session, container, tap };
  };

  it("shows the card being played at the top, its text a tap away", () => {
    withCard("resupply");

    const played = within(screen.getByTestId("played-cards"));
    fireEvent.click(played.getByRole("button", { name: /^Reabastecimiento/ }));
    expect(screen.getByRole("dialog", { name: "Carta jugada" })).toHaveTextContent("Toda tu infantería recupera su equipo");
  });

  it("slides the rest of the hand away just after the card was played", () => {
    withCard("resupply", { handLeaving: true });
    expect(screen.getByTestId("leaving-hand")).toBeInTheDocument();
  });

  it("lets any unit be ordered, and says how many rest", () => {
    const { tap } = withCard("resupply");
    expect(screen.getByText(/3 unidades sin orden \(descansan\)/)).toBeInTheDocument();

    tap(RIGHT);
    pickAction("Escaramuza");
    expect(screen.getByText(/2 unidades sin orden \(descansan\)/)).toBeInTheDocument();
  });

  it("marks the Barrage hex on the map before the orders can be confirmed", () => {
    const { session, container, tap } = withCard("barrage");
    expect(screen.queryByRole("button", { name: "Confirmar Órdenes" })).not.toBeInTheDocument();
    expect(screen.getByTestId("order-card-marks")).toHaveTextContent("Marca 1 casilla sin unidades tuyas. (0/1)");

    fireEvent.click(screen.getByRole("button", { name: "Marcar en el mapa" }));
    expect(container.querySelectorAll(".hexagon__tile--mark").length).toBeGreaterThan(0);
    tap(LEFT_B); // one of your units: not allowed
    expect(session.getSnapshot().markers).toEqual([]);
    tap({ row: 1, col: 10 });

    expect(session.getSnapshot().markers).toEqual([{ row: 1, col: 10 }]);
    expect(container.querySelector('[data-marker="1-10"]')).not.toBeNull();
    expect(container.querySelectorAll(".hexagon__tile--mark")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Borrar última marca" }));
    expect(session.getSnapshot().markers).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Marcar en el mapa" }));
    tap({ row: 1, col: 10 });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Órdenes" }));
    expect(session.getSnapshot().phase).toBe(TurnPhase.MOVEMENT);
  });
});

describe("OrdersView changing the card", () => {
  it("goes back to the cards until an order is given", () => {
    const { tap, session } = setup();
    expect(screen.getByRole("button", { name: "Cambiar carta" })).toBeInTheDocument();

    tap(LEFT_A);
    pickAction("Escaramuza");
    expect(screen.queryByRole("button", { name: "Cambiar carta" })).not.toBeInTheDocument();

    act(() => {
      session.undoLastOrder();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar carta" }));
    expect(session.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
  });
});

describe("OrdersView fixing the map", () => {
  it("updates the map before any order, only after confirming, and hides it once an order is given", () => {
    const { tap, session } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar mapa" }));
    expect(screen.getByRole("dialog", { name: "¿Actualizar el mapa?" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Actualizar mapa" }).at(-1)!);
    act(() => vi.runAllTimers());

    tap(RIGHT);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar unidad" }));
    expect(session.board.getHex(RIGHT)!.hasUnit()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    tap(LEFT_A);
    pickAction("Escaramuza");
    expect(screen.queryByRole("button", { name: "Actualizar mapa" })).not.toBeInTheDocument();
  });
});

describe("OrdersView unit list", () => {
  const rows = () => screen.getAllByTestId("unit-row");

  it("lists every unit with its supplies and luck, resting until it gets an action", () => {
    const { tap } = setup();

    expect(rows()).toHaveLength(3);
    expect(rows()[0]).toHaveTextContent("Descansa");
    expect(within(rows()[0]!).getByRole("img", { name: "Munición: 2" })).toBeInTheDocument();
    expect(within(rows()[0]!).getByRole("img", { name: "Suerte 0" })).toBeInTheDocument();

    tap(LEFT_A);
    pickAction("Escaramuza");
    expect(rows()[0]).toHaveTextContent("Escaramuza");
  });

  it("picks the unit of a row tapped, highlighting the row, as tapping it on the map does", () => {
    const { tap, isSelected } = setup();

    fireEvent.click(rows()[1]!);
    expect(isSelected(LEFT_B)).toBe(true);
    expect(screen.getByRole("list", { name: "Acciones" })).toBeInTheDocument();
    expect(rows()[1]).toHaveClass("Mui-selected");

    tap(RIGHT);
    expect(rows()[2]).toHaveClass("Mui-selected");
    expect(rows()[1]).not.toHaveClass("Mui-selected");
  });

  it("only shows the unit of a row that can't be ordered any more", () => {
    const { tap, isSelected } = setup();
    tap(LEFT_A);
    pickAction("Asalto de Infantería");
    tap({ row: 6, col: 1 });

    const moved = rows().find((row) => row.textContent?.includes("Asalto de Infantería"))!;
    fireEvent.click(moved);
    expect(isSelected({ row: 6, col: 1 })).toBe(false);
    expect(screen.queryByRole("list", { name: "Acciones" })).not.toBeInTheDocument();
  });

  it("speaks English", () => {
    const session = makeSession();
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <Harness session={session} />
      </SettingsContext.Provider>
    );
    expect(screen.getByRole("list", { name: "Your units" })).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Rests");
    expect(within(rows()[0]!).getByRole("img", { name: "Energy: 5" })).toBeInTheDocument();
  });
});
