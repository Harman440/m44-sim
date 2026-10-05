import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CombatCardArt } from "./CardArt";
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
