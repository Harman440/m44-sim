import { afterEach, describe, expect, it, vi } from "vitest";
import { cardScaleRef } from "./cardScale";

/** A stand-in for the browser's ResizeObserver (jsdom has none): reports the sizes it is told */
class FakeObserver {
  static last: FakeObserver;
  observed = new Set<Element>();
  constructor(private callback: ResizeObserverCallback) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {}
  resize(target: Element, width: number) {
    this.callback([{ target, contentRect: { width } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

describe("cardScaleRef", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes the card's width over 180px as --card-scale, and stops watching when the card goes", () => {
    vi.stubGlobal("ResizeObserver", FakeObserver);
    const card = document.createElement("div");
    const cleanup = cardScaleRef(card);
    const observer = FakeObserver.last;
    expect(observer.observed.has(card)).toBe(true);

    observer.resize(card, 90);
    expect(card.style.getPropertyValue("--card-scale")).toBe("0.5");

    // Hidden (0 wide): keeps its scale
    observer.resize(card, 0);
    expect(card.style.getPropertyValue("--card-scale")).toBe("0.5");

    cleanup?.();
    expect(observer.observed.has(card)).toBe(false);
  });
});
