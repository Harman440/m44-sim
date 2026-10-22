import { useSyncExternalStore } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MovementView from "./MovementView";
import GameSession from "../../../game-core/gameSession";
import { actionCardById } from "../../../data/actionCards";
import { TurnPhase } from "../../../types/gameManager";
import { Position } from "../../../types/scenario";
import { same } from "../../../i18n/lang";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };

// The infantry moves (and can't fire after moving 2 hexes); the tank holds and fires. The defender plays Resupply
const makeMovementSession = ({ wire, tankTo = TANK }: { wire?: Position[]; tankTo?: Position } = {}) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: { es: "Test", en: "Test" },
      description: same(""),
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Axis",
      tiles: {},
      units: { allies: { infantry: [INFANTRY], tank: [TANK] }, axis: {} },
      wire,
    },
    faction: "Allies",
    testMode: true,
  });
  session.pickCard(actionCardById("resupply")!);
  session.issueOrder(INFANTRY, { row: 5, col: 1 });
  session.issueOrder(TANK, tankTo);
  session.commitOrders();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <MovementView faction="Allies" session={session} game={game} />;
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

  it("shows the card played in the orders phase above the instructions, and what it does", () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);

    const cards = screen.getByTestId("played-cards");
    expect(within(cards).getByRole("heading", { name: session.getSnapshot().playedCard!.name.es })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Instrucciones" }));
    expect(screen.getByTestId("order-played-card")).toHaveTextContent("Juegas Reabastecimiento");
    expect(screen.queryByRole("button", { name: "Mostrar al rival" })).not.toBeInTheDocument();
  });

  it("shows a played card's full text when it is tapped", async () => {
    const session = makeMovementSession();
    render(<Harness session={session} />);
    const card = session.getSnapshot().playedCard!;

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
