import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CommandCardComponent from "./CommandCardComponent";
import CommandCard from "../game-core/commandCard";
import { UnitType } from "../game-core/unit";
import { Side } from "../types/hex";

const renderCard = (card: CommandCard) => render(<CommandCardComponent cardData={card} />).container;

describe("CommandCardComponent", () => {
  it("draws a section card with its sections and order count", () => {
    const container = renderCard(new CommandCard({ name: "Ataque", sections: [Side.LEFT], orders: 3 }));

    expect(screen.getByRole("img", { name: "Secciones: Izquierda" })).toBeInTheDocument();
    expect(container.querySelector(".command-card__count")).toHaveTextContent("3");
    expect(container.querySelector(".command-card--section")).not.toBeNull();
  });

  it("draws the card's rules as pictures, with no text on the card", () => {
    const container = renderCard(
      new CommandCard({ name: "Asalto", description: "Texto", tactic: true, sections: "chosen", unitTypes: [UnitType.INFANTRY], orders: "all", moveBonus: 1 })
    );

    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Secciones: una a elegir" })).toBeInTheDocument();
    expect(container.querySelectorAll(".card-art__rule")).toHaveLength(1);
    expect(screen.queryByText("Texto")).not.toBeInTheDocument();
  });

  it("counts no orders for Close Assault, and shows the costs of a card paid in coins", () => {
    const paid = renderCard(new CommandCard({ tactic: true, orders: 4, coinCost: { [UnitType.TANK]: 2 } }));
    const none = renderCard(new CommandCard({ tactic: true, closeAssaultOnly: true }));

    expect(paid.querySelector(".command-card__orders")).toHaveTextContent("4órdenes");
    expect(paid.querySelector(".card-art__crate")).not.toBeNull();
    expect(paid.querySelector(".command-card--tactic")).not.toBeNull();
    expect(none.querySelector(".command-card__orders")).toHaveTextContent("0órdenes");
  });
});
