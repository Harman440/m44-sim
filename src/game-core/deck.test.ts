import { describe, expect, it } from "vitest";
import Deck from "./deck";
import CommandCard from "./commandCard";

const makeCards = (n: number) =>
  Array.from({ length: n }, (_, i) => new CommandCard({ id: `card-${i}` }));

describe("Deck", () => {
  it("draws the requested number of cards from the draw pile", () => {
    const deck = new Deck(makeCards(5));

    const drawn = deck.draw(2);

    expect(drawn).toHaveLength(2);
    expect(deck.getDrawPileCount()).toBe(3);
  });

  it("reshuffles the discard pile when the draw pile runs short", () => {
    const deck = new Deck(makeCards(2));
    const [first, second] = deck.draw(2);
    deck.discard(first!);
    deck.discard(second!);

    const drawn = deck.draw(1);

    expect(drawn).toHaveLength(1);
    expect(deck.getDiscardPileCount()).toBe(0);
    expect(deck.getDrawPileCount()).toBe(1);
  });

  it("returns an empty array when no cards are left anywhere", () => {
    const deck = new Deck([]);

    expect(deck.draw(1)).toEqual([]);
  });
});
