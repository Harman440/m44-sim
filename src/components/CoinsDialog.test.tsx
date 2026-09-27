import { useSyncExternalStore } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CoinsDialog from "./CoinsDialog";
import GameSession from "../game-core/gameSession";
import CommandCard from "../game-core/commandCard";

// The defender at turn 2, so coins can be changed
const makeSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Axis",
      tiles: {},
      units: { allies: { infantry: [{ row: 7, col: 1 }] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "a", orders: 1 })],
  });
  session.startFirstTurn();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return <CoinsDialog open onClose={() => {}} session={session} game={game} />;
}

describe("CoinsDialog", () => {
  it("adds and pays coins by hand, lists them and undoes the last one", () => {
    const session = makeSession();
    render(<Harness session={session} />);
    expect(screen.getByTestId("coin-balance")).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "Pagar 1" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Una moneda más" }));
    fireEvent.click(screen.getByRole("button", { name: "Una moneda más" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Una moneda menos" }));
    fireEvent.click(screen.getByRole("button", { name: "Pagar 2" }));

    expect(screen.getByTestId("coin-balance")).toHaveTextContent("1");
    expect(screen.getByTestId("coin-ledger")).toHaveTextContent("Ingreso a mano+3Pago a mano−2");

    fireEvent.click(screen.getByRole("button", { name: "Deshacer −2" }));
    expect(session.getSnapshot().coins).toBe(3);
  });
});
