import { UnitType } from "../game-core/unit";
import { shoot } from "../test/shots";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HistoryDialog from "./HistoryDialog";
import GameSession from "../game-core/gameSession";
import { SAVE_VERSION } from "../game-core/saveGame";
import CommandCard from "../game-core/commandCard";
import { Side } from "../types/hex";
import { Position } from "../types/scenario";
import { downloadJson } from "../download";

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { unitType: UnitType.INFANTRY, closeAssault: false };

vi.mock("../download", () => ({ downloadJson: vi.fn() }));

const INFANTRY: Position = { row: 7, col: 1 };

/** Two finished turns: in the first the infantry holds and fires, in the second it is destroyed */
const playedSession = () => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 2, axis: 2 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { infantry: [INFANTRY] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 2,
    commandCards: [
      new CommandCard({ id: "a", name: "Ataque", sections: [Side.LEFT], orders: 1 }),
      new CommandCard({ id: "b", name: "Asalto", sections: [Side.LEFT], orders: 1 }),
    ],
    random: () => 0.5, // grenade
  });
  const playTurn = (battle: () => void, final: () => void = () => {}) => {
    session.pickCard(session.getSnapshot().hand[0]!);
    session.issueOrder(INFANTRY, INFANTRY);
    session.commitOrders();
    session.startMovement();
    session.startBattle();
    battle();
    session.endBattle();
    final();
    session.drawCard();
    session.chooseReward("coins"); // not asked in the extra turn 1
    session.endTurn();
  };
  playTurn(() => shoot(session, 0, AT_INFANTRY));
  playTurn(
    () => {},
    () => session.removeUnit(INFANTRY)
  );
  return session;
};

describe("HistoryDialog", () => {
  it("lists past turns, newest first, with orders, shots and map changes", () => {
    const session = playedSession();
    render(<HistoryDialog open onClose={() => {}} session={session} log={session.getSnapshot().log} />);

    const [second, first] = screen.getAllByTestId("turn-record");
    expect(within(second!).getByRole("heading", { name: "Turno 2" })).toBeInTheDocument();
    expect(second).toHaveTextContent("Eliminada: Infantería");
    expect(second).toHaveTextContent("Nadie disparó.");
    expect(first).toHaveTextContent("Infantería · mantiene posición");
    expect(first).toHaveTextContent("Infantería: 2 dados → 2 × Granada");
    expect(first).toHaveTextContent("(contra infantería · a distancia: 2 impactos · 0 retiradas)");
    expect(first).toHaveTextContent("Sin bajas ni retiradas.");
    expect(first).toHaveTextContent("Al terminar el turno: 0 suministros");
    expect(second).toHaveTextContent("Fase final: suministros: +2");
    expect(second).toHaveTextContent("Al terminar el turno: 2 suministros");
  });

  it("says so when no turn has finished yet", () => {
    const session = playedSession();
    render(<HistoryDialog open onClose={() => {}} session={session} log={[]} />);

    expect(screen.getByText("Aún no ha terminado ningún turno.")).toBeInTheDocument();
  });

  it("exports one turn, or the whole game, as JSON", () => {
    const session = playedSession();
    const { log } = session.getSnapshot();
    render(<HistoryDialog open onClose={() => {}} session={session} log={log} />);

    fireEvent.click(screen.getByRole("button", { name: "Exportar turno 1" }));
    expect(downloadJson).toHaveBeenLastCalledWith("m44-test-aliados-turno-1.json", log[0]);

    fireEvent.click(screen.getByRole("button", { name: "Exportar partida" }));
    expect(downloadJson).toHaveBeenLastCalledWith(
      "m44-test-aliados-partida-turno-3.json",
      expect.objectContaining({ version: SAVE_VERSION, log })
    );
  });
});
