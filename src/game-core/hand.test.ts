import { describe, expect, it, vi } from "vitest";
import Hand from "./hand";
import CommandCard from "./commandCard";

const card = (id: string) => new CommandCard({ id });

describe("Hand", () => {
  it("copies the initial cards so the caller's array is not shared", () => {
    const initial = [card("a")];
    const hand = new Hand(initial);

    initial.push(card("b"));

    expect(hand.cards).toHaveLength(1);
  });

  it("adds cards and ignores null", () => {
    const hand = new Hand();

    hand.add(card("a"));
    hand.add(null);
    hand.addMultiple([card("b"), card("c")]);

    expect(hand.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("removes a card by identity, not by id", () => {
    const a = card("same");
    const b = card("same");
    const hand = new Hand([a, b]);

    hand.remove(a);

    expect(hand.cards).toEqual([b]);
  });

  it("returns null when picking an index out of bounds", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const hand = new Hand([card("a")]);

    expect(hand.pickCard(0)?.id).toBe("a");
    expect(hand.pickCard(1)).toBeNull();
    expect(hand.pickCard(-1)).toBeNull();
  });

  it("getCards returns a copy", () => {
    const hand = new Hand([card("a")]);

    hand.getCards().pop();

    expect(hand.cards).toHaveLength(1);
  });
});
