import { describe, expect, it } from "vitest";
import commandCards from "./commandCards";

describe("command card data", () => {
  it("gives every card a unique id (they are used as React keys)", () => {
    const ids = commandCards.map((card) => card.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
