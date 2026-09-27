import { describe, expect, it } from "vitest";
import commandCards from "./commandCards";

describe("command card data", () => {
  it("gives every card a unique id (they are used as React keys)", () => {
    const ids = commandCards.map((card) => card.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 40 section cards and 17 tactic cards", () => {
    expect(commandCards.filter((card) => !card.tactic)).toHaveLength(40);
    expect(commandCards.filter((card) => card.tactic)).toHaveLength(17);
  });

  it("describes every card in Spanish", () => {
    commandCards.forEach((card) => {
      expect(card.name).not.toBe("");
      expect(card.description).not.toBe("");
    });
  });

  it("names section cards after their section", () => {
    const names = new Set(commandCards.map((card) => card.name));

    expect(names).toContain("Sondeo en el flanco izquierdo");
    expect(names).toContain("Ataque en el centro");
    expect(commandCards.find((card) => card.id === "assault-right-1")!.description).toBe(
      "Da órdenes a todas las unidades del flanco derecho."
    );
  });
});
