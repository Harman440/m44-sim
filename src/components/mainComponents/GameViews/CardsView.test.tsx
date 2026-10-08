import { useCallback, useState, useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardsView, { DEAL_ANIMATION_MS, DEAL_GAP_MS } from "./CardsView";
import CommandCard from "../../../game-core/commandCard";
import { Side } from "../../../types/hex";
import { CombatCard } from "../../../game-core/combatCard";
import GameSession from "../../../game-core/gameSession";
import { same } from "../../../i18n/lang";

const makeSession = (cardNames: string[], initialHandSize: number) =>
  new GameSession({
    scenario: {
      id: "test",
      name: "Test",
      description: same(""),
      initialHandSize: { allies: 3, axis: 3 },
      attacker: "Allies",
      tiles: {},
      units: { allies: {}, axis: {} },
    },
    faction: "Allies",
    initialHandSize,
    commandCards: cardNames.map((name) => new CommandCard({ id: name, name: same(name) })),
  });

const nameOf = (card: CommandCard) => card.name.es;

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
  Array.from(container.querySelectorAll(".cards-hands .card-title")).map((el) => el.textContent);

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

/** Tap a command card in the hand: into the empty slot, or onto the table to swap it from there */
const pickFromHand = (container: HTMLElement, name: string) => {
  fireEvent.click(within(container.querySelector(".cards-hands") as HTMLElement).getByText(name));
  const pick = screen.queryByRole("button", { name: /^(Elegir|Cambiar por esta)$/ });
  if (pick) fireEvent.click(pick);
};

/** Pick a combat card from the hand by its button name (straight into the empty slot) */
const pickCombat = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const pressPlay = () => fireEvent.click(screen.getByRole("button", { name: "Jugar" }));

/** Pick a command card, then play what the tray holds */
const playFromHand = (container: HTMLElement, name: string) => {
  pickFromHand(container, name);
  pressPlay();
};

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
    const card = new CommandCard({ id: "assault", name: same("Asalto de infantería"), sections: "chosen", orders: "all" });
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
    playFromHand(utils.container, card.name.es);
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
    name: same(id),
    description: same(`Texto de ${id}`),
    cost,
    phase,
  });

  const renderWith = (props: Partial<Parameters<typeof CardsView>[0]> = {}) => {
    const card = new CommandCard({ id: "attack", name: same("Ataque"), orders: 2 });
    const onCardClick = vi.fn();
    const utils = render(
      <CardsView
        handCards={[card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
        combatHand={[combat("Cortina de Fuego", "order", 4), combat("Emboscada", "battle", 3), combat("Refuerzos", "order", 6)]}
        canPlayCombatCards
        coins={5}
        {...props}
      />
    );
    const playCommandCard = () => playFromHand(utils.container, card.name.es);
    return { card, onCardClick, playCommandCard };
  };

  it("plays the order card picked with the command card", () => {
    const { card, onCardClick, playCommandCard } = renderWith();

    pickCombat("Cortina de Fuego, 4 suministros");
    const tray = screen.getByRole("region", { name: "Tu jugada" });
    expect(within(tray).getByRole("button", { name: "Quitar Cortina de Fuego" })).toBeInTheDocument();
    playCommandCard();

    expect(onCardClick).toHaveBeenCalledWith(card, undefined, expect.objectContaining({ id: "Cortina de Fuego" }));
  });

  it("picks the cards in any order, and plays only when Jugar is pressed", () => {
    const { card, onCardClick } = renderWith();

    expect(screen.getByRole("button", { name: "Jugar" })).toBeDisabled();
    pickFromHand(document.body, card.name.es);
    pickCombat("Cortina de Fuego, 4 suministros");
    expect(onCardClick).not.toHaveBeenCalled();

    pressPlay();
    expect(onCardClick).toHaveBeenCalledWith(card, undefined, expect.objectContaining({ id: "Cortina de Fuego" }));
  });

  it("keeps the picked cards in the tray, out of the hand, until removed", () => {
    const { card, onCardClick } = renderWith();

    pickFromHand(document.body, card.name.es);
    pickCombat("Cortina de Fuego, 4 suministros");
    const hands = document.querySelector(".cards-hands") as HTMLElement;
    expect(within(hands).queryByText(card.name.es)).not.toBeInTheDocument();
    expect(within(hands).queryByRole("button", { name: "Cortina de Fuego, 4 suministros" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar Cortina de Fuego" }));
    expect(within(hands).getByRole("button", { name: "Cortina de Fuego, 4 suministros" })).toBeInTheDocument();

    pressPlay();
    expect(onCardClick).toHaveBeenCalledWith(card, undefined, undefined);
  });

  it("offers only the order cards the player can pay for, but shows them all", () => {
    renderWith();

    fireEvent.click(screen.getByRole("button", { name: "Refuerzos, 6 suministros" }));
    expect(screen.getByText("Te faltan suministros: cuesta 6 suministros y tienes 5 suministros.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elegir" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Emboscada, 3 suministros" }));
    expect(screen.getByText("Se juega durante la batalla.")).toBeInTheDocument();
    expect(within(screen.getByTestId("card-details")).getAllByText("Texto de Emboscada").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Elegir" })).not.toBeInTheDocument();
  });

  it("plays none in the attacker's extra turn", () => {
    const { card, onCardClick, playCommandCard } = renderWith({ canPlayCombatCards: false });

    expect(screen.getAllByText("En el turno extra no se juegan cartas de combate.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Cortina de Fuego, 4 suministros" }));
    expect(screen.queryByRole("button", { name: "Elegir" })).not.toBeInTheDocument();
    playCommandCard();
    expect(onCardClick).toHaveBeenCalledWith(card, undefined, undefined);
  });
});

describe("CardsView Tactician", () => {
  it("asks for the new section when Tactician is played with a one-section card", () => {
    const card = new CommandCard({ id: "attack-left", name: same("Ataque en el flanco izquierdo"), sections: [Side.LEFT], orders: 3 });
    const tactician: CombatCard = { id: "tactician", name: same("Táctico"), description: same(""), cost: 0, phase: "order", effect: { kind: "changeSection" } };
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

    pickCombat("Táctico, 0 suministros");
    playFromHand(container, card.name.es);
    expect(screen.getByText("Táctico: ¿a qué sección cambias Ataque en el flanco izquierdo?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "flanco derecho" }));

    expect(onCardClick).toHaveBeenCalledWith(card, Side.RIGHT, tactician);
  });
});

describe("CardsView Tactician with a card for several sections", () => {
  it("warns and won't play until one of the two is removed", () => {
    const card = new CommandCard({ id: "general-advance", name: same("Avance general"), orders: 6, perSection: 2 });
    const tactician: CombatCard = { id: "tactician", name: same("Táctico"), description: same(""), cost: 0, phase: "order", effect: { kind: "changeSection" } };
    const onCardClick = vi.fn();
    const { container } = render(
      <CardsView
        handCards={[card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
        combatCardFits={(c, combat) => combat.effect?.kind !== "changeSection" || (c.sections !== "chosen" && c.sections.length === 1)}
        combatHand={[tactician]}
        canPlayCombatCards
        coins={0}
      />
    );

    pickCombat("Táctico, 0 suministros");
    pickFromHand(container, card.name.es);
    expect(screen.getByRole("alert")).toHaveTextContent("Táctico no sirve con Avance general");
    expect(screen.getByRole("button", { name: "Jugar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Quitar Táctico" }));
    pressPlay();
    expect(onCardClick).toHaveBeenCalledWith(card, undefined, undefined);
  });
});

describe("CardsView looking at a card", () => {
  it("puts a tapped card straight in its empty slot, flying there, and shows its text, without playing it", () => {
    const card = new CommandCard({ id: "recon", name: same("Reconocimiento"), description: same("Texto completo del reconocimiento"), orders: 1 });
    const onCardClick = vi.fn();
    const { container } = render(
      <CardsView
        handCards={[card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
      />
    );

    fireEvent.click(within(container.querySelector(".cards-hands") as HTMLElement).getByText(card.name.es));

    const tray = screen.getByRole("region", { name: "Tu jugada" });
    expect(within(tray).getByRole("button", { name: "Quitar Reconocimiento" })).toBeInTheDocument();
    expect(screen.getByTestId("flight")).toBeInTheDocument();
    // Still "clicked": its text on the table, to put it back from there
    const details = screen.getByTestId("card-details");
    expect(within(details).getAllByText("Texto completo del reconocimiento").length).toBeGreaterThan(0);
    expect(within(details).getByRole("button", { name: "Devolver a la mano" })).toBeInTheDocument();
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("puts a tapped card on the table with its full text when its slot is taken, to swap it from there", () => {
    const first = new CommandCard({ id: "left", name: same("Ataque"), sections: [Side.LEFT], orders: 1 });
    const card = new CommandCard({ id: "recon", name: same("Reconocimiento"), description: same("Texto completo del reconocimiento"), orders: 1 });
    const onCardClick = vi.fn();
    const { container } = render(
      <CardsView
        handCards={[first, card]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set([first.id, card.id])}
        onCardDealt={() => {}}
        onCardClick={onCardClick}
      />
    );
    const hands = container.querySelector(".cards-hands") as HTMLElement;
    fireEvent.click(within(hands).getByText(first.name.es));

    fireEvent.click(within(hands).getByText(card.name.es));

    const details = screen.getByTestId("card-details");
    expect(within(details).getByRole("button", { name: "Cambiar por esta" })).toBeInTheDocument();
    expect(within(details).getAllByRole("heading", { name: "Reconocimiento" }).length).toBeGreaterThan(0);
    expect(within(details).getAllByText("Texto completo del reconocimiento").length).toBeGreaterThan(0);
    expect(onCardClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByTestId("card-details")).not.toBeInTheDocument();
    expect(screen.getByText("Toca una carta para verla")).toBeInTheDocument();
  });
});

describe("CardsView one hand", () => {
  it("holds the command cards by section, then the combat cards, playable order cards first", () => {
    const right = new CommandCard({ id: "right", name: same("Derecha"), sections: [Side.RIGHT], orders: 2 });
    const tactic = new CommandCard({ id: "tactic", name: same("Táctica"), tactic: true, orders: 1 });
    const left = new CommandCard({ id: "left", name: same("Izquierda"), sections: [Side.LEFT], orders: 2 });
    const battle: CombatCard = { id: "ambush", name: same("Emboscada"), description: same(""), cost: 1, phase: "battle" };
    const order: CombatCard = { id: "barrage", name: same("Cortina"), description: same(""), cost: 2, phase: "order" };
    const { container } = render(
      <CardsView
        handCards={[right, tactic, left]}
        drawPileCount={0}
        discardPileCount={0}
        dealtCardIds={new Set(["right", "tactic", "left"])}
        onCardDealt={() => {}}
        onCardClick={() => {}}
        combatHand={[battle, order]}
        canPlayCombatCards
        coins={5}
      />
    );

    const keys = Array.from(container.querySelectorAll(".cards-hands [data-card-key]")).map((el) => el.getAttribute("data-card-key"));
    expect(keys).toEqual(["left", "tactic", "right", "combat-barrage", "combat-ambush"]);
    expect(container.querySelector('[data-card-key="combat-barrage"]')).toHaveClass("hand-card--playable");
    expect(container.querySelector('[data-card-key="combat-ambush"]')).not.toHaveClass("hand-card--playable");
  });
});
