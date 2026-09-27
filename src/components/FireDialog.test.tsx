import { useState, useSyncExternalStore } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FireDialog from "./FireDialog";
import GameSession from "../game-core/gameSession";
import CommandCard from "../game-core/commandCard";
import { Side } from "../types/hex";
import { summarizeOrders } from "../game-core/turnSummary";
import { UnitType } from "../game-core/unit";
import { Position } from "../types/scenario";

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { unitType: UnitType.INFANTRY, closeAssault: false };

const UNIT: Position = { row: 7, col: 1 };

/** A session in battle with one unit of `unitType` ordered to hold and fire; dice always show a grenade */
const makeSession = (unitType: UnitType, holdShots = 1) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles: {},
      units: { allies: { [unitType]: [UNIT] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 1, holdShots })],
    random: () => 0.5, // grenade
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  session.issueOrder(UNIT, UNIT);
  session.commitOrders();
  session.startMovement();
  session.startBattle();
  return session;
};

// Opens and closes the dialog like BattleView does (keyed, so it starts fresh)
function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [open, setOpen] = useState(false);
  const summary = summarizeOrders(game.orders, session.board, game.shots)[0]!;
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      <FireDialog
        key={open ? "open" : "closed"}
        summary={open ? summary : null}
        card={game.chosenCard}
        faction="Allies"
        onFire={(answers) => session.fire(0, answers)}
        onQuickFire={(dice, target) => session.fireQuick(0, dice, target)}
        withCoins
        onUndoShot={() => session.undoShot(0)}
        onKeepResults={(shotNumber, kept) => session.keepResults(0, shotNumber, kept)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const open = (unitType: UnitType, holdShots?: number) => {
  const session = makeSession(unitType, holdShots);
  render(<Harness session={session} />);
  fireEvent.click(screen.getByText("abrir"));
  return session;
};
const choose = (label: string | RegExp) => fireEvent.click(screen.getByRole("button", { name: label }));
/** Quick roll target: an infantry unit at range */
const quickTarget = () => {
  choose("Infantería");
  choose("No");
};
const grenades = () => within(screen.getByTestId("dice-result")).getAllByRole("img", { name: "Granada" });

describe("FireDialog", () => {
  it("asks distance then target terrain, explains the dice and rolls them once", () => {
    const session = open(UnitType.INFANTRY);

    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
    choose("2");
    expect(screen.getByText("¿Tiene línea de visión al objetivo?")).toBeInTheDocument();
    choose("Sí");
    expect(screen.getByText("¿Qué tipo de unidad es el objetivo?")).toBeInTheDocument();
    choose("Infantería");
    expect(screen.getByText("¿En qué terreno está el objetivo?")).toBeInTheDocument();
    choose("Bosque");
    choose("No");

    const breakdown = screen.getByTestId("fire-breakdown");
    expect(breakdown).toHaveTextContent("Base: Infantería a 2 casillas+2");
    expect(breakdown).toHaveTextContent("Objetivo en bosque-1");
    expect(screen.getByTestId("fire-total")).toHaveTextContent("Total: 1 dado");
    expect(screen.getByText("No se puede repetir la tirada.")).toBeInTheDocument();

    choose("Disparar 1 dado");

    expect(grenades()).toHaveLength(1);
    expect(screen.getByTestId("roll-reading")).toHaveTextContent("Contra infantería · a distancia");
    expect(screen.getByTestId("roll-hits")).toHaveTextContent("1Impacto");
    expect(session.getSnapshot().shots).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Tirar|^Disparar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).not.toBeInTheDocument();
  });

  it("shows the stored shot read-only when the unit is opened again", () => {
    open(UnitType.INFANTRY);
    choose("1 (adyacente)");
    choose("Tanque");
    choose("Campo abierto");
    choose("No");
    choose("Disparar 3 dados");
    choose("Cerrar");

    fireEvent.click(screen.getByText("abrir"));

    expect(grenades()).toHaveLength(3);
    expect(screen.getByTestId("shot-result")).toHaveTextContent("Base: Infantería a 1 casilla +3");
    expect(screen.getByTestId("roll-reading")).toHaveTextContent("Contra tanque · asalto cercano");
    expect(screen.queryByText("¿A cuántas casillas está el objetivo?")).not.toBeInTheDocument();
  });

  it("applies fewer results than were rolled: the dice not picked show as discarded", () => {
    const session = open(UnitType.TANK);
    choose(/Tirada rápida/);
    choose("3");
    quickTarget();
    choose("Disparar 3 dados");

    choose("Aplicar menos resultados");
    choose("Dado 2: Granada");
    expect(screen.getByTestId("roll-hits")).toHaveTextContent("2Impactos");
    choose("Aplicar 2 de 3");

    expect(session.getSnapshot().shots[0]!.kept).toEqual([0, 2]);
    expect(grenades()).toHaveLength(3); // the full roll stays on show
    expect(screen.getByText("(descartado)", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("roll-hits")).toHaveTextContent("2Impactos");

    choose("Aplicar todos");
    expect(session.getSnapshot().shots[0]!.kept).toBeNull();
    expect(screen.getByTestId("roll-hits")).toHaveTextContent("3Impactos");
  });

  it("fires a quick roll with the number of dice chosen", () => {
    const session = open(UnitType.TANK);

    choose(/Tirada rápida/);
    choose("5");
    expect(screen.getByRole("button", { name: "Disparar 5 dados" })).toBeDisabled();
    quickTarget();
    choose("Disparar 5 dados");

    expect(grenades()).toHaveLength(5);
    expect(screen.getByTestId("shot-result")).toHaveTextContent("Tirada rápida");
    expect(session.getSnapshot().shots[0]).toMatchObject({
      dice: 5,
      steps: [],
      target: { unitType: UnitType.INFANTRY, closeAssault: false },
    });
    expect(screen.getByTestId("roll-hits")).toHaveTextContent("5Impactos");
    expect(screen.getByTestId("roll-retreats")).toHaveTextContent("0Retiradas");
    expect(screen.getByTestId("roll-coins")).toHaveTextContent("+0Monedas");
  });

  it("goes back from a quick roll, and one question at a time", () => {
    open(UnitType.TANK);
    choose(/Tirada rápida/);
    choose("Atrás");
    choose("1 (adyacente)");
    choose("Tanque");
    choose("Pueblo");

    choose("Atrás");
    expect(screen.getByText("¿En qué terreno está el objetivo?")).toBeInTheDocument();
    choose("Atrás");
    expect(screen.getByText("¿Qué tipo de unidad es el objetivo?")).toBeInTheDocument();
    choose("Atrás");
    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).not.toBeInTheDocument();
  });

  it("says a target out of sight can't be shot, and offers no roll", () => {
    const session = open(UnitType.INFANTRY);
    choose("2");
    choose("No");

    expect(screen.getByTestId("fire-blocked")).toHaveTextContent("Sin línea de visión");
    expect(screen.queryByRole("button", { name: /^Disparar|Registrar/ })).not.toBeInTheDocument();
    choose("Atrás");
    expect(screen.getByText("¿Tiene línea de visión al objetivo?")).toBeInTheDocument();
    expect(session.getSnapshot().shots).toHaveLength(0);
  });

  it("reminds about sandbags before and after the roll", () => {
    open(UnitType.INFANTRY);
    choose("1 (adyacente)");
    choose("Infantería");
    choose("Campo abierto");
    choose("Sí");

    expect(screen.getByTestId("shot-notes")).toHaveTextContent("ignora 1 bandera");
    choose("Disparar 3 dados");

    expect(screen.getByTestId("shot-result")).toHaveTextContent("ignora 1 bandera");
  });

  it("offers artillery its full range of 6 hexes", () => {
    open(UnitType.ARTILLERY);

    for (const label of ["1 (adyacente)", "2", "3", "4", "5", "6"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("records a shot with no dice as fired, without rolling", () => {
    const session = open(UnitType.INFANTRY);
    choose("3");
    choose("Sí");
    choose("Infantería");
    choose("Pueblo");
    choose("No");

    expect(screen.getByTestId("fire-total")).toHaveTextContent("no tiene efecto");
    choose("Registrar disparo sin efecto");

    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 0, faces: [] });
    expect(screen.getByTestId("shot-result")).toHaveTextContent("no tuvo efecto");
  });

  it("only undoes a shot after ticking the confirmation", () => {
    const session = open(UnitType.TANK);
    choose(/Tirada rápida/);
    quickTarget();
    choose("Disparar 3 dados");

    choose("Anular disparo");
    const confirm = screen.getByRole("button", { name: "Anular disparo" });
    expect(confirm).toBeDisabled();
    choose("Volver");
    expect(session.getSnapshot().shots).toHaveLength(1);

    choose("Anular disparo");
    fireEvent.click(screen.getByRole("checkbox", { name: "Confirmo que fue un error" }));
    choose("Anular disparo");

    expect(session.getSnapshot().shots).toHaveLength(0);
    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
  });

  it("lets a unit fire again when the card allows more than one shot", () => {
    const session = open(UnitType.TANK, 2);
    choose(/Tirada rápida/);
    quickTarget();
    choose("Disparar 3 dados");

    choose("Disparar otra vez (queda 1)");
    choose(/Tirada rápida/);
    choose("2");
    expect(screen.getByRole("button", { name: "Disparar 2 dados" })).toBeDisabled(); // a new target each shot
    quickTarget();
    choose("Disparar 2 dados");

    expect(session.getSnapshot().shots.map((s) => s.dice)).toEqual([3, 2]);
    expect(screen.getAllByTestId("shot-result")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Disparar otra vez/ })).not.toBeInTheDocument();
  });

  it("starts from the first question every time it is opened", () => {
    open(UnitType.INFANTRY);
    choose("2");
    choose("Cerrar");

    fireEvent.click(screen.getByText("abrir"));

    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
  });
});
