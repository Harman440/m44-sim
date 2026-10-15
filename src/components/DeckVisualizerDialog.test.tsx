import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DeckVisualizerDialog from "./DeckVisualizerDialog";
import { commandDeckFor } from "../data/commandCards";
import { combatDeckFor } from "../data/combatCards";
import { scenarios } from "../data/scenarios";
import { same } from "../i18n/lang";

const scenario = scenarios.find((s) => s.id === "sainte-mere-eglise")!;

const renderDeck = () =>
  render(
    <DeckVisualizerDialog
      open
      onClose={() => {}}
      faction="Allies"
      commandCards={commandDeckFor(scenario, "Allies")}
      combatCards={combatDeckFor(scenario, "Allies")}
    />
  );

describe("DeckVisualizerDialog", () => {
  it("shows the command and combat cards with their copies", () => {
    renderDeck();

    expect(screen.getByRole("heading", { name: "Cartas de sección (14)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cartas tácticas (10)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Cartas de combate \(\d+\)$/ })).toBeInTheDocument();
    // Move Out: 5 of 24 in an infantry-only deck
    expect(screen.getByLabelText("5 copias, 21 % de robarla")).toBeInTheDocument();
  });

  it("shows the cards kept out of the deck apart, with no chance of drawing them", () => {
    const scenario = scenarios.find((s) => s.id === "arracourt")!;
    render(
      <DeckVisualizerDialog
        open
        onClose={() => {}}
        faction="Allies"
        commandCards={commandDeckFor(scenario, "Allies")}
        combatCards={combatDeckFor(scenario, "Allies")}
      />
    );

    const reserve = within(screen.getByRole("heading", { name: "Fuera del mazo (2)" }).closest("section")!);
    expect(reserve.getByText("Nunca se roban: solo llegan con Repostaje")).toBeInTheDocument();
    expect(reserve.getAllByLabelText("1 copia, fuera del mazo")).toHaveLength(2);
    expect(reserve.getByRole("button", { name: /Asalto de Blindados/ })).toBeInTheDocument();
  });

  it("shows a card's full text when it is tapped", () => {
    renderDeck();

    fireEvent.click(screen.getAllByRole("button", { name: /En marcha/ })[0]!);

    const details = screen.getByRole("dialog", { name: "Carta del mazo" });
    expect(within(details).getByText("Da órdenes a 4 unidades de infantería.")).toBeInTheDocument();
  });
});
