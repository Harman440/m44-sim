import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ScenarioDetails from "./ScenarioDetails";
import { scenarios } from "../../data/scenarios";
import { combatDeckFor } from "../../data/combatCards";

const scenario = (id: string) => scenarios.find((s) => s.id === id)!;
/** The row's cells for Aliados and Eje */
const cells = (label: string) => within(screen.getByRole("row", { name: new RegExp(label) })).getAllByRole("cell");

describe("ScenarioDetails", () => {
  it("shows each side's role and starting cards, not its units", () => {
    render(<ScenarioDetails scenario={scenario("arracourt")} faction={null} onPickFaction={() => {}} />);

    const [alliesRole, axisRole] = cells("Papel");
    expect(alliesRole).toHaveTextContent("Defiende");
    expect(axisRole).toHaveTextContent("Ataca");
    expect(cells("Cartas de mando")[0]!).toHaveTextContent(/^\d+$/);
    expect(screen.queryByText(/Infantería/)).not.toBeInTheDocument();
    expect(screen.queryByText(/al empezar/)).not.toBeInTheDocument();
  });

  it("opens a side's combat deck, grouped by why the side gets each card", async () => {
    const arracourt = scenario("arracourt");
    render(<ScenarioDetails scenario={arracourt} faction={null} onPickFaction={() => {}} />);
    const size = combatDeckFor(arracourt, "Allies").length;

    expect(screen.getByRole("button", { name: /de Eje$/ })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: `Ver las ${size} cartas de combate de Aliados, con artillería pesada y aviación` })
    );

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(`Cartas de combate · Aliados (${size})`)).toBeInTheDocument();
    expect(dialog.getByRole("region", { name: "Defiende" })).toBeInTheDocument();
    expect(dialog.queryByRole("region", { name: "Ataca" })).not.toBeInTheDocument();
    expect(within(dialog.getByRole("region", { name: "Artillería pesada" })).getByText("Cortina de Fuego")).toBeInTheDocument();
  });

  it("picks the side from the column headers", () => {
    const onPick = vi.fn();
    render(<ScenarioDetails scenario={scenario("arracourt")} faction="Allies" onPickFaction={onPick} />);
    expect(screen.getByRole("button", { name: "Aliados" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    expect(onPick).toHaveBeenCalledWith("Axis");
  });
});
