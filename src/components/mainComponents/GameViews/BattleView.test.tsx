import { UnitType } from "../../../game-core/unit";
import { shoot } from "../../../test/shots";
import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BattleView from "./BattleView";
import GameSession from "../../../game-core/gameSession";
import { actionCardById } from "../../../data/actionCards";
import { Position } from "../../../types/scenario";
import { samePosition } from "../../../game-core/position";
import { same } from "../../../i18n/lang";

/** Tap a hex on the fire dialog's map */
const aimAt = (p: Position) =>
  fireEvent.click(document.querySelector(`[data-testid="fire-map"] [data-position="${p.row}-${p.col}"]`)!);

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { infantry: true, closeAssault: false };

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };
const EMPTY: Position = { row: 2, col: 2 };
const TANK_MOVED: Position = { row: 5, col: 3 };

// A session already in the battle phase, with both units given hold orders (or the tank moving)
const makeBattleSession = ({ moveTank = false } = {}) => {
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
  if (!session.issueOrder(TANK, moveTank ? TANK_MOVED : TANK)) throw new Error("Tank order failed");
  session.commitOrders();
  session.startBattle();
  return session;
};

function Harness({ session, onEndBattle }: { session: GameSession; onEndBattle: () => void }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <BattleView faction="Allies" session={session} game={game} onEndBattle={onEndBattle} onShowCoins={() => {}} />;
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
    // Where it is, as its hex, not how far it moved
    expect(within(rows[0]!).getByRole("img", { name: "Llanura" })).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("Disparar ›");
    expect(rows[1]).toHaveTextContent("Tanque");
    // No card was played: the side panel says so
    expect(screen.getByTestId("battle-card")).toHaveTextContent("No jugaste carta este turno.");
    expect(screen.getByTestId("fire-count")).toHaveTextContent(
      "2 por disparar · 0 dispararon · 0 no pueden disparar"
    );
    expect(screen.queryByText("Tirada libre")).not.toBeInTheDocument();
  });

  it("opens the map on demand, with no card shown when none was played, and comes back to the summary", () => {
    const { container } = setup({ openMap: false });

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    expect(container.querySelector("svg.board__svg")).not.toBeNull();
    expect(screen.queryByTestId("played-cards")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a la batalla" }));
    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.getAllByTestId("order-summary")).toHaveLength(2);
  });

  it("marks a unit that fired, keeps its roll after a trip to the map and won't fire it again", () => {
    const { session } = setup({ openMap: false });
    fireEvent.click(screen.getAllByRole("button", { name: /^Disparar con/ })[1]!);
    aimAt({ row: 5, col: 3 }); // 2 hexes up from the tank
    fireEvent.click(screen.getByRole("button", { name: "Infantería" }));
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados");
    fireEvent.click(screen.getByRole("button", { name: "Disparar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver a la batalla" }));

    const tankRow = screen.getAllByTestId("order-summary")[1]!;
    expect(tankRow).toHaveTextContent(/Disparó: \d × /);
    expect(screen.getByTestId("fire-count")).toHaveTextContent("1 por disparar · 1 disparó");
    fireEvent.click(screen.getByRole("button", { name: "Ver tirada de Tanque" }));
    expect(screen.getByTestId("dice-result")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Disparar \d/ })).not.toBeInTheDocument();
    expect(session.getSnapshot().shots).toHaveLength(1);
  });

  it("opens the fire map from a unit that can fire", () => {
    setup({ openMap: false });

    fireEvent.click(screen.getAllByRole("button", { name: /^Disparar con/ })[1]!);

    expect(screen.getByRole("dialog")).toHaveTextContent("Disparo: Tanque");
    expect(screen.getByTestId("fire-map")).toBeInTheDocument();
    expect(screen.getByText("Toca una casilla en el mapa.")).toBeInTheDocument();
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
    shoot(session, 0, AT_INFANTRY);
    shoot(session, 1, AT_INFANTRY);

    fireEvent.click(screen.getByRole("button", { name: "Terminar batalla" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("No se puede deshacer.");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Terminar batalla" }));

    expect(onEndBattle).toHaveBeenCalledTimes(1);
  });
});

describe("BattleView firing order", () => {
  it("says who fires first, in short, and in full in the instructions", async () => {
    setup({ openMap: false });

    expect(screen.getByTestId("fire-order")).toHaveTextContent("Atacante: disparas tú primero");
    fireEvent.click(screen.getByTestId("fire-order"));
    expect(screen.getByTestId("fire-order-rule")).toHaveTextContent("Eres el bando atacante: disparas primero.");
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Instrucciones" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Cómo se juega la batalla");
    expect(screen.getByTestId("take-ground-rule")).toHaveTextContent("La infantería no toma terreno.");
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
    expect(within(moved).queryByRole("button", { name: /^Disparar con/ })).not.toBeInTheDocument();
  });

  it("lets the moved units fire once the units that didn't move have fired", () => {
    const { session } = setup({ openMap: false, moveTank: true });

    act(() => {
      shoot(session, 0, AT_INFANTRY);
    });

    const moved = screen.getByTestId("group-moved");
    expect(within(moved).getByRole("button", { name: /^Disparar con/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pasar a las movidas" })).not.toBeInTheDocument();
  });

  it("skips the unfired units that didn't move, after confirming", async () => {
    const { session } = setup({ openMap: false, moveTank: true });

    fireEvent.click(screen.getByRole("button", { name: "Pasar a las movidas" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("La unidad sin mover que no ha disparado pierde el disparo.");
    fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(session.getSnapshot().unmovedFireSkipped).toBe(true);
    expect(within(screen.getByTestId("group-unmoved")).getByText("Sin disparo")).toBeInTheDocument();
    expect(within(screen.getByTestId("group-moved")).getByRole("button", { name: /^Disparar con/ })).toBeInTheDocument();
  });

  it("tells the player the opponent fires next after a roll", () => {
    setup({ openMap: false });

    fireEvent.click(screen.getAllByRole("button", { name: /^Disparar con/ })[0]!);
    aimAt({ row: 6, col: 1 }); // next to the infantry
    fireEvent.click(screen.getByRole("button", { name: "Infantería" }));
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados");
    fireEvent.click(screen.getByRole("button", { name: "Disparar" }));

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

describe("BattleView command card played", () => {
  /** The defender at turn 2 with plenty of supplies, the card played (and its hex marked), in the battle */
  const cardSetup = (cardId: string | null, moveInfantry = false) => {
    const session = new GameSession({
      scenario: {
        id: "test",
        name: { es: "Test", en: "Test" },
        description: same(""),
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
      },
      faction: "Allies",
      testMode: true,
      random: () => 0.7, // supplies
    });
    expect(session.pickCard(cardId ? actionCardById(cardId)! : null)).toBe(true);
    if (session.getSnapshot().marking) session.markHex({ row: 1, col: 10 });
    session.issueOrder(INFANTRY, moveInfantry ? session.getMoveOptions(INFANTRY)!.moveAndFire[0]! : INFANTRY);
    session.issueOrder(TANK, TANK);
    session.commitOrders();
    session.startBattle();
    render(<Harness session={session} onEndBattle={() => {}} />);
    return session;
  };

  it("shows the card played with the orders, read-only, and says when none was", async () => {
    cardSetup("finest-hour");
    const section = screen.getByTestId("battle-card");
    fireEvent.click(within(section).getByRole("button", { name: /La Hora de la Verdad/ }));
    const dialog = screen.getByRole("dialog", { name: "Carta jugada" });
    expect(dialog).toHaveTextContent("todas tus unidades tiran 1 dado más");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Carta jugada" })).not.toBeInTheDocument());
  });

  it("says when no card was played", () => {
    cardSetup(null);
    expect(screen.getByTestId("battle-card")).toHaveTextContent("No jugaste carta este turno.");
  });

  it("rolls the attack card on each marked hex before the units can fire", () => {
    const session = cardSetup("barrage");
    const section = screen.getByTestId("card-attacks");
    expect(section).toHaveTextContent("Tira primero en cada casilla marcada");
    expect(screen.queryByRole("button", { name: /^Disparar con/ })).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole("button", { name: "Tirar casilla 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Blindados o artillería" }));
    fireEvent.click(screen.getByRole("button", { name: "Tirar 4 dados" }));

    expect(session.getSnapshot().cardAttacks[0]).toMatchObject({ dice: 4 });
    expect(screen.getByTestId("roll-hits")).toHaveTextContent("4");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(section).toHaveTextContent("Ataques resueltos.");
    expect(screen.getAllByRole("button", { name: /^Disparar con/ }).length).toBeGreaterThan(0);
  });

  it("adds Finest Hour's die to every shot, with nothing to answer", async () => {
    const session = cardSetup("finest-hour");
    fireEvent.click(screen.getAllByRole("button", { name: /^Disparar con/ })[0]!);

    fireEvent.click(document.querySelector('[data-testid="fire-map"] [data-position="5-1"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Infantería" }));

    fireEvent.click(screen.getByRole("button", { name: "Información: De dónde salen los dados" }));
    expect(screen.getByTestId("fire-breakdown")).toHaveTextContent("Carta La Hora de la Verdad+1");
    fireEvent.click(within(screen.getByRole("dialog", { name: "De dónde salen los dados" })).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByTestId("fire-breakdown")).not.toBeInTheDocument());
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados");
    fireEvent.click(screen.getByRole("button", { name: "Disparar" }));
    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 3, combatBonus: true });
  });
});

describe("BattleView changes this turn", () => {
  it("shows the ammo a unit spent and its luck in its row, and on the map", () => {
    const { session } = setup({ openMap: false });
    expect(screen.queryByTestId("unit-changes")).not.toBeInTheDocument();
    act(() => {
      shoot(session, 0, AT_INFANTRY);
    });

    const [infantry] = screen.getAllByTestId("order-summary");
    // In the row's button, whose label is what's read out: the chips are there to be seen
    expect(within(infantry!).getByTestId("unit-changes")).toHaveTextContent("−1");

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    expect(screen.getAllByTestId("change-pill")).toHaveLength(1);
  });
});
