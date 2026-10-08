import { useSyncExternalStore } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParadropView from "./ParadropView";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { UnitType } from "../../../game-core/unit";
import { TurnPhase } from "../../../types/gameManager";
import { Position } from "../../../types/scenario";
import { same } from "../../../i18n/lang";

const INFANTRY: Position = { row: 7, col: 1 };

const makeSession = () =>
  new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: same(""),
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [INFANTRY] }, axis: {} },
      paradrop: { faction: "Allies", unitType: UnitType.INFANTRY, units: 2 },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "all", name: same("Todas"), orders: 6 })],
  });

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  if (game.phase !== TurnPhase.PARADROP) return <p>Primer turno</p>;
  return <ParadropView faction="Allies" session={session} game={game} />;
}

const setup = () => {
  const session = makeSession();
  const { container } = render(<Harness session={session} />);
  const hex = (p: Position) => container.querySelector(`[data-position="${p.row}-${p.col}"]`) as SVGGElement;
  const tap = (p: Position) => fireEvent.click(hex(p));
  return { session, tap };
};

describe("ParadropView", () => {
  it("places a paratrooper on each hex tapped and counts down", () => {
    const { session, tap } = setup();

    expect(screen.getByText(/quedan 2 de 2/)).toBeInTheDocument();
    tap({ row: 3, col: 4 });
    tap(INFANTRY); // occupied: nothing happens

    expect(session.board.getHex({ row: 3, col: 4 })!.unit?.getUnitType()).toBe(UnitType.INFANTRY);
    expect(screen.getByText(/quedan 1 de 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Deshacer/ }));
    expect(session.board.getHex({ row: 3, col: 4 })!.unit).toBeNull();
  });

  it("starts the game with the paratroopers placed, counting the lost ones", () => {
    const { tap } = setup();
    tap({ row: 3, col: 4 });

    fireEvent.click(screen.getByRole("button", { name: /Empezar \(1 perdido\)/ }));

    expect(screen.getByText("Primer turno")).toBeInTheDocument();
  });
});
