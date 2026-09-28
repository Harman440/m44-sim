import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrdersView from "./OrdersView";
import { INVALID_FLASH_MS } from "../../useHexFlash";
import GameSession from "../../../game-core/gameSession";
import CommandCard, { CommandCardProps } from "../../../game-core/commandCard";
import { CombatCard } from "../../../game-core/combatCard";
import { Side } from "../../../types/hex";
import { UnitType } from "../../../game-core/unit";
import { Position } from "../../../types/scenario";
import { TurnPhase } from "../../../types/gameManager";

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

describe("OrdersView card rules", () => {
  const withCard = (props: CommandCardProps) => {
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Allies",
        tiles: {},
        units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [new CommandCard({ id: "card", name: "Carta", description: "Texto de la carta.", ...props })],
    });
    session.pickCard(session.getSnapshot().hand[0]!);
    const { container } = render(<Harness session={session} />);
    const tap = (p: Position) =>
      fireEvent.click(container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement);
    return { session, tap };
  };

  it("shows the card being played", () => {
    withCard({ sections: [Side.LEFT], orders: 2 });

    expect(screen.getByText(/Texto de la carta\./)).toBeInTheDocument();
  });

  it("asks which section's order a border unit takes before ordering it", () => {
    // LEFT_B is on the left-center border; the card has 1 order per section
    const { session, tap } = withCard({ orders: 3, perSection: 1 });

    tap(LEFT_B);
    expect(screen.getByText("¿Qué orden usa esta unidad?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));
    expect(session.getSnapshot().orders).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Orden del centro" }));
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));
    expect(session.getSnapshot().orders[0]!.section).toBe(Side.CENTER);
  });

  it("orders a unit elsewhere on the move, which can't fire", () => {
    const { session, tap } = withCard({ sections: [Side.LEFT], orders: 1, onTheMove: 1 });

    tap(RIGHT);
    expect(screen.getByText("Mueve hasta 2 casillas; no puede disparar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mantener (no dispara)" }));

    expect(session.getSnapshot().orders[0]).toMatchObject({ onTheMove: true, shots: 0 });
  });

  it("lets a unit that could take either be put on the move instead", () => {
    const { session, tap } = withCard({ sections: [Side.LEFT], orders: 1, onTheMove: 1 });

    tap(LEFT_A);
    fireEvent.click(screen.getByRole("button", { name: "En movimiento (no dispara)" }));
    fireEvent.click(screen.getByRole("button", { name: "Mantener (no dispara)" }));

    expect(session.getSnapshot().orders[0]!.onTheMove).toBe(true);
  });

  it("says how many times a unit that holds fires", () => {
    const { tap } = withCard({ orders: 1, holdShots: 2 });

    tap(LEFT_A);

    expect(screen.getByRole("button", { name: "Mantener y disparar 2 veces" })).toBeInTheDocument();
  });

  it("explains a Close Assault card, which gives no orders", () => {
    withCard({ closeAssaultOnly: true });

    expect(screen.getByText(/Esta carta no da órdenes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar Órdenes" })).toBeInTheDocument();
  });
});

describe("OrdersView orders paid in coins", () => {
  // The defender at turn 2 (no extra turn) with `coins`, playing `props`
  const withCoins = (coins: number, props: CommandCardProps) => {
    const card = new CommandCard({ id: "card", name: "Carta", ...props });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
    });
    session.startFirstTurn();
    session.adjustCoins(coins);
    session.pickCard(card);
    const { container } = render(<Harness session={session} />);
    const tap = (p: Position) => fireEvent.click(container.querySelector(`[data-position="${p.row}-${p.col}"]`)!);
    return { session, tap };
  };

  it("buys an extra order for any unit with 4 coins", () => {
    const { session, tap } = withCoins(4, { sections: [Side.LEFT], orders: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Orden extra (4 monedas)" }));
    expect(screen.getByText(/toca cualquier unidad sin orden/)).toBeInTheDocument();
    tap(RIGHT);
    expect(screen.getByText(/cuesta 4 monedas y no tiene las ventajas de la carta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));

    expect(session.getSnapshot().orders[0]).toMatchObject({ extra: true, cost: 4 });
    expect(session.getSnapshot().coins).toBe(0);
    expect(screen.queryByRole("button", { name: "Orden extra (4 monedas)" })).not.toBeInTheDocument();
  });

  it("hides the extra order without 4 coins", () => {
    withCoins(3, { sections: [Side.LEFT], orders: 1 });

    expect(screen.queryByRole("button", { name: "Orden extra (4 monedas)" })).not.toBeInTheDocument();
  });

  it("lets a card paid in coins be confirmed with the orders the player wants to pay", () => {
    const { session, tap } = withCoins(1, { orders: 4, coinCost: { [UnitType.INFANTRY]: 1 } });
    expect(screen.getByText(/Cada orden de la carta cuesta monedas \(infantería 1\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar Órdenes" })).toBeInTheDocument();

    tap(LEFT_A);
    expect(screen.getByText("Esta orden cuesta 1 moneda")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));

    expect(session.getSnapshot().coins).toBe(0);
    expect(screen.getByText(/No te llega para más órdenes de la carta/)).toBeInTheDocument();
  });
});

describe("OrdersView combat card markers", () => {
  it("marks the Barrage hex on the map before the orders can be confirmed", () => {
    const barrage: CombatCard = {
      id: "barrage",
      name: "Barrera",
      description: "4 dados.",
      cost: 0,
      phase: "order",
      marker: { kind: "target", count: 1 },
    };
    const card = new CommandCard({ id: "card", name: "Carta", sections: [Side.LEFT], orders: 1 });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
      combatCards: [barrage],
    });
    session.startFirstTurn();
    session.pickCard(card, undefined, barrage);
    session.issueOrder(LEFT_A, LEFT_A);
    const { container } = render(<Harness session={session} />);
    const tap = (p: Position) => fireEvent.click(container.querySelector(`[data-position="${p.row}-${p.col}"]`)!);
    expect(screen.queryByRole("button", { name: "Confirmar Órdenes" })).not.toBeInTheDocument();
    expect(screen.getByTestId("order-combat-card")).toHaveTextContent("Marca 1 casilla sin unidades tuyas. (0/1)");

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
    expect(screen.getByRole("button", { name: "Dejar de marcar" })).toBeInTheDocument(); // still marking
    tap({ row: 1, col: 10 });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Órdenes" }));
    expect(session.getSnapshot().ordersCommitted).toBe(true);
  });
});

describe("OrdersView Reinforcements card", () => {
  it("shows the map's table of which unit each die face brings", () => {
    const reinforcements: CombatCard = {
      id: "reinforcements",
      name: "Refuerzos",
      description: "Tira 1 dado.",
      cost: 0,
      phase: "order",
      marker: { kind: "cross", count: 1 },
      effect: { kind: "reinforcements" },
    };
    const card = new CommandCard({ id: "card", name: "Carta", sections: [Side.LEFT], orders: 1 });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [LEFT_A] }, axis: {} },
        reinforcements: { infantry: UnitType.INFANTRY, tank: UnitType.TANK, grenade: UnitType.TANK, star: UnitType.ARTILLERY, flag: null },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
      combatCards: [reinforcements],
    });
    session.startFirstTurn();
    session.pickCard(card, undefined, reinforcements);
    render(<Harness session={session} />);

    expect(screen.getByTestId("reinforcements-table")).toHaveTextContent(
      "Infantería → infantería · Tanque → tanque · Granada → tanque · Estrella → artillería · Bandera → sin refuerzos"
    );
  });
});

describe("OrdersView movement combat cards", () => {
  it("lets the player use the card's movement on a unit, as many times as it allows", () => {
    const frozen: CombatCard = {
      id: "frozen",
      name: "Terreno helado",
      description: "",
      cost: 0,
      phase: "order",
      effect: { kind: "move", units: 1, moveBonus: 1 },
    };
    const card = new CommandCard({ id: "card", name: "Carta", sections: [Side.LEFT], orders: 2 });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [LEFT_A, LEFT_B, RIGHT] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
      combatCards: [frozen],
    });
    session.startFirstTurn();
    session.pickCard(card, undefined, frozen);
    const { container } = render(<Harness session={session} />);
    const tap = (p: Position) => fireEvent.click(container.querySelector(`[data-position="${p.row}-${p.col}"]`)!);

    tap(LEFT_A);
    const toggle = screen.getByRole("button", { name: /Usar Terreno helado \(queda 1\)/ });
    const movesBefore = container.querySelectorAll(".hexagon__tile--move, .hexagon__tile--move-and-fire").length;
    fireEvent.click(toggle);
    expect(container.querySelectorAll(".hexagon__tile--move, .hexagon__tile--move-and-fire").length).toBeGreaterThan(movesBefore);
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));

    expect(session.getSnapshot().orders[0]!.boosted).toBe(true);
    tap(LEFT_B);
    expect(screen.queryByRole("button", { name: /Usar Terreno helado/ })).not.toBeInTheDocument();
  });
});

describe("OrdersView changing the card", () => {
  it("goes back to the cards until an order is given", () => {
    const { tap, session } = setup();
    expect(screen.getByRole("button", { name: "Cambiar carta" })).toBeInTheDocument();

    tap(LEFT_A);
    fireEvent.click(screen.getByRole("button", { name: "Mantener y disparar" }));
    expect(screen.queryByRole("button", { name: "Cambiar carta" })).not.toBeInTheDocument();

    act(() => {
      session.undoLastOrder();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar carta" }));
    expect(session.getSnapshot().phase).toBe(TurnPhase.PICK_CARDS);
  });
});
