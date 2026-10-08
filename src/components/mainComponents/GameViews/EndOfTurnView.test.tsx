import { useState, useSyncExternalStore } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EndOfTurnView from "./EndOfTurnView";
import GameSession from "../../../game-core/gameSession";
import CommandCard from "../../../game-core/commandCard";
import { CombatCard } from "../../../game-core/combatCard";
import { Side } from "../../../types/hex";
import { Position } from "../../../types/scenario";
import { UnitType } from "../../../game-core/unit";
import { same } from "../../../i18n/lang";

const INFANTRY: Position = { row: 7, col: 1 };
const TANK: Position = { row: 7, col: 3 };
const EMPTY: Position = { row: 2, col: 2 };

// A session in the final phase, after a battle where both units held
const makeFinalSession = () => {
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
    commandCards: [new CommandCard({ id: "left", name: same("Ataque"), sections: [Side.LEFT], orders: 2 })],
  });
  session.pickCard(session.getSnapshot().hand[0]!);
  session.issueOrder(INFANTRY, INFANTRY);
  session.issueOrder(TANK, TANK);
  session.commitOrders();
  session.startBattle();
  session.endBattle();
  return session;
};

function Harness({ session }: { session: GameSession }) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  // As in GameView: the hand before the final phase was already dealt
  const [dealt, setDealt] = useState<ReadonlySet<string>>(() => {
    const { hand, drawnCard, extraDrawn } = session.getSnapshot();
    return new Set(hand.filter((card) => card !== drawnCard && card !== extraDrawn).map((card) => card.id));
  });
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
  it("puts no sandbags on this side's units without Fortify", () => {
    const { tap } = setup();

    tap(INFANTRY);
    expect(screen.queryByRole("button", { name: /poner sacos terreros/i })).not.toBeInTheDocument();
  });

  it("opens the map from the retreats step and counts the changes when back", () => {
    const { container, tap } = setup({ openMap: false });
    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.queryByTestId("map-edits")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar mapa" }));
    tap(INFANTRY);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar unidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));

    expect(container.querySelector("svg.board__svg")).toBeNull();
    expect(screen.getByTestId("map-edits")).toHaveTextContent("1 cambio");
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
  // Plays `card` (1 hold order on the left), with 3 plain cards left in the deck
  // and `combatInHand` combat cards in hand (4 in the combat deck).
  // Turn 1 is the attacker's extra turn; from turn 2 the final phase gives coins.
  const finalAfter = (card: CommandCard, turn = 1, combatInHand = 0) => {
    const combatDeck: CombatCard[] = ["C1", "C2", "C3", "C4"].map((name) => ({
      id: name,
      name: same(name),
      description: same(""),
      cost: 1,
      phase: "battle",
    }));
    const combatIds = combatDeck.map((c) => c.id);
    const deck = ["X", "Y", "Z"].map((name) => new CommandCard({ id: name, name: same(name), orders: 1 }));
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: same(""),
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
      {
        ...session.save(),
        turn,
        hand: [card.id],
        drawPile: deck.map((c) => c.id),
        combatHand: combatIds.slice(0, combatInHand),
        combatDrawPile: combatIds.slice(combatInHand),
      },
      session.scenario,
      [card, ...deck],
      combatDeck
    );
    restored.pickCard(card);
    restored.issueOrder(INFANTRY, INFANTRY);
    restored.commitOrders();
    restored.startBattle();
    restored.endBattle();
    render(<Harness session={restored} />);
    return restored;
  };

  /** Waits for the cards and supplies in the air to land */
  const landed = () => waitFor(() => expect(screen.queryByTestId("flight")).not.toBeInTheDocument());
  const hand = () => within(screen.getByRole("list", { name: "Tu mano" }));

  it("lays the 3 cards drawn after Recon on the table and keeps the one tapped, with no swap", async () => {
    const session = finalAfter(
      new CommandCard({ id: "recon", name: same("Reconocimiento"), sections: [Side.LEFT], orders: 1, drawChoice: 3 })
    );

    expect(screen.getAllByRole("button", { name: /^Elegir / })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Descartar y robar otra" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Elegir Y" }));
    expect(session.getSnapshot().hand.map((c) => c.name.es)).toEqual(["Y"]);
    // Y flies into the hand, X and Z to the discard pile
    expect(screen.getAllByTestId("flight")).toHaveLength(3);
    await landed();
    expect(hand().getByRole("button", { name: "Y" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Información: Carta de mando" }));
    expect(screen.getByText(/Reconocimiento: robas 3 cartas de tu mazo y te quedas con 1\./)).toBeInTheDocument();
  });

  it("adds the Preparations coins and draws its combat card, with no choice", async () => {
    const session = finalAfter(
      new CommandCard({
        id: "preparations",
        name: same("Preparativos"),
        orders: 1,
        endOfTurnReward: { coins: 3, combatCard: true },
      }),
      2
    );

    expect(screen.getByTestId("end-of-turn-reward")).toHaveTextContent("+3 suministros y una carta de combate.");
    expect(screen.queryByRole("button", { name: /2 suministros/ })).not.toBeInTheDocument();
    expect(session.getSnapshot().coins).toBe(3);
    expect(screen.getByRole("button", { name: "Empezar turno 3" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Robar carta de combate" }));

    expect(screen.getByText("Has robado C1.")).toBeInTheDocument();
    expect(session.getSnapshot().combatHand).toHaveLength(1);
    await landed();
    expect(hand().getByRole("button", { name: /^C1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar turno 3" })).toBeEnabled();
  });

  it("switches between 2 supplies and a combat card freely, and takes the supplies with Confirmar", async () => {
    const session = finalAfter(new CommandCard({ id: "plain", name: same("Ataque"), orders: 1 }), 2);
    const coins = screen.getByRole("button", { name: /2 suministros/ });
    const combatCard = screen.getByRole("button", { name: /^Carta de combate/ });
    expect(coins).toHaveAttribute("aria-pressed", "true");
    await landed();
    const start = screen.getByRole("button", { name: "Empezar turno 3" });
    expect(start).toBeDisabled(); // nothing taken yet

    fireEvent.click(combatCard);
    expect(combatCard).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(coins);
    fireEvent.click(combatCard);
    fireEvent.click(coins);
    expect(coins).toHaveAttribute("aria-pressed", "true");
    // Weighing them takes nothing
    expect(session.getSnapshot()).toMatchObject({ coins: 0, rewardChoice: null, combatHand: [] });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(session.getSnapshot()).toMatchObject({ coins: 2, rewardChoice: "coins" });
    expect(screen.getByTestId("end-of-turn-reward")).toHaveTextContent("Te llevas 2 suministros.");
    expect(screen.queryByRole("button", { name: /2 suministros/ })).not.toBeInTheDocument();
    fireEvent.click(start);
    expect(session.getSnapshot().turn).toBe(3);
  });

  it("flies the supplies to the counter before counting them", async () => {
    const session = finalAfter(new CommandCard({ id: "plain", name: same("Ataque"), orders: 1 }), 2);
    await landed();
    const counter = document.createElement("div");
    counter.dataset.testid = "coin-counter";
    document.body.append(counter);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getAllByTestId("flight")).toHaveLength(2);
    expect(session.getSnapshot().coins).toBe(0);
    await landed();
    expect(session.getSnapshot().coins).toBe(2);
    counter.remove();
  });

  it("draws the combat card confirmed and flies it into the hand", async () => {
    const session = finalAfter(new CommandCard({ id: "plain", name: same("Ataque"), orders: 1 }), 2);
    await landed();

    fireEvent.click(screen.getByRole("button", { name: /^Carta de combate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(session.getSnapshot()).toMatchObject({ coins: 0, rewardChoice: "combatCard" });
    expect(screen.getByText("Has robado C1.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Carta de combate/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("flight")).toBeInTheDocument();
    await landed();
    expect(hand().getByRole("button", { name: /^C1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar turno 3" }));
    expect(session.getSnapshot().turn).toBe(3);
  });

  it("lays the combat cards on the table to discard one when the hand goes over 3, then puts the rest back", async () => {
    const session = finalAfter(new CommandCard({ id: "plain", name: same("Ataque"), orders: 1 }), 2, 3);
    await landed();
    expect(hand().getAllByRole("button", { name: /^C\d/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /^Carta de combate/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const table = within(screen.getByTestId("discard-combat-card"));
    expect(table.getAllByRole("button", { name: /^Descartar / })).toHaveLength(4);
    expect(hand().queryAllByRole("button", { name: /^C\d/ })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Empezar turno 3" })).toBeDisabled();
    fireEvent.click(table.getByRole("button", { name: "Descartar C1" }));

    expect(session.getSnapshot().combatHand.map((c) => c.id)).toEqual(["C2", "C3", "C4"]);
    expect(screen.queryByTestId("discard-combat-card")).not.toBeInTheDocument();
    // C1 to the discard pile, the other three back into the hand
    expect(screen.getAllByTestId("flight")).toHaveLength(4);
    await landed();
    expect(hand().getAllByRole("button", { name: /^C\d/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Empezar turno 3" })).toBeEnabled();
  });

  it("gives no final-phase reward in the attacker's extra turn", async () => {
    finalAfter(new CommandCard({ id: "plain", name: same("Ataque"), orders: 1 }));

    expect(screen.getByTestId("end-of-turn-reward")).toHaveTextContent("Sin recompensa en el turno extra.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Empezar turno 2" })).toBeEnabled());
  });
});

describe("EndOfTurnView cards", () => {
  it("holds the hand at the bottom, the card drawn marked new, and shows a card's full text when it is tapped", async () => {
    const session = makeFinalSession();
    render(<Harness session={session} />);
    const drawn = session.getSnapshot().drawnCard!;
    await waitFor(() => expect(screen.queryByTestId("flight")).not.toBeInTheDocument());

    const slot = screen.getByRole("list", { name: "Tu mano" }).querySelector(`[data-card-key="${drawn.id}"]`)!;
    expect(slot).toHaveAttribute("data-label", "Nueva");
    expect(slot).not.toHaveClass("card-hand__slot--incoming");
    fireEvent.click(within(slot as HTMLElement).getByRole("button", { name: drawn.name.es }));

    expect(screen.getByRole("dialog", { name: "Carta" })).toBeInTheDocument();
    expect(screen.getByTestId("card-details")).toBeInTheDocument();
  });
});

describe("EndOfTurnView table reminders", () => {
  it("reminds the player to put the sandbags of Fortify on the table, and puts them on the map", () => {
    const fortify: CombatCard = {
      id: "fortify",
      name: same("Fortificar"),
      description: same(""),
      cost: 0,
      phase: "battle",
      tableReminder: same("Fortificar: pon sacos terreros en la mesa, en una infantería o artillería."),
      effect: { kind: "fortify", unitTypes: [UnitType.INFANTRY] },
    };
    const card = new CommandCard({ id: "left", sections: [Side.LEFT], orders: 1 });
    const session = new GameSession({
      scenario: {
        id: "test",
        name: "Test",
        description: same(""),
        initialHandSize: { allies: 1, axis: 1 },
        attacker: "Axis",
        tiles: {},
        units: { allies: { infantry: [INFANTRY] }, axis: {} },
      },
      faction: "Allies",
      initialHandSize: 1,
      commandCards: [card],
      combatCards: [fortify],
    });
    session.startFirstTurn();
    session.pickCard(card);
    session.issueOrder(INFANTRY, INFANTRY);
    session.commitOrders();
    session.startBattle();
    session.playBattleCombatCard(fortify);
    session.endBattle();
    const { container } = render(<Harness session={session} />);

    expect(screen.getByTestId("table-reminder")).toHaveTextContent("Fortificar: pon sacos terreros en la mesa");

    fireEvent.click(screen.getByRole("button", { name: "Actualizar mapa" }));
    expect(screen.getByText(/Fortificar: toca la infantería o artillería resaltada/)).toBeInTheDocument();
    fireEvent.click(container.querySelector(`[data-position="${INFANTRY.row}-${INFANTRY.col}"]`)!);
    fireEvent.click(screen.getByRole("button", { name: "Fortificar: poner sacos terreros" }));

    expect(session.board.getHex(INFANTRY)!.sandbags).toBe(true);
    expect(container.querySelector(`[data-position="${INFANTRY.row}-${INFANTRY.col}"] [data-testid="sandbags"]`)).not.toBeNull();
  });
});
