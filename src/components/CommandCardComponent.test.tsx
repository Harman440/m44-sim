import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CommandCardComponent from "./CommandCardComponent";
import CommandCard from "../game-core/commandCard";
import { UnitType } from "../game-core/unit";
import { Side } from "../types/hex";
import { commandDeckFor } from "../data/commandCards";
import { scenarios } from "../data/scenarios";
import { same } from "../i18n/lang";
import { DEFAULT_SETTINGS, SettingsContext } from "../settings";

const renderCard = (card: CommandCard) => render(<CommandCardComponent cardData={card} />).container;

describe("CommandCardComponent", () => {
  it("shows the card in English when the player picks English", () => {
    const card = new CommandCard({ name: { es: "Asalto", en: "Assault" }, sections: [Side.LEFT, Side.RIGHT], orders: "all" });
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <CommandCardComponent cardData={card} onClick={() => {}} />
      </SettingsContext.Provider>
    );

    expect(screen.getByRole("button", { name: "Assault" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sections: Left, Right" })).toBeInTheDocument();
    expect(screen.getAllByText("All")).toHaveLength(2);
  });

  it("draws a section card with the painting, an arrow and its order count in a badge", () => {
    const container = renderCard(new CommandCard({ name: same("Ataque"), sections: [Side.LEFT], orders: 3 }));

    expect(screen.getByRole("img", { name: "Secciones: Izquierda" })).toBeInTheDocument();
    expect(container.querySelector(".command-card--section")).not.toBeNull();
    expect(container.querySelector(".section-art__painting")).not.toBeNull();
    expect(container.querySelector(".section-art__arrow")).not.toBeNull();
    expect(container.querySelector(".section-art__badge")).toHaveTextContent("3");
    expect(container.querySelector(".command-card__orders")).toBeNull();
  });

  it("writes Todas in the badge of a card that orders all units of a section", () => {
    const container = renderCard(new CommandCard({ name: same("Asalto"), sections: [Side.RIGHT], orders: "all" }));

    expect(container.querySelector(".section-art__badge")).toHaveTextContent("Todas");
  });

  it("draws an arrow with its quota into each section of a multi-section card", () => {
    const container = renderCard(new CommandCard({ name: same("Movimiento en Pinza"), sections: [Side.LEFT, Side.RIGHT], orders: 4, perSection: 2 }));

    expect(container.querySelector(".command-card--section")).not.toBeNull();
    expect(container.querySelectorAll(".section-art__arrow")).toHaveLength(2);
    const badges = [...container.querySelectorAll(".section-art__badge")].map((badge) => badge.textContent);
    expect(badges).toEqual(["2", "2"]);
  });

  it("shows Batida's draw choice and unit on the move as chips beside the painting", () => {
    const container = renderCard(new CommandCard({ name: same("Batida"), sections: [Side.CENTER], orders: 2, onTheMove: 1, drawChoice: 2 }));

    expect(container.querySelectorAll(".section-art__chip")).toHaveLength(2);
  });

  it("draws a tactic card with the painting and its summary, without the full text", () => {
    const container = renderCard(
      new CommandCard({ name: same("En marcha"), description: same("Texto largo"), summary: same("4 órdenes a infantería."), tactic: true, unitTypes: [UnitType.INFANTRY], orders: 4 })
    );

    expect(container.querySelector(".command-card--tactic")).not.toBeNull();
    expect(container.querySelector(".tactic-art__painting")).not.toBeNull();
    expect(screen.getByText("4 órdenes a infantería.")).toBeInTheDocument();
    expect(screen.queryByText("Texto largo")).not.toBeInTheDocument();
  });

  it("paints the tactic cards that have a painting with their own art, the rest with the generals", () => {
    const painting = (id: string) =>
      renderCard(new CommandCard({ id, tactic: true, orders: 4 })).querySelector(".tactic-art__painting")!.getAttribute("src");

    expect(painting("armor-assault-1")).toContain("armour-assault");
    expect(painting("direct-from-hq-2")).toContain("hq");
    expect(painting("infantry-assault-1")).toContain("infantry-assault");
    expect(painting("firefight-1")).toContain("firefight");
    expect(painting("finest-hour-1")).toContain("finest-hour");
    expect(painting("preparations-1")).toContain("preparations");
    expect(painting("a-new-tactic-1")).toContain("british-generals");
  });

  it("falls back to the description on a tactic card with no summary", () => {
    renderCard(new CommandCard({ name: same("Asalto cercano"), description: same("Sin órdenes."), tactic: true, closeAssaultOnly: true }));

    expect(screen.getByText("Sin órdenes.")).toBeInTheDocument();
  });

  it("gives every tactic card in the deck a short summary", () => {
    const cards = scenarios.flatMap((scenario) => [...commandDeckFor(scenario, "Allies"), ...commandDeckFor(scenario, "Axis")]).filter((card) => card.tactic);

    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card.summary).not.toBe(card.description);
      expect(card.summary.es.length).toBeLessThanOrEqual(70);
    });
  });
});
