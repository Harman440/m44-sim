import { useState, useSyncExternalStore } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FireDialog from "./FireDialog";
import GameSession from "../game-core/gameSession";
import CommandCard from "../game-core/commandCard";
import { Side } from "../types/hex";
import { summarizeOrders } from "../game-core/turnSummary";
import { UnitType } from "../game-core/unit";
import { Position, Scenario } from "../types/scenario";
import { CombatCard } from "../game-core/combatCard";

/** Default target for shots whose reading the test doesn't check */
const AT_INFANTRY = { unitType: UnitType.INFANTRY, closeAssault: false };

const UNIT: Position = { row: 7, col: 1 };

/** A session in battle with one unit of `unitType` ordered to hold and fire; dice always show a grenade */
const makeSession = (unitType: UnitType, holdShots = 1, longRangeDie = false, tiles: Scenario["tiles"] = {}) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 1, axis: 1 },
      attacker: "Allies",
      tiles,
      units: { allies: { [unitType]: [UNIT] }, axis: {} },
    },
    faction: "Allies",
    initialHandSize: 1,
    commandCards: [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 1, holdShots })],
    random: () => 0.5, // grenade, on either die
    longRangeDie,
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
        board={session.board}
        targets={session.fireTargetsFor(0)}
        onFireAt={(choice) => session.fireAt(0, choice)}
        canTakeGround={session.canTakeGround(0)}
        onTakeGround={() => session.takeGround(0)}
        onUndoTakeGround={() => session.undoTakeGround(0)}
        combatBonus={session.combatBonusFor(0)}
        onQuickFire={(dice, target, useCombatBonus) => session.fireQuick(0, dice, target, useCombatBonus)}
        withCoins
        longRangeDie={session.longRangeDie}
        onUndoShot={() => session.undoShot(0)}
        onKeepResults={(shotNumber, kept) => session.keepResults(0, shotNumber, kept)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const open = (unitType: UnitType, holdShots?: number, tiles: Scenario["tiles"] = {}) => {
  const session = makeSession(unitType, holdShots, false, tiles);
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
/** Tap a hex on the fire map */
const tapHex = (p: Position) =>
  fireEvent.click(document.querySelector(`[data-testid="fire-map"] [data-position="${p.row}-${p.col}"]`)!);
const diceBadges = () => document.querySelectorAll('[data-testid="fire-map"] .board__target-dice').length;
const hasBadge = (p: Position) =>
  Array.from(document.querySelectorAll('[data-testid="fire-map"] .hexagon__tile--target, [data-testid="fire-map"] .hexagon__tile--target-selected')).some(
    (tile) => tile.parentElement?.getAttribute("data-position") === `${p.row}-${p.col}`
  );
const grenades = () => within(screen.getByTestId("dice-result")).getAllByRole("img", { name: "Granada" });

describe("FireDialog", () => {
  const TWO_AWAY: Position = { row: 5, col: 1 };
  const ADJACENT: Position = { row: 6, col: 1 };

  it("shows the hexes in range with their dice; the target is tapped, then its unit, and the dice are rolled once", () => {
    const session = open(UnitType.INFANTRY, 1, { forest: [TWO_AWAY] });

    expect(screen.getByTestId("firing-unit")).toHaveTextContent("Alcance 3: 3 / 2 / 1 dados");
    expect(diceBadges()).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Disparar" })).toBeDisabled();

    tapHex(TWO_AWAY);
    expect(screen.getByTestId("fire-target")).toHaveTextContent("Bosque · a 2 casillas");
    choose("Infantería");

    const breakdown = screen.getByTestId("fire-breakdown");
    expect(breakdown).toHaveTextContent("Base: Infantería a 2 casillas+2");
    expect(breakdown).toHaveTextContent("Objetivo en bosque-1");
    expect(screen.getByTestId("fire-total")).toHaveTextContent("Total: 1 dado");
    expect(screen.getByText("No se puede repetir la tirada.")).toBeInTheDocument();

    choose("Disparar 1 dado");

    expect(grenades()).toHaveLength(1);
    expect(screen.getByTestId("roll-reading")).toHaveTextContent("Contra infantería · a distancia");
    expect(session.getSnapshot().shots).toHaveLength(1);
    expect(session.getSnapshot().shots[0]!.targetPosition).toEqual(TWO_AWAY);
    expect(screen.queryByRole("button", { name: /^Disparar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).not.toBeInTheDocument();
  });

  it("won't pick a hex it can't fire at, and says why", () => {
    open(UnitType.INFANTRY);

    tapHex({ row: 1, col: 1 }); // far out of range
    expect(screen.getByText(/Esa casilla no/)).toBeInTheDocument();
    expect(screen.queryByTestId("fire-target")).not.toBeInTheDocument();
  });

  it("doesn't offer hexes out of sight or where no die gets through", () => {
    // Infantry 3 hexes away into a town: 1 − 1 = 0 dice. A town in between hides the hex behind it
    open(UnitType.INFANTRY, 1, { town: [{ row: 4, col: 1 }, ADJACENT] });

    expect(hasBadge({ row: 4, col: 1 })).toBe(false); // 0 dice
    expect(hasBadge(ADJACENT)).toBe(true); // adjacent: always in sight
    expect(hasBadge(TWO_AWAY)).toBe(false); // behind the town
  });

  it("shows the stored shot read-only when the unit is opened again", () => {
    open(UnitType.INFANTRY);
    tapHex(ADJACENT);
    choose("Tanque");
    choose("Disparar 3 dados");
    choose("Cerrar");

    fireEvent.click(screen.getByText("abrir"));

    expect(grenades()).toHaveLength(3);
    expect(screen.getByTestId("shot-result")).toHaveTextContent("Base: Infantería a 1 casilla +3");
    expect(screen.getByTestId("roll-reading")).toHaveTextContent("Contra tanque · asalto cercano");
    expect(screen.queryByTestId("fire-map")).not.toBeInTheDocument();
  });

  it("rolls the 8-sided die at a target that isn't adjacent, when the game uses it", () => {
    const session = makeSession(UnitType.INFANTRY, 1, true);
    render(<Harness session={session} />);
    fireEvent.click(screen.getByText("abrir"));
    tapHex(TWO_AWAY);
    choose("Tanque");

    expect(screen.getByTestId("fire-total")).toHaveTextContent("Total: 2 dados de 8 caras");
    choose("Disparar 2 dados de 8 caras");

    expect(session.getSnapshot().shots[0]!.faces).toEqual(["grenade", "grenade"]);
    expect(screen.getByTestId("roll-reading")).toHaveTextContent("Contra tanque · a distancia · dado de 8 caras");
  });

  it("reminds about sandbags with the roll", () => {
    open(UnitType.INFANTRY);
    tapHex(ADJACENT);
    choose("Infantería");
    fireEvent.click(screen.getByRole("switch", { name: /Sacos terreros/ }));
    choose("Disparar 3 dados");

    expect(screen.getByTestId("shot-result")).toHaveTextContent("ignora 1 bandera");
  });

  it("reaches 6 hexes with artillery", () => {
    open(UnitType.ARTILLERY);

    expect(screen.getByTestId("firing-unit")).toHaveTextContent("Alcance 6: 3 / 3 / 2 / 2 / 1 / 1 dados");
    expect(hasBadge({ row: 1, col: 1 })).toBe(true); // 6 hexes up
  });

  it("starts with no target every time it is opened", () => {
    open(UnitType.INFANTRY);
    tapHex(ADJACENT);
    choose("Cerrar");

    fireEvent.click(screen.getByText("abrir"));

    expect(screen.getByText("Toca una casilla en el mapa.")).toBeInTheDocument();
  });

  it("goes back from a quick roll to the map", () => {
    open(UnitType.TANK);
    choose(/Tirada rápida/);
    choose("Atrás");

    expect(screen.getByTestId("fire-map")).toBeInTheDocument();
  });

  it("lets armour take ground after a close assault and fire again, only adjacent to the hex taken", () => {
    const session = open(UnitType.TANK);
    tapHex(ADJACENT);
    choose("Infantería");
    choose("Disparar 3 dados");

    expect(screen.getByTestId("take-ground")).toBeInTheDocument();
    choose("Tomar terreno");
    choose("Disparar otra vez (queda 1)");

    expect(screen.getByTestId("firing-unit")).toHaveTextContent("Solo asalto cercano");
    expect(hasBadge({ row: 5, col: 1 })).toBe(true); // next to the hex taken
    expect(hasBadge({ row: 4, col: 1 })).toBe(false);
    tapHex({ row: 5, col: 1 });
    choose("Tanque");
    choose("Disparar 3 dados");

    expect(session.getSnapshot().shots).toHaveLength(2);
    expect(screen.queryByTestId("take-ground")).not.toBeInTheDocument();
  });

  it("doesn't offer taking ground to infantry, or after a shot at range", () => {
    open(UnitType.INFANTRY);
    tapHex(ADJACENT);
    choose("Infantería");
    choose("Disparar 3 dados");

    expect(screen.queryByTestId("take-ground")).not.toBeInTheDocument();
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

  it("adds a dice combat card to a quick roll when the player uses it", () => {
    const spotter: CombatCard = {
      id: "spotter",
      name: "Observador",
      description: "",
      cost: 0,
      phase: "battle",
      effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] },
    };
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: "",
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { [UnitType.ARTILLERY]: [UNIT] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [new CommandCard({ id: "left", sections: [Side.LEFT], orders: 1 })],
      combatCards: [spotter],
      random: () => 0.5,
    });
    session.startFirstTurn();
    session.pickCard(session.getSnapshot().hand[0]!);
    session.issueOrder(UNIT, UNIT);
    session.commitOrders();
    session.startMovement();
    session.startBattle();
    session.playBattleCombatCard(spotter);
    render(<Harness session={session} />);
    fireEvent.click(screen.getByText("abrir"));

    choose(/Tirada rápida/);
    choose("2");
    quickTarget();
    const useCard = within(screen.getByRole("group", { name: "Usar Observador" }));
    expect(screen.getByRole("button", { name: "Disparar 2 dados" })).toBeDisabled();
    fireEvent.click(useCard.getByRole("button", { name: "Sí" }));
    choose("Disparar 3 dados");

    expect(session.getSnapshot().shots[0]).toMatchObject({ dice: 3, combatBonus: true });
    expect(screen.getByTestId("shot-result")).toHaveTextContent("Tirada rápida +2 · Carta Observador +1");
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
    expect(screen.getByTestId("fire-map")).toBeInTheDocument();
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
});
