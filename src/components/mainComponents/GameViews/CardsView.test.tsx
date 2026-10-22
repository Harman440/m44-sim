import { useCallback, useState, useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardsView, { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./CardsView";
import GameSession from "../../../game-core/gameSession";
import type { ActionCard } from "../../../game-core/actionCard";
import { actionCardById } from "../../../data/actionCards";
import { same } from "../../../i18n/lang";
import { DEFAULT_SETTINGS, SettingsContext } from "../../../settings";

/** A side at turn 1, with these supplies */
const makeSession = (coins = 0) => {
  const session = new GameSession({
    scenario: {
      id: "test",
      name: { es: "Test", en: "Test" },
      description: same(""),
      initialHandSize: { allies: 3, axis: 3 },
      attacker: "Axis",
      tiles: {},
      units: { allies: { infantry: [{ row: 7, col: 1 }] }, axis: {} },
    },
    faction: "Allies",
  });
  if (coins > 0) session.adjustCoins(coins);
  return session;
};

// Wires CardsView to a real session the way GameView does
function Harness({
  session,
  initialDealt,
  onPlay,
}: {
  session: GameSession;
  initialDealt?: string[];
  onPlay?: (card: ActionCard | null) => void;
}) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [dealt, setDealt] = useState<ReadonlySet<string>>(() => new Set(initialDealt ?? game.cards.map(({ card }) => card.id)));
  const onCardDealt = useCallback((c: ActionCard) => setDealt((prev) => new Set(prev).add(c.id)), []);
  return (
    <CardsView
      cards={game.cards}
      dealtCardIds={dealt}
      onCardDealt={onCardDealt}
      onPlay={onPlay ?? ((card) => session.pickCard(card))}
      coins={game.coins}
    />
  );
}

const handKeys = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".cards-hands [data-card-key]")).map((el) => el.getAttribute("data-card-key"));

/** A card in the hand, by its id */
const handCard = (container: HTMLElement, id: string) =>
  container.querySelector(`.cards-hands [data-card-key="${id}"] .game-card`) as HTMLElement;

// Each step's timer is only scheduled after React re-renders, so advance them separately
const dealOneCard = () => {
  act(() => {
    vi.advanceTimersByTime(DEAL_GAP_MS);
  });
  act(() => {
    vi.advanceTimersByTime(DEAL_ANIMATION_MS);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CardsView dealing", () => {
  it("deals the cards that haven't been shown yet, one at a time", () => {
    const session = makeSession();
    const ids = session.getSnapshot().cards.map(({ card }) => card.id);
    const { container } = render(<Harness session={session} initialDealt={ids.slice(0, -2)} />);

    expect(handKeys(container)).toEqual(ids.slice(0, -2));
    act(() => {
      vi.advanceTimersByTime(DEAL_GAP_MS);
    });
    expect(screen.getByTestId("animating-card")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(DEAL_ANIMATION_MS);
    });
    expect(handKeys(container)).toEqual(ids.slice(0, -1));

    dealOneCard();
    expect(handKeys(container)).toEqual(ids);
    expect(screen.queryByTestId("animating-card")).not.toBeInTheDocument();
  });
});

describe("CardsView picking a card", () => {
  it("puts a card it can pay for in the tray, and plays it", () => {
    const session = makeSession(20);
    const onPlay = vi.fn();
    const { container } = render(<Harness session={session} onPlay={onPlay} />);

    fireEvent.click(handCard(container, "resupply"));
    const tray = screen.getByRole("region", { name: "Tu jugada" });
    expect(within(tray).getByRole("button", { name: "Quitar Reabastecimiento" })).toBeInTheDocument();
    expect(handKeys(container)).not.toContain("resupply");
    expect(screen.queryByRole("button", { name: "Sin carta" })).toBeNull(); // only the button that fits is shown

    fireEvent.click(screen.getByRole("button", { name: "Jugar" }));
    expect(onPlay).toHaveBeenCalledWith(actionCardById("resupply"));
  });

  it("plays no card with Sin carta", () => {
    const session = makeSession();
    const onPlay = vi.fn();
    render(<Harness session={session} onPlay={onPlay} />);

    expect(screen.queryByRole("button", { name: "Jugar" })).toBeNull(); // only the button that fits is shown
    fireEvent.click(screen.getByRole("button", { name: "Sin carta" }));
    expect(onPlay).toHaveBeenCalledWith(null);
  });

  it("puts the card back in the hand from the tray", () => {
    const session = makeSession(20);
    const { container } = render(<Harness session={session} />);

    fireEvent.click(handCard(container, "refuel"));
    fireEvent.click(screen.getByRole("button", { name: "Quitar Repostaje" }));
    expect(handKeys(container)).toContain("refuel");
    expect(screen.queryByRole("button", { name: "Jugar" })).toBeNull(); // only the button that fits is shown
  });

  it("swaps the card in the tray for another from the table", () => {
    const session = makeSession(20);
    const { container } = render(<Harness session={session} />);

    fireEvent.click(handCard(container, "refuel"));
    fireEvent.click(handCard(container, "resupply"));
    fireEvent.click(screen.getByRole("button", { name: "Cambiar por esta" }));
    const tray = screen.getByRole("region", { name: "Tu jugada" });
    expect(within(tray).getByRole("button", { name: "Quitar Reabastecimiento" })).toBeInTheDocument();
    expect(handKeys(container)).toContain("refuel");
  });
});

describe("CardsView cards that can't be played now", () => {
  it("fades a card the side can't pay for, and says why on the table", () => {
    const session = makeSession(9);
    const { container } = render(<Harness session={session} />);

    expect(container.querySelector('[data-card-key="resupply"]')).toHaveClass("hand-card--playable");
    expect(container.querySelector('[data-card-key="finest-hour"]')).not.toHaveClass("hand-card--playable");
    fireEvent.click(handCard(container, "finest-hour"));
    expect(screen.getByText("Te faltan suministros: cuesta 15 suministros y tienes 9 suministros.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir" })).not.toBeInTheDocument();
  });

  it("shows a card's cooldown on it and says when it comes back", () => {
    const session = makeSession(20);
    // Played on turn 2: it waits until turn 5
    session.pickCard(actionCardById("refuel")!);
    session.commitOrders();
    session.startBattle();
    session.endBattle();
    session.endTurn();
    const { container } = render(<Harness session={session} />);

    const refuel = container.querySelector('[data-card-key="refuel"]')!;
    expect(within(refuel as HTMLElement).getByTestId("card-cooldown")).toHaveTextContent("2");
    fireEvent.click(handCard(container, "refuel"));
    expect(screen.getByText("Se jugó hace poco: vuelve en 2 turnos.")).toBeInTheDocument();
  });

});

describe("CardsView back from the orders", () => {
  it("starts with the card played in the tray", () => {
    const session = makeSession(20);
    const cards = session.getSnapshot().cards;
    render(
      <CardsView
        cards={cards}
        dealtCardIds={new Set(cards.map(({ card }) => card.id))}
        onCardDealt={() => {}}
        onPlay={() => {}}
        coins={20}
        initialPick={actionCardById("resupply")!}
      />
    );
    const tray = screen.getByRole("region", { name: "Tu jugada" });
    expect(within(tray).getByRole("button", { name: "Quitar Reabastecimiento" })).toBeInTheDocument();
  });
});

describe("CardsView putting the cards away", () => {
  it("shows the map beside the tray, and alone once the cards are put away, keeping the pick", () => {
    const session = makeSession(20);
    const cards = session.getSnapshot().cards;
    const { container } = render(
      <CardsView
        cards={cards}
        dealtCardIds={new Set(cards.map(({ card }) => card.id))}
        onCardDealt={() => {}}
        onPlay={() => {}}
        coins={20}
        largeMap={<div data-testid="large-map" />}
      />
    );
    expect(container.querySelector(".cards-table__map [data-testid=large-map]")).not.toBeNull();
    fireEvent.click(handCard(container, "resupply"));

    fireEvent.click(screen.getByRole("button", { name: "Guardar las cartas y ver el mapa" }));
    expect(screen.getByTestId("large-map")).toBeInTheDocument();
    expect(container.querySelector(".cards-table")).toBeNull();
    expect(container.querySelector(".cards-hands")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Volver a las cartas" }));
    const tray = screen.getByRole("region", { name: "Tu jugada" });
    expect(within(tray).getByRole("button", { name: "Quitar Reabastecimiento" })).toBeInTheDocument();
  });

  it("has no bar without a map to show (own tablets)", () => {
    render(<CardsView cards={[]} dealtCardIds={new Set()} onCardDealt={() => {}} onPlay={() => {}} />);
    expect(screen.queryByTestId("hand-away-bar")).not.toBeInTheDocument();
  });
});

describe("CardsView in English", () => {
  it("speaks English when the player picked it", () => {
    const session = makeSession(20);
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <Harness session={session} />
      </SettingsContext.Provider>
    );
    expect(screen.getByRole("button", { name: "No card" })).toBeInTheDocument();
    expect(screen.getByText("Pick a card, or play without one")).toBeInTheDocument();
  });
});
