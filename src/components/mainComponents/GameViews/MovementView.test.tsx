import { useSyncExternalStore } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MovementView from "./MovementView";
import EndOfTurnView from "./EndOfTurnView";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { Side } from "../../../types/hex";
import { TurnPhase } from "../../../types/gameManager";
import { Position } from "../../../types/scenario";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };

// The infantry moves (and can't fire after moving 2 hexes); the tank holds and fires
const makeMovementSession = () => {
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
    initialHandSize: 2,
    commandCards: [
      new CommandCard({ id: "left", name: "Ataque", sections: [Side.LEFT], orders: 2, description: "Da órdenes a 2 unidades del flanco izquierdo." }),
      new CommandCard({ id: "next", name: "Siguiente", sections: [Side.RIGHT], orders: 1 }),
    ],
  });
  session.pickCard(session.getSnapshot().hand.find((card) => card.id === "left")!);
  session.issueOrder(INFANTRY, { row: 5, col: 1 });
  session.issueOrder(TANK, TANK);
  session.commitOrders();
  session.startMovement();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  if (game.phase === TurnPhase.MOVEMENT) return <MovementView faction="Allies" session={session} game={game} />;
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

describe("MovementView", () => {
  it("says what to do at the table and counts the units that fire", () => {
    render(<Harness session={makeMovementSession()} />);

    expect(screen.getByText(/mueve en la mesa las unidades con flecha/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Instrucciones" }));
    expect(screen.getByText(/Enseña esta pantalla al rival/)).toBeInTheDocument();
    expect(screen.getByText(/Pon un marcador de batalla en\s+la unidad que dispara\./)).toBeInTheDocument();
  });

  it("shows the cards played in the orders phase above the instructions", () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);

    const cards = screen.getByTestId("played-cards");
    expect(within(cards).getByRole("heading", { name: session.getSnapshot().chosenCard!.name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar al rival" })).not.toBeInTheDocument();
  });

  it("shows a played card's full text when it is tapped", async () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);
    const card = session.getSnapshot().chosenCard!;

    fireEvent.click(within(screen.getByTestId("played-cards")).getByRole("button", { name: new RegExp(`^${card.name}`) }));

    const dialog = screen.getByRole("dialog", { name: "Carta jugada" });
    expect(within(dialog).getByTestId("card-details")).toHaveTextContent(card.description);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("moves on to the battle", () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Fase Batalla" }));

    expect(session.getSnapshot().phase).toBe(TurnPhase.BATTLE);
  });
});

describe("EndOfTurnView", () => {
  const finalPhase = () => {
    const session = makeMovementSession();
    session.startBattle();
    session.endBattle();
    render(<Harness session={session} />);
    return session;
  };

  it("draws the command card and keeps it, and only then starts the next turn", () => {
    const session = finalPhase();
    expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Robar carta" }));

    const drawn = session.getSnapshot().drawnCard!;
    expect(screen.getByText("Te la quedas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: drawn.name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Robar carta" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Empezar turno 2" }));
    expect(session.getSnapshot()).toMatchObject({ turn: 2, phase: TurnPhase.PICK_CARDS });
  });

  it("swaps the card drawn for the next one, which must be kept", () => {
    const session = finalPhase();
    fireEvent.click(screen.getByRole("button", { name: "Robar carta" }));

    fireEvent.click(screen.getByRole("button", { name: "Descartar y robar otra" }));

    expect(screen.getByText("Has descartado la primera y robado esta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: session.getSnapshot().drawnCard!.name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descartar y robar otra" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeEnabled();
  });
});
