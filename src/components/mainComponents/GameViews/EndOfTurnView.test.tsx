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
      onDrawCard={() => session.drawCard()}
      onKeepCard={(card) => session.keepCard(card)}
      onDrawAgain={() => session.drawAgain()}
      onChooseReward={(choice) => session.chooseReward(choice)}
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

describe("EndOfTurnView after a special card", () => {
  // Plays `card` (1 hold order on the left), with 3 plain cards left in the deck.
  // Turn 1 is the attacker's extra turn; from turn 2 the final phase gives coins.
  const finalAfter = (card: CommandCard, turn = 1) => {
    const deck = ["X", "Y", "Z"].map((name) => new CommandCard({ id: name, name, orders: 1 }));
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Allies",
        tiles: {},
        units: { allies: { infantry: [INFANTRY] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 0,
      commandCards: [],
    });
    const restored = GameSession.restore(
      { ...session.save(), turn, hand: [card.id], drawPile: deck.map((c) => c.id) },
      session.scenario,
      [card, ...deck]
    );
    restored.pickCard(card);
    restored.issueOrder(INFANTRY, INFANTRY);
    restored.commitOrders();
    restored.startMovement();
    restored.startBattle();
    restored.endBattle();
    render(<Harness session={restored} />);
    return restored;
  };

  it("draws 3 cards after Recon and keeps the one tapped, with no swap", () => {
    const session = finalAfter(
      new CommandCard({ id: "recon", name: "Reconocimiento", sections: [Side.LEFT], orders: 1, drawChoice: 3 })
    );
    expect(screen.getByText("Reconocimiento: roba 3 cartas de tu mazo y quédate con 1.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Robar 3 cartas" }));

    expect(screen.getByText("Elige la carta que te quedas:")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Quedármela/ })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Descartar y robar otra" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quedármela: Y" }));
    expect(session.getSnapshot().hand.map((c) => c.name)).toEqual(["Y"]);
    expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeInTheDocument();
  });

  it("adds the Preparations coins and reminds the player of the combat card, with no choice", () => {
    const session = finalAfter(
      new CommandCard({
        id: "preparations",
        name: "Preparativos",
        orders: 1,
        endOfTurnReward: { coins: 3, combatCard: true },
      }),
      2
    );

    expect(screen.getByTestId("end-of-turn-reward")).toHaveTextContent(
      "En lugar de elegir: +3 monedas, ya sumadas al contador, y coge una carta de combate en la mesa."
    );
    expect(screen.queryByRole("button", { name: /2 monedas/ })).not.toBeInTheDocument();
    expect(session.getSnapshot().coins).toBe(3);
  });

  it("asks for 2 coins or a combat card before the next turn", () => {
    const session = finalAfter(new CommandCard({ id: "plain", name: "Ataque", orders: 1 }), 2);
    fireEvent.click(screen.getByRole("button", { name: "Robar carta" }));
    fireEvent.click(screen.getByRole("button", { name: "Quedármela: X" }));
    const start = screen.getByRole("button", { name: "Empezar turno 3" });
    expect(start).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Carta de combate/ }));
    expect(screen.getByText(/Coge una carta de combate del mazo en la mesa/)).toBeInTheDocument();
    expect(session.getSnapshot().coins).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /2 monedas/ }));
    expect(session.getSnapshot().coins).toBe(2);
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(session.getSnapshot().turn).toBe(3);
    expect(session.getSnapshot().coins).toBe(2);
  });

  it("gives no coins or combat card in the attacker's extra turn", () => {
    finalAfter(new CommandCard({ id: "plain", name: "Ataque", orders: 1 }));

    expect(screen.getByTestId("end-of-turn-reward")).toHaveTextContent(
      "En el turno extra no se ganan monedas ni se cogen cartas de combate."
    );
    fireEvent.click(screen.getByRole("button", { name: "Robar carta" }));
    fireEvent.click(screen.getByRole("button", { name: "Quedármela: X" }));
    expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeEnabled();
  });
});
