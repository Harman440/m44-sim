import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombatCardArt, CommandCardArt } from "./CardArt";
import CommandCard from "../game-core/commandCard";
import { CombatCard } from "../game-core/combatCard";
import { UnitType } from "../game-core/unit";
import { Side } from "../types/hex";

const combat = (extra: Partial<CombatCard>): CombatCard => ({
  id: "card-1",
  name: "Carta",
  description: "",
  cost: 1,
  phase: "order",
  ...extra,
});

describe("CommandCardArt", () => {
  it("tints the sections the card orders", () => {
    const { container } = render(<CommandCardArt card={new CommandCard({ sections: [Side.LEFT], orders: 2 })} faction="Allies" />);

    const hexes = container.querySelectorAll(".card-art__hex");
    const tinted = container.querySelectorAll(".card-art__hex--on");
    expect(tinted.length).toBeGreaterThan(0);
    expect(tinted.length).toBeLessThan(hexes.length / 2);
  });

  it("puts a token on the board for each unit the card orders", () => {
    const card = new CommandCard({ tactic: true, unitTypes: [UnitType.TANK], orders: 4 });
    const { container } = render(<CommandCardArt card={card} faction="Axis" />);

    expect(container.querySelectorAll(".card-art__token")).toHaveLength(4);
  });

  it("draws a row of pictograms for each special rule, with the unit that only moves", () => {
    const card = new CommandCard({ sections: [Side.CENTER], orders: 1, onTheMove: 1, drawChoice: 3 });
    const { container } = render(<CommandCardArt card={card} faction="Allies" />);

    expect(container.querySelectorAll(".card-art__rule")).toHaveLength(2);
    expect(container.querySelectorAll(".card-art__rule-text")[1]).toHaveTextContent("3→1");
    // 1 ordered unit, the one on the move on the board and in its pictogram
    expect(container.querySelectorAll(".card-art__token--ghost")).toHaveLength(2);
  });
});

describe("CombatCardArt", () => {
  it("puts a reticle on each hex an attack card marks", () => {
    const card = combat({ marker: { kind: "target", count: 4, chain: true }, effect: { kind: "attack", dicePerHex: 1 } });
    const { container } = render(<CombatCardArt card={card} faction="Allies" />);

    expect(container.querySelectorAll(".card-art__reticle")).toHaveLength(4 + 1); // and one in the pictogram
    expect(container.querySelector(".card-art__rule")).toHaveTextContent("4×1");
  });

  it("draws the extra die of a dice card", () => {
    const card = combat({ phase: "battle", effect: { kind: "diceBonus", dice: 1, unitTypes: [UnitType.ARTILLERY] } });
    const { container } = render(<CombatCardArt card={card} faction="Allies" />);

    expect(container.querySelector(".card-art__bonus")).toHaveTextContent("+1");
  });

  it("strikes out the enemy unit of Out of Fuel, and stamps the phase on cards without art of their own", () => {
    const fuel = render(<CombatCardArt card={combat({ id: "out-of-fuel-2", phase: "battle" })} faction="Allies" />);
    const plain = render(<CombatCardArt card={combat({ id: "personal-armor-1", phase: "battle" })} faction="Allies" />);

    expect(fuel.container.querySelector(".card-art__denied")).not.toBeNull();
    expect(plain.container.querySelector(".card-art__seal")).not.toBeNull();
  });
});
