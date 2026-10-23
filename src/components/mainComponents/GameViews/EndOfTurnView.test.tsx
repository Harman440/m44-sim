import { useSyncExternalStore } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EndOfTurnView from "./EndOfTurnView";
import GameSession from "../../../game-core/gameSession";
import { actionCardById } from "../../../data/actionCards";
import { Position } from "../../../types/scenario";
import { UnitType } from "../../../game-core/unit";
import { same } from "../../../i18n/lang";
import { OpponentContext } from "../../OpponentContext";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };
const EMPTY: Position = { row: 2, col: 2 };

// A session in the final phase, after a battle where both units held
const makeFinalSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: { es: "Test", en: "Test" },
      description: same(""),
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
    },
    faction: "Allies",
  });
  session.pickCard(null);
  session.issueOrder(INFANTRY, INFANTRY);
  session.issueOrder(TANK, TANK);
  session.commitOrders();
  session.startBattle();
  session.endBattle();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <EndOfTurnView faction="Allies" session={session} game={game} onEndTurn={() => session.endTurn()} />;
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

describe("EndOfTurnView in pass and play", () => {
  it("has no retreats step: the map, and the steps beside it", () => {
    const session = makeFinalSession();
    const shared = {
      opponent: { faction: "Axis" as const, units: [], orders: [], fired: [], toFire: [], camouflaged: [], sandbags: [] },
      strength: [],
    };
    render(
      <OpponentContext.Provider value={shared}>
        <Harness session={session} />
      </OpponentContext.Provider>
    );
    expect(screen.queryByText("1. Retiradas y bajas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar mapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fase final" })).not.toBeInTheDocument();
    expect(screen.getByTestId("large-map")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tus cartas" })).toBeInTheDocument();
  });
});

describe("EndOfTurnView map", () => {
  it("puts no sandbags on this side's units without Fortify", () => {
    const { tap } = setup();

    tap(INFANTRY);
    expect(screen.queryByRole("button", { name: /poner sacos terreros/i })).not.toBeInTheDocument();
  });

  it("opens the map from the retreats step and counts the changes when back", () => {
    const { container, tap } = setup({ openMap: false });
    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.queryByTestId("map-edits")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar mapa" }));
    tap(INFANTRY);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar unidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.getByTestId("map-edits")).toHaveTextContent("1 cambio");
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

describe("EndOfTurnView cards", () => {
  it("holds every card at the bottom, draws none, and shows a card's full text when it is tapped", () => {
    const session = makeFinalSession();
    render(<Harness session={session} />);

    const hand = screen.getByRole("list", { name: "Tu mano" });
    expect(hand.querySelectorAll("[data-card-key]")).toHaveLength(session.cards.length);
    expect(screen.getByTestId("end-of-turn-cards")).toHaveTextContent("No se roba ninguna carta");
    fireEvent.click(within(hand.querySelector('[data-card-key="resupply"]') as HTMLElement).getByRole("button", { name: /Reabastecimiento/ }));

    expect(screen.getByRole("dialog", { name: "Carta" })).toBeInTheDocument();
    expect(screen.getByTestId("card-details")).toBeInTheDocument();
  });

  it("starts the next turn straight away", () => {
    const session = makeFinalSession();
    render(<Harness session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Empezar turno 2" }));
    expect(session.getSnapshot().turn).toBe(2);
  });
});

describe("EndOfTurnView Reinforcements", () => {
  it("says the infantry arrived on the cross, with no die to roll", () => {
    const session = new GameSession({
      scenario: {
        id: "test",
        name: { es: "Test", en: "Test" },
        description: same(""),
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [INFANTRY] }, axis: {} },
      },
      faction: "Allies",
      testMode: true,
    });
    session.pickCard(actionCardById("reinforcements")!);
    session.markHex(EMPTY);
    session.issueOrder(INFANTRY, INFANTRY);
    session.commitOrders();
    session.startBattle();
    session.endBattle();
    render(<Harness session={session} />);

    expect(screen.getByTestId("reinforcements")).toHaveTextContent(
      "Refuerzos: llega infantería, ya en el mapa. Ponla en la mesa en la casilla de la cruz."
    );
    expect(screen.queryByRole("button", { name: /dado/ })).not.toBeInTheDocument();
    expect(session.board.getHex(EMPTY)!.unit!.getUnitType()).toBe(UnitType.INFANTRY);
  });
});

describe("EndOfTurnView next turn", () => {
  it("says what comes back as the next turn starts: the energy, by how much", () => {
    setup({ openMap: false });
    const summary = screen.getByTestId("turn-end-summary");
    expect(summary).toHaveTextContent("Al empezar el turno 2");
    // The infantry was given an action (Firefight, 1 energy): 1 back; the tank has no energy
    expect(summary).toHaveTextContent("+1 de energía: 1 unidad");
    expect(within(summary).queryByTestId("cards-back")).not.toBeInTheDocument();
  });
});
