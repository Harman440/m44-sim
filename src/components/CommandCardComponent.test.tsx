import { render, screen } from "@testing-library/react";
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

  it("tags the card's special rules", () => {
    renderCard(new CommandCard({ name: "Sondeo", sections: [Side.LEFT], orders: 2, onTheMove: 1 }));
    renderCard(new CommandCard({ name: "Avance", orders: 6, perSection: 2 }));
    renderCard(
      new CommandCard({ name: "Asalto", tactic: true, sections: "chosen", unitTypes: [UnitType.INFANTRY], orders: "all" })
    );

    expect(screen.getByText("+1 en movimiento")).toBeInTheDocument();
    expect(screen.getByText("2 por sección")).toBeInTheDocument();
    expect(screen.getByText("Sección a elegir")).toBeInTheDocument();
    expect(screen.getByText("Solo infantería")).toBeInTheDocument();
    expect(screen.getByText("Todas")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Secciones: una a elegir" })).toBeInTheDocument();
  });

  it("counts points for a card with costs, and none for Close Assault", () => {
    const points = renderCard(new CommandCard({ tactic: true, orders: 4, orderCost: { [UnitType.TANK]: 2 } }));
    const none = renderCard(new CommandCard({ tactic: true, closeAssaultOnly: true }));

    expect(points.querySelector(".command-card__orders")).toHaveTextContent("4puntos");
    expect(points.querySelector(".command-card--tactic")).not.toBeNull();
    expect(none.querySelector(".command-card__orders")).toHaveTextContent("0órdenes");
  });
});
