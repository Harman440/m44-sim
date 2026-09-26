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
  showDrawChoice,
}: {
  session: GameSession;
  initialDealt?: string[];
  onCardClick?: (card: CommandCard) => void;
  showDrawChoice?: boolean;
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
      choiceCards={game.choiceCards}
      drawPileCount={game.drawPileCount}
      discardPileCount={game.discardPileCount}
      dealtCardIds={dealt}
      onCardDealt={onCardDealt}
      onDrawChoice={() => session.drawChoice()}
      onChooseCard={(card) => session.chooseCard(card)}
      onCardClick={onCardClick ?? ((card) => session.pickCard(card))}
      showDrawChoice={showDrawChoice}
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

describe("CardsView choosing between 2 cards", () => {
  const setup = (onCardClick = vi.fn()) => {
    const session = makeSession(["A", "X", "Y", "Z"], 1);
    const [handCard] = session.getSnapshot().hand.map(nameOf);
    const utils = render(
      <Harness session={session} initialDealt={[handCard!]} onCardClick={onCardClick} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Coge 2 Cartas" }));
    return { session, handCard: handCard!, onCardClick, ...utils };
  };

  it("locks the button while a choice is open", () => {
    const { session } = setup();

    expect(screen.getByRole("button", { name: "Coge 2 Cartas" })).toBeDisabled();
    expect(session.getSnapshot().drawPileCount).toBe(1);
  });

  it("adds the chosen card to the hand and discards the other", () => {
    const { session, handCard, container } = setup();
    const choiceArea = container.querySelector(".choice-area") as HTMLElement;
    const [chosen, other] = Array.from(choiceArea.querySelectorAll(".card-title")).map(
      (el) => el.textContent!
    );

    fireEvent.click(within(choiceArea).getByText(chosen!));
    dealOneCard();

    expect(handNames(container)).toEqual([handCard, chosen]);
    expect(session.getSnapshot().discardPileCount).toBe(1);
    expect(screen.getByText("Descarte (1)")).toBeInTheDocument();
    expect(screen.queryByText(other!)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coge 2 Cartas" })).toBeEnabled();
  });

  it("doesn't let you play a card until you have chosen", () => {
    const { onCardClick, handCard, container } = setup();

    fireEvent.click(
      within(container.querySelector(".cards-grid") as HTMLElement).getByText(handCard)
    );

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByText("Primero elige una de las dos cartas")).toBeInTheDocument();
  });

  it("hides the debug draw-2 button outside development", () => {
    render(<Harness session={makeSession(["A", "B", "C"], 2)} showDrawChoice={false} />);

    expect(screen.queryByRole("button", { name: "Coge 2 Cartas" })).not.toBeInTheDocument();
  });
});
