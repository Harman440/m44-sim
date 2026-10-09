import { useState, useSyncExternalStore } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MovementView from "./MovementView";
import EndOfTurnView from "./EndOfTurnView";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { Side } from "../../../types/hex";
import { TurnPhase } from "../../../types/gameManager";
import { Position } from "../../../types/scenario";
import { same } from "../../../i18n/lang";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };

// The infantry moves (and can't fire after moving 2 hexes); the tank holds and fires
const makeMovementSession = ({ wire, tankTo = TANK }: { wire?: Position[]; tankTo?: Position } = {}) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: same(""),
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
      wire,
    },
    faction: "Allies",
    initialHandSize: 2,
    commandCards: [
      new CommandCard({ id: "left", name: same("Ataque"), sections: [Side.LEFT], orders: 2, description: same("Da órdenes a 2 unidades del flanco izquierdo.") }),
      new CommandCard({ id: "next", name: same("Siguiente"), sections: [Side.RIGHT], orders: 1 }),
    ],
  });
  session.pickCard(session.getSnapshot().hand.find((card) => card.id === "left")!);
  session.issueOrder(INFANTRY, { row: 5, col: 1 });
  session.issueOrder(TANK, tankTo);
  session.commitOrders();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  // As in GameView: the hand before the final phase was already dealt
  const [dealt, setDealt] = useState<ReadonlySet<string>>(() => {
    const { hand, drawnCard, extraDrawn } = session.getSnapshot();
    return new Set(hand.filter((card) => card !== drawnCard && card !== extraDrawn).map((card) => card.id));
  });
  if (game.phase === TurnPhase.MOVEMENT) return <MovementView faction="Allies" session={session} game={game} />;
  return (
    <EndOfTurnView
      faction="Allies"
      session={session}
      game={game}
      dealtCardIds={dealt}
      onCardDealt={(card) => setDealt((prev) => new Set(prev).add(card.id))}
      onDrawCard={() => session.drawCard()}
      onKeepCard={(card) => session.keepCard(card)}
      onDrawAgain={() => session.drawAgain()}
      onChooseReward={(choice) => session.chooseReward(choice)}
      onEndTurn={() => session.endTurn()}
    />
  );
}

describe("MovementView", () => {
  it("says what to do at the table, behind Instrucciones, and counts the units that fire", () => {
    render(<Harness session={makeMovementSession()} />);

    expect(screen.queryByText(/Mueve en la mesa las unidades con flecha/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Instrucciones" }));
    expect(screen.getByText(/Enseña esta pantalla al rival/)).toBeInTheDocument();
    expect(screen.getByText(/Mueve en la mesa las unidades con flecha/)).toBeInTheDocument();
    expect(screen.getByText(/Pon un marcador de batalla en\s+la unidad que dispara\./)).toBeInTheDocument();
  });

  it("reminds the player, in sight, to take off the table the barbed wire a tank entered", () => {
    expect(render(<Harness session={makeMovementSession()} />).queryByTestId("cleared-wire")).toBeNull();

    const WIRE: Position = { row: 7, col: 4 };
    render(<Harness session={makeMovementSession({ wire: [WIRE], tankTo: WIRE })} />);
    expect(screen.getByTestId("cleared-wire")).toHaveTextContent("Tu tanque quita la alambrada en la que entra: quítala de la mesa.");
  });

  it("shows the cards played in the orders phase above the instructions", () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);

    const cards = screen.getByTestId("played-cards");
    expect(within(cards).getByRole("heading", { name: session.getSnapshot().chosenCard!.name.es })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mostrar al rival" })).not.toBeInTheDocument();
  });

  it("shows a played card's full text when it is tapped", async () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);
    const card = session.getSnapshot().chosenCard!;

    fireEvent.click(within(screen.getByTestId("played-cards")).getByRole("button", { name: new RegExp(`^${card.name.es}`) }));

    const dialog = screen.getByRole("dialog", { name: "Carta jugada" });
    expect(within(dialog).getByTestId("card-details")).toHaveTextContent(card.description.es);
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

  it("draws the command card as the phase starts and flies it into the hand, then starts the next turn", async () => {
    const session = finalPhase();
    const drawn = session.getSnapshot().drawnCard!;
    expect(drawn).not.toBeNull();
    expect(screen.getByTestId("drawn-card")).toHaveTextContent(`Has robado ${drawn.name.es}.`);
    expect(screen.queryByRole("button", { name: "Robar carta" })).not.toBeInTheDocument();
    // In the air from the deck, then in the hand
    expect(screen.getByTestId("flight")).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Empezar turno 2" });
    expect(start).toBeDisabled();

    await waitFor(() => expect(start).toBeEnabled());
    expect(screen.queryByTestId("flight")).not.toBeInTheDocument();
    const hand = screen.getByRole("list", { name: "Tu mano" });
    expect(within(hand).getByRole("button", { name: drawn.name.es })).toBeInTheDocument();

    fireEvent.click(start);
    expect(session.getSnapshot()).toMatchObject({ turn: 2, phase: TurnPhase.PICK_CARDS });
  });

  it("swaps the card drawn for the next one, which must be kept", async () => {
    const session = finalPhase();
    const swap = screen.getByRole("button", { name: "Descartar y robar otra" });
    await waitFor(() => expect(swap).toBeEnabled());

    fireEvent.click(swap);

    // The first card flies to the discard pile (the deck is empty, so the reshuffle brings the same card back)
    expect(screen.getByTestId("flight")).toBeInTheDocument();
    const drawn = session.getSnapshot().drawnCard!;
    expect(screen.getByTestId("drawn-card")).toHaveTextContent(`Has descartado la primera y robado ${drawn.name.es}: te la quedas.`);
    expect(screen.queryByRole("button", { name: "Descartar y robar otra" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeEnabled());
  });
});
