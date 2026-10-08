import { UnitType } from "../../../game-core/unit";
import { shoot } from "../../../test/shots";
import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BattleView from "./BattleView";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { CombatCard } from "../../../game-core/combatCard";
import { Side } from "../../../types/hex";
import { Position } from "../../../types/scenario";
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
      name: "Test",
      description: same(""),
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
    // Where it is, as icons, not how far it moved
    expect(within(rows[0]!).getByRole("img", { name: "Llanura" })).toBeInTheDocument();
    expect(within(rows[0]!).getByRole("img", { name: "Izquierda" })).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("Disparar ›");
    expect(rows[1]).toHaveTextContent("Tanque");
    // No command card summary on the battle screen
    expect(screen.queryByText(/Carta jugada/)).not.toBeInTheDocument();
    expect(screen.getByTestId("fire-count")).toHaveTextContent(
      "2 por disparar · 0 dispararon · 0 no pueden disparar"
    );
    expect(screen.queryByText("Tirada libre")).not.toBeInTheDocument();
  });

  it("opens the map on demand, with the card played, and comes back to the summary", () => {
    const { container, session } = setup({ openMap: false });

    fireEvent.click(screen.getByRole("button", { name: "Ver mapa" }));
    expect(container.querySelector("svg.board__svg")).not.toBeNull();
    const played = within(screen.getByTestId("played-cards"));
    expect(played.getByRole("button", { name: new RegExp(`^${session.getSnapshot().chosenCard!.name.es}`) })).toBeInTheDocument();

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
    expect(screen.getByTestId("take-ground-rule")).toHaveTextContent("solo con la carta Fragor del combate");
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

describe("BattleView Close Assault card", () => {
  const setupCloseAssault = () => {
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: same(""),
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Allies",
        tiles: {},
        units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [
        new CommandCard({
          id: "close",
          name: same("Asalto cercano"),
          closeAssaultOnly: true,
          fireBonus: [{ dice: 1, closeAssault: true }],
        }),
      ],
    });
    session.pickCard(session.getSnapshot().hand[0]!);
    session.commitOrders();
    session.startBattle();
    const { container } = render(<Harness session={session} onEndBattle={vi.fn()} />);
    const tap = (p: Position) =>
      fireEvent.click(container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement);
    return { session, container, tap };
  };

  it("marks the units in close assault on the map, and they can then fire", () => {
    const { session, container, tap } = setupCloseAssault();
    expect(screen.getByText("Marca las unidades en asalto cercano para que disparen.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marcar unidades" }));
    expect(container.querySelectorAll(".unit__ring--orderable")).toHaveLength(2);
    tap(INFANTRY);
    expect(screen.getByTestId("marked-count")).toHaveTextContent("1 unidad marcada");
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    const row = screen.getByTestId("order-summary");
    expect(row).toHaveTextContent("asalto cercano");
    fireEvent.click(within(row).getByRole("button", { name: "Disparar con Infantería" }));
    // Only adjacent targets
    expect(screen.getByTestId("firing-unit")).toHaveTextContent("Solo asalto cercano");
    expect(document.querySelectorAll('[data-testid="fire-map"] .board__target-dice').length).toBeLessThanOrEqual(6);
    expect(session.getSnapshot().orders).toHaveLength(1);
  });

  it("takes back the last mark", () => {
    const { session, tap } = setupCloseAssault();
    fireEvent.click(screen.getByRole("button", { name: "Marcar unidades" }));
    tap(INFANTRY);
    tap(TANK);

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));

    expect(session.getSnapshot().orders).toHaveLength(1);
    expect(screen.getByTestId("marked-count")).toHaveTextContent("1 unidad marcada");
  });
});

describe("BattleView combat cards", () => {
  const combatDeck: CombatCard[] = [
    { id: "spotter", name: same("Observador"), description: same("1 artillería tira 1 dado más."), cost: 1, phase: "battle" },
    { id: "ambush", name: same("Emboscada"), description: same("Combates tú primero."), cost: 3, phase: "battle" },
  ];

  // The defender at turn 2 with 2 coins and both battle cards in hand, in the battle
  const combatSetup = () => {
    const card = new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: same(""),
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
      combatCards: combatDeck,
    });
    session.startFirstTurn();
    session.adjustCoins(2);
    session.pickCard(card);
    session.issueOrder(INFANTRY, INFANTRY);
    session.issueOrder(TANK, TANK);
    session.commitOrders();
    session.startBattle();
    render(<Harness session={session} onEndBattle={() => {}} />);
    return session;
  };

  it("plays one battle card, paid, and undoes it", async () => {
    const session = combatSetup();
    const section = screen.getByTestId("battle-combat-cards");
    expect(screen.getByTestId("coin-counter")).toHaveTextContent("2");
    // 3 coins, has 2: tapping the card shows it, and says what's missing
    fireEvent.click(within(section).getByRole("button", { name: /^Emboscada/ }));
    expect(screen.getByRole("button", { name: "Jugar Emboscada" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Te falta 1 suministro");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(within(section).getByRole("button", { name: /^Observador/ }));
    fireEvent.click(screen.getByRole("button", { name: "Jugar Observador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(section).toHaveTextContent("Jugada · pagada: 1 suministro");
    expect(within(section).queryByRole("button", { name: /^Emboscada/ })).not.toBeInTheDocument();
    expect(session.getSnapshot().coins).toBe(1);

    fireEvent.click(within(section).getByRole("button", { name: "Deshacer" }));
    expect(session.getSnapshot().coins).toBe(2);
    expect(within(section).getByRole("button", { name: /^Observador/ })).toBeInTheDocument();
  });

  it("shows no combat cards in the attacker's extra turn", () => {
    setup({ openMap: false });

    expect(screen.queryByTestId("battle-combat-cards")).not.toBeInTheDocument();
  });
});

describe("BattleView combat card effects", () => {
  const barrage: CombatCard = {
    id: "barrage",
    name: same("Cortina de Fuego"),
    description: same(""),
    cost: 0,
    phase: "order",
    marker: { kind: "target", count: 1 },
    effect: { kind: "attack", dicePerHex: 4 },
  };
  const spotter: CombatCard = {
    id: "street",
    name: same("Lucha callejera"),
    description: same(""),
    cost: 0,
    phase: "battle",
    effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.INFANTRY], condition: same("¿En un edificio?") },
  };

  /** The defender at turn 2, with the combat cards given and `before` run before the battle */
  const effectSetup = (combatCards: CombatCard[], orderCard?: CombatCard) => {
    const card = new CommandCard({ id: "left", sections: [Side.LEFT], orders: 2 });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: same(""),
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
      combatCards,
      random: () => 0.7, // supplies
    });
    session.startFirstTurn();
    session.pickCard(card, undefined, orderCard);
    if (orderCard) session.markHex({ row: 1, col: 10 });
    session.issueOrder(INFANTRY, INFANTRY);
    session.issueOrder(TANK, TANK);
    session.commitOrders();
    session.startBattle();
    render(<Harness session={session} onEndBattle={() => {}} />);
    return session;
  };

  it("rolls the attack card on each marked hex before the units can fire", () => {
    const session = effectSetup([barrage], barrage);
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

  it("asks whether to use a dice card on a shot by a unit that fits", async () => {
    const session = effectSetup([spotter]);
    session.playBattleCombatCard(spotter);
    fireEvent.click(screen.getAllByRole("button", { name: /^Disparar con/ })[0]!);

    fireEvent.click(document.querySelector('[data-testid="fire-map"] [data-position="5-1"]')!);
    fireEvent.click(screen.getByRole("button", { name: "Infantería" }));

    expect(screen.getByRole("switch", { name: "Lucha callejera: ¿En un edificio? Si es así, ¿la usas en este disparo? (+1)" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Información: De dónde salen los dados" }));
    expect(screen.getByTestId("fire-breakdown")).toHaveTextContent("Carta Lucha callejera+1");
    fireEvent.click(within(screen.getByRole("dialog", { name: "De dónde salen los dados" })).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByTestId("fire-breakdown")).not.toBeInTheDocument());
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados");
    fireEvent.click(screen.getByRole("button", { name: "Disparar" }));
    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 3, combatBonus: true });
  });

  it("opens the map as soon as Ambush is played, to fire first with the unit attacked", async () => {
    const ambush: CombatCard = { id: "ambush", name: same("Emboscada"), description: same(""), cost: 0, phase: "battle", effect: { kind: "ambush" } };
    const session = effectSetup([ambush]);
    const section = screen.getByTestId("battle-combat-cards");
    fireEvent.click(within(section).getByRole("button", { name: /^Emboscada/ }));
    fireEvent.click(screen.getByRole("button", { name: "Jugar Emboscada" }));

    // Pick the unit attacked, then the attacker's hex, as when firing
    expect(await screen.findByText("¿Qué unidad atacan?")).toBeInTheDocument();
    fireEvent.click(document.querySelector(`[data-testid="ambush-map"] [data-position="${INFANTRY.row}-${INFANTRY.col}"]`)!);
    aimAt({ row: 6, col: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Blindados o artillería" }));
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados");
    fireEvent.click(screen.getByRole("button", { name: "Disparar" }));

    expect(session.getSnapshot().ambush).toMatchObject({ from: INFANTRY, dice: 3 });
    expect(session.getSnapshot().shots).toEqual([]);
    expect(screen.getByTestId("shot-result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The card can't be taken back once it fired, and the shot can be seen again
    expect(within(section).queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Ver emboscada" })).toBeInTheDocument();
  });
});
