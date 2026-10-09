import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RuleBookDialog from "./RuleBookDialog";
import { TUTORIAL } from "../data/ruleBook";
import { DEFAULT_SETTINGS, SettingsContext } from "../settings";

describe("RuleBookDialog", () => {
  it("walks through the tutorial a page at a time, then on to the house rules", () => {
    render(<RuleBookDialog open onClose={() => {}} />);

    expect(screen.getByRole("tab", { name: "Cómo se juega" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Antes de empezar" })).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atrás" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "1. Carta" })).toBeInTheDocument();
    // The phase the page is about is picked out
    const phases = screen.getByRole("list", { name: "Fases del turno" });
    expect(within(phases).getByText("Carta").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(phases).getByText("Batalla").closest("li")).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByRole("heading", { name: "Un turno a la vez" })).toBeInTheDocument();

    for (let page = 2; page < TUTORIAL.length; page++) fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Consejos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reglas de la casa" }));
    expect(screen.getByRole("tab", { name: "Reglas de la casa" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows each house rule beside the official one", () => {
    render(<RuleBookDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Reglas de la casa" }));

    const dice = screen.getByRole("region", { name: "Dados" });
    const tank = within(dice).getByRole("article", { name: "El tanque impacta a la artillería" });
    expect(within(tank).getByText("Reglamento oficial")).toBeInTheDocument();
    expect(within(tank).getByText(/a la artillería solo la impactan las granadas/)).toBeInTheDocument();
    expect(within(tank).getByText("En esta partida")).toBeInTheDocument();
    // A rule the official game doesn't have says so
    const collisions = screen.getByRole("article", { name: "Choques" });
    expect(within(collisions).getByText("Regla nueva")).toBeInTheDocument();
    expect(within(collisions).queryByText("Reglamento oficial")).not.toBeInTheDocument();
    // No tutorial buttons here
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
  });

  it("closes", () => {
    const onClose = vi.fn();
    render(<RuleBookDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("is in English too", () => {
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <RuleBookDialog open onClose={() => {}} />
      </SettingsContext.Provider>
    );

    expect(screen.getByRole("dialog", { name: "Rule book" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Before you start" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 8")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "House rules" }));
    expect(screen.getByRole("article", { name: "Their Finest Hour" })).toHaveTextContent(/Up to 4 orders paid with supplies/);
  });
});
