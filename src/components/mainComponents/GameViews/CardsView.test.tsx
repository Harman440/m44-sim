import { useCallback, useState, useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardsView, { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./CardsView";
import CommandCard from "../../../game-core/commandCard";
import GameSession from "../../../game-core/gameSession";

const makeSession = (cardNames: string[], initialHandSize: number) =>
  new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: "",
      initialHandSize: { allies: 3, axis: 3 },
      attacker: "Allies",
      tiles: {},
      units: { allies: {}, axis: {} },
    },
    faction: "Allies",
    initialHandSize,
    commandCards: cardNames.map((name) => new CommandCard({ id: name, name })),
  });

const nameOf = (card: CommandCard) => card.name;

// Wires CardsView to a real session the way GameView does
function Harness({
  session,
  initialDealt = [],
  onCardClick,
}: {
  session: GameSession;
  initialDealt?: string[];
  onCardClick?: (card: CommandCard) => void;
}) {
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [dealt, setDealt] = useState<ReadonlySet<string>>(() => new Set(initialDealt));
  const onCardDealt = useCallback(
    (c: CommandCard) => setDealt((prev) => new Set(prev).add(c.id)),
    []
  );

  return (
    <CardsView
      handCards={game.hand}
      drawPileCount={game.drawPileCount}
      discardPileCount={game.discardPileCount}
      dealtCardIds={dealt}
      onCardDealt={onCardDealt}
      onCardClick={onCardClick ?? ((card) => session.pickCard(card))}
    />
  );
}

const handNames = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".cards-grid .card-title")).map((el) => el.textContent);

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
  it("deals cards that haven't been shown yet, one at a time", () => {
    const session = makeSession(["A", "B"], 2);
    const [first, second] = session.getSnapshot().hand.map(nameOf);
    const { container } = render(<Harness session={session} />);

    expect(handNames(container)).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(DEAL_GAP_MS);
    });
    expect(screen.getByTestId("animating-card")).toHaveTextContent(first!);

    act(() => {
      vi.advanceTimersByTime(DEAL_ANIMATION_MS);
    });
    expect(handNames(container)).toEqual([first]);

    dealOneCard();
    expect(handNames(container)).toEqual([first, second]);
    expect(screen.queryByTestId("animating-card")).not.toBeInTheDocument();
  });

  it("shows already dealt cards straight away and only animates the new one", () => {
    const session = makeSession(["A", "B", "C"], 3);
    const hand = session.getSnapshot().hand.map(nameOf);
    const { container } = render(
      <Harness session={session} initialDealt={hand.slice(0, 2)} />
    );

    expect(handNames(container)).toEqual(hand.slice(0, 2));

    dealOneCard();
    expect(handNames(container)).toEqual(hand);
  });
});

describe("CardsView playing a card in a section of the player's choice", () => {
  const render1 = (onCardClick = vi.fn()) => {
    const card = new CommandCard({ id: "assault", name: "Asalto de infantería", sections: "chosen", orders: "all" });
    const utils = render(
      <CardsView
        handCards={[card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
        needsSection={(c) => c.choosesSection}
      />
    );
    fireEvent.click(within(utils.container.querySelector(".cards-grid") as HTMLElement).getByText(card.name));
    return { card, onCardClick };
  };

  it("asks for the section, then plays the card in it", () => {
    const { card, onCardClick } = render1();

    expect(onCardClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "centro" }));

    expect(onCardClick).toHaveBeenCalledWith(card, "center");
  });

  it("can be cancelled", () => {
    const { onCardClick } = render1();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
