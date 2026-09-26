import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BattleView from "./BattleView";
import GameSession from "../../../game-core/gameSession";
import CommandCard, { CommandCardType } from "../../../game-core/commandCard";
import { Position } from "../../../types/scenario";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };
const EMPTY: Position = { row: 2, col: 2 };
const TANK_MOVED: Position = { row: 5, col: 3 };

// A session already in the battle phase, with both units given hold orders (or the tank moving)
const makeBattleSession = ({ moveTank = false } = {}) => {
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
    commandCards: [new CommandCard({ id: "left", type: CommandCardType.LEFT, maxTotalOrders: 2 })],
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  session.issueOrder(INFANTRY, INFANTRY);
  if (!session.issueOrder(TANK, moveTank ? TANK_MOVED : TANK)) throw new Error("Tank order failed");
  session.commitOrders();
  session.startMovement();
  session.startBattle();
  return session;
};

function Harness({ session, onEndBattle }: { session: GameSession; onEndBattle: () => void }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <BattleView faction="Allies" session={session} game={game} onEndBattle={onEndBattle} />;
}

const setup = ({ openMap = true, moveTank = false } = {}) => {
  const session = makeBattleSession({ moveTank });
  const onEndBattle = vi.fn();
  const { container } = render(<Harness session={session} onEndBattle={onEndBattle} />);
  if (openMap) fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
  const hex = (p: Position) =>
    container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement;
  const tap = (p: Position) => fireEvent.click(hex(p));
  const isSelected = (p: Position) => hex(p).querySelector(".hexagon__tile--selected") !== null;
  const hasUnit = (p: Position) => session.board.getHex(p)!.hasUnit();
  return { session, container, onEndBattle, tap, isSelected, hasUnit };
};

describe("BattleView summary screen", () => {
  it("hides the map and summarises the turn's orders", () => {
    const { container } = setup({ openMap: false });

    expect(container.querySelector("svg.board__svg")).toBeNull();
    const rows = screen.getAllByTestId("order-summary");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Infantería");
    expect(rows[0]).toHaveTextContent("Mantiene posición");
    expect(rows[0]).toHaveTextContent("Dispara");
    expect(rows[1]).toHaveTextContent("Tanque");
    expect(screen.getByTestId("fire-count")).toHaveTextContent(
      "2 por disparar · 0 dispararon · 0 no pueden disparar"
    );
    expect(screen.queryByText("Tirada libre")).not.toBeInTheDocument();
  });

  it("opens the map on demand and comes back to the summary", () => {
    const { container } = setup({ openMap: false });

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    expect(container.querySelector("svg.board__svg")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Volver al resumen" }));
    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.getAllByTestId("order-summary")).toHaveLength(2);
  });

  it("marks a unit that fired, keeps its roll after a trip to the map and won't fire it again", () => {
    const { session } = setup({ openMap: false });
    fireEvent.click(screen.getAllByRole("button", { name: "Disparar" })[1]!);
    fireEvent.click(screen.getByRole("button", { name: /Tirada rápida/ }));
    fireEvent.click(screen.getByRole("button", { name: "Disparar 3 dados" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al resumen" }));

    const tankRow = screen.getAllByTestId("order-summary")[1]!;
    expect(tankRow).toHaveTextContent(/Disparó: \d × /);
    expect(screen.getByTestId("fire-count")).toHaveTextContent("1 por disparar · 1 disparó");
    fireEvent.click(screen.getByRole("button", { name: "Ver tirada" }));
    expect(screen.getByTestId("dice-result")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Disparar/ })).not.toBeInTheDocument();
    expect(session.getSnapshot().shots).toHaveLength(1);
  });

  it("opens the fire questionnaire from a unit that can fire", () => {
    setup({ openMap: false });

    fireEvent.click(screen.getAllByRole("button", { name: "Disparar" })[1]!);

    expect(screen.getByRole("dialog")).toHaveTextContent("Disparo: Tanque");
    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
  });

  it("asks before ending the battle and warns about units that haven't fired", async () => {
    const { onEndBattle } = setup({ openMap: false });

    fireEvent.click(screen.getByRole("button", { name: "Terminar batalla" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Quedan 2 unidades sin disparar");
    fireEvent.click(screen.getByRole("button", { name: "Seguir en batalla" }));
    expect(onEndBattle).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Terminar batalla" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminar igualmente" }));
    expect(onEndBattle).toHaveBeenCalledTimes(1);
  });

  it("just confirms the end of the battle once every unit has fired", () => {
    const { session, onEndBattle } = setup({ openMap: false });
    session.fireQuick(0, 1);
    session.fireQuick(1, 1);

    fireEvent.click(screen.getByRole("button", { name: "Terminar batalla" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("No se puede deshacer.");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Terminar batalla" }));

    expect(onEndBattle).toHaveBeenCalledTimes(1);
  });
});

describe("BattleView firing order", () => {
  it("says who fires first", () => {
    setup({ openMap: false });

    expect(screen.getByTestId("fire-order")).toHaveTextContent("Eres el bando atacante: disparas primero.");
  });

  it("groups the units that didn't move, which fire first, and the units that moved", () => {
    setup({ openMap: false, moveTank: true });

    const unmoved = screen.getByTestId("group-unmoved");
    const moved = screen.getByTestId("group-moved");
    expect(unmoved).toHaveTextContent("Sin mover");
    expect(unmoved).toHaveTextContent("Infantería");
    expect(moved).toHaveTextContent("Movidas");
    expect(moved).toHaveTextContent("Tanque");
    expect(within(moved).getByText("Espera")).toBeInTheDocument();
    expect(within(moved).queryByRole("button", { name: "Disparar" })).not.toBeInTheDocument();
  });

  it("lets the moved units fire once the units that didn't move have fired", () => {
    const { session } = setup({ openMap: false, moveTank: true });

    act(() => {
      session.fireQuick(0, 1);
    });

    const moved = screen.getByTestId("group-moved");
    expect(within(moved).getByRole("button", { name: "Disparar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pasar a las unidades movidas" })).not.toBeInTheDocument();
  });

  it("skips the unfired units that didn't move, after confirming", async () => {
    const { session } = setup({ openMap: false, moveTank: true });

    fireEvent.click(screen.getByRole("button", { name: "Pasar a las unidades movidas" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("La unidad sin mover que no ha disparado pierde el disparo.");
    fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(session.getSnapshot().unmovedFireSkipped).toBe(true);
    expect(within(screen.getByTestId("group-unmoved")).getByText("Sin disparo")).toBeInTheDocument();
    expect(within(screen.getByTestId("group-moved")).getByRole("button", { name: "Disparar" })).toBeInTheDocument();
  });

  it("tells the player the opponent fires next after a roll", () => {
    setup({ openMap: false });

    fireEvent.click(screen.getAllByRole("button", { name: "Disparar" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Tirada rápida/ }));
    fireEvent.click(screen.getByRole("button", { name: "Disparar 3 dados" }));

    expect(screen.getByTestId("opponent-turn")).toHaveTextContent("Ahora dispara el rival.");
  });
});

describe("BattleView map", () => {
  it("is read-only: tapping a unit selects nothing and offers no edits", () => {
    const { tap, isSelected, session } = setup();

    tap(TANK);
    tap(EMPTY);

    expect(isSelected(TANK)).toBe(false);
    expect(screen.queryByRole("button", { name: "Eliminar unidad" })).not.toBeInTheDocument();
    expect(session.board.getHex(TANK)!.hasUnit()).toBe(true);
    expect(session.getSnapshot().battleEdits).toBe(0);
  });

  it("finishes the battle from the map, after confirming", () => {
    const { onEndBattle } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Terminar batalla" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminar igualmente" }));

    expect(onEndBattle).toHaveBeenCalledTimes(1);
  });
});
