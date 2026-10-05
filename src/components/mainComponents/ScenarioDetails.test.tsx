import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ScenarioDetails from "./ScenarioDetails";
import { scenarios } from "../../data/scenarios";

const scenario = (id: string) => scenarios.find((s) => s.id === id)!;
/** The row's cells for Aliados and Eje */
const cells = (label: string) => within(screen.getByRole("row", { name: new RegExp(label) })).getAllByRole("cell");

describe("ScenarioDetails", () => {
  it("shows each side's role, starting cards, big guns and air, not its units", () => {
    render(<ScenarioDetails scenario={scenario("arracourt")} faction={null} onPickFaction={() => {}} />);

    const [alliesRole, axisRole] = cells("Papel");
    expect(alliesRole).toHaveTextContent("Defiende");
    expect(axisRole).toHaveTextContent("Ataca");
    expect(cells("Cartas de mando")[0]!).toHaveTextContent(/^\d+$/);
    expect(within(cells("Artillería pesada")[0]!).getByLabelText("Sí")).toBeInTheDocument();
    expect(cells("Aviación")[1]!).toHaveTextContent("No");
    expect(screen.queryByText(/Infantería/)).not.toBeInTheDocument();
    expect(screen.queryByText(/al empezar/)).not.toBeInTheDocument();
  });

  it("counts the air cards each side gets", () => {
    render(<ScenarioDetails scenario={scenario("arracourt")} faction={null} onPickFaction={() => {}} />);
    const allies = within(cells("Aviación")[0]!);
    expect(allies.getByLabelText(/Poder aéreo/)).toBeInTheDocument();
    expect(allies.getByLabelText(/Bombardeo aéreo/)).toBeInTheDocument();
  });

  it("gives Pegasus Bridge no guns or aircraft", () => {
    render(<ScenarioDetails scenario={scenario("pegasus-bridge")} faction={null} onPickFaction={() => {}} />);
    for (const label of ["Artillería pesada", "Aviación"]) {
      cells(label).forEach((cell) => expect(cell).toHaveTextContent("No"));
    }
  });

  it("picks the side from the column headers", () => {
    const onPick = vi.fn();
    render(<ScenarioDetails scenario={scenario("arracourt")} faction="Allies" onPickFaction={onPick} />);
    expect(screen.getByRole("button", { name: "Aliados" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    expect(onPick).toHaveBeenCalledWith("Axis");
  });
});
