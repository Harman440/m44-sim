import { useCallback, useState, useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardsView, { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./CardsView";
import CommandCard from "../../../game-core/commandCard";
import { Side } from "../../../types/hex";
import { CombatCard } from "../../../game-core/combatCard";
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

    expect(onCardClick).toHaveBeenCalledWith(card, "center", undefined);
  });

  it("can be cancelled", () => {
    const { onCardClick } = render1();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCardClick).not.toHaveBeenCalled();
  });
});

describe("CardsView combat cards", () => {
  const combat = (id: string, phase: CombatCard["phase"], cost: number): CombatCard => ({
    id,
    name: id,
    description: `Texto de ${id}`,
    cost,
    phase,
  });

  const renderWith = (props: Partial<Parameters<typeof CardsView>[0]> = {}) => {
    const card = new CommandCard({ id: "attack", name: "Ataque", orders: 2 });
    const onCardClick = vi.fn();
    const utils = render(
      <CardsView
        handCards={[card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
        combatHand={[combat("Barrera", "order", 4), combat("Emboscada", "battle", 3), combat("Refuerzos", "order", 6)]}
        canPlayCombatCards
        coins={5}
        {...props}
      />
    );
    const playCommandCard = () =>
      fireEvent.click(within(utils.container.querySelector(".cards-grid") as HTMLElement).getByText(card.name));
    return { card, onCardClick, playCommandCard };
  };

  it("plays the order card picked with the command card", () => {
    const { card, onCardClick, playCommandCard } = renderWith();

    fireEvent.click(screen.getByRole("button", { name: "Barrera, 4 monedas" }));
    expect(screen.getByText(/Jugarás Barrera \(4 monedas\)/)).toBeInTheDocument();
    playCommandCard();

    expect(onCardClick).toHaveBeenCalledWith(card, undefined, expect.objectContaining({ id: "Barrera" }));
  });

  it("offers only the order cards the player can pay for", () => {
    renderWith();

    expect(screen.queryByRole("button", { name: /Refuerzos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Emboscada/ })).not.toBeInTheDocument();
    expect(screen.getByText("Texto de Emboscada")).toBeInTheDocument();
  });

  it("plays none in the attacker's extra turn", () => {
    const { card, onCardClick, playCommandCard } = renderWith({ canPlayCombatCards: false });

    expect(screen.getByText("En el turno extra no se juegan cartas de combate.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Barrera/ })).not.toBeInTheDocument();
    playCommandCard();
    expect(onCardClick).toHaveBeenCalledWith(card, undefined, undefined);
  });
});

describe("CardsView Tactician", () => {
  it("asks for the new section when Tactician is played with a one-section card", () => {
    const card = new CommandCard({ id: "attack-left", name: "Ataque en el flanco izquierdo", sections: [Side.LEFT], orders: 3 });
    const tactician: CombatCard = { id: "tactician", name: "Táctico", description: "", cost: 0, phase: "order", effect: { kind: "changeSection" } };
    const onCardClick = vi.fn();
    const { container } = render(
      <CardsView
        handCards={[card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
        needsSection={(c, combat) => combat?.effect?.kind === "changeSection" && c.sections !== "chosen" && c.sections.length === 1}
        combatHand={[tactician]}
        canPlayCombatCards
        coins={0}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Táctico, 0 monedas" }));
    fireEvent.click(within(container.querySelector(".cards-grid") as HTMLElement).getByText(card.name));
    expect(screen.getByText("Táctico: ¿a qué sección cambias Ataque en el flanco izquierdo?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "flanco derecho" }));

    expect(onCardClick).toHaveBeenCalledWith(card, Side.RIGHT, tactician);
  });
});
