import { useCallback, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardsView, { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./CardsView";
import CommandCard from "../../../game-core/commandCard";
import Deck from "../../../game-core/deck";

const card = (name: string) => new CommandCard({ id: name, name });

// Holds the hand and dealt ids the way GameView does
function Harness({
  deck,
  initialHand,
  initialDealt = [],
  onCardClick = () => {},
}: {
  deck: Deck;
  initialHand: CommandCard[];
  initialDealt?: string[];
  onCardClick?: (card: CommandCard) => void;
}) {
  const [hand, setHand] = useState(initialHand);
  const [dealt, setDealt] = useState<ReadonlySet<string>>(() => new Set(initialDealt));
  const onCardDealt = useCallback(
    (c: CommandCard) => setDealt((prev) => new Set(prev).add(c.id)),
    []
  );
  const onAddCardToHand = useCallback((c: CommandCard) => setHand((prev) => [...prev, c]), []);

  return (
    <CardsView
      commandCardsDeck={deck}
      handCards={hand}
      dealtCardIds={dealt}
      onCardDealt={onCardDealt}
      onAddCardToHand={onAddCardToHand}
      onCardClick={onCardClick}
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
    const { container } = render(
      <Harness deck={new Deck([])} initialHand={[card("A"), card("B")]} />
    );

    expect(handNames(container)).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(DEAL_GAP_MS);
    });
    expect(screen.getByTestId("animating-card")).toHaveTextContent("A");

    act(() => {
      vi.advanceTimersByTime(DEAL_ANIMATION_MS);
    });
    expect(handNames(container)).toEqual(["A"]);

    dealOneCard();
    expect(handNames(container)).toEqual(["A", "B"]);
    expect(screen.queryByTestId("animating-card")).not.toBeInTheDocument();
  });

  it("shows already dealt cards straight away and only animates the new one", () => {
    const { container } = render(
      <Harness
        deck={new Deck([])}
        initialHand={[card("A"), card("B"), card("New")]}
        initialDealt={["A", "B"]}
      />
    );

    expect(handNames(container)).toEqual(["A", "B"]);

    dealOneCard();
    expect(handNames(container)).toEqual(["A", "B", "New"]);
  });
});

describe("CardsView choosing between 2 cards", () => {
  const setup = (onCardClick = vi.fn()) => {
    const deck = new Deck([card("X"), card("Y"), card("Z")]);
    const utils = render(
      <Harness deck={deck} initialHand={[card("A")]} initialDealt={["A"]} onCardClick={onCardClick} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Coge 2 Cartas" }));
    return { deck, onCardClick, ...utils };
  };

  it("locks the button while a choice is open", () => {
    const { deck } = setup();

    expect(screen.getByRole("button", { name: "Coge 2 Cartas" })).toBeDisabled();
    expect(deck.getDrawPileCount()).toBe(1);
  });

  it("adds the chosen card to the hand and discards the other", () => {
    const { deck, container } = setup();
    const choiceArea = container.querySelector(".choice-area") as HTMLElement;
    const [chosen, other] = Array.from(choiceArea.querySelectorAll(".card-title")).map(
      (el) => el.textContent!
    );

    fireEvent.click(within(choiceArea).getByText(chosen!));
    dealOneCard();

    expect(handNames(container)).toEqual(["A", chosen]);
    expect(deck.discardPile.map((c) => c.name)).toEqual([other]);
    expect(container.querySelector(".choice-area")).toBeNull();
    expect(screen.getByRole("button", { name: "Coge 2 Cartas" })).toBeEnabled();
  });

  it("doesn't let you play a card until you have chosen", () => {
    const { onCardClick, container } = setup();

    fireEvent.click(within(container.querySelector(".cards-grid") as HTMLElement).getByText("A"));

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByText("Primero elige una de las dos cartas")).toBeInTheDocument();
  });
});
