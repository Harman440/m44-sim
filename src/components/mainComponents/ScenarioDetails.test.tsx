import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ScenarioDetails from "./ScenarioDetails";
import { scenarios } from "../../data/scenarios";

const scenario = (id: string) => scenarios.find((s) => s.id === id)!;

describe("ScenarioDetails", () => {
  it("shows each side's role, units, big guns, air and combat deck", () => {
    render(<ScenarioDetails scenario={scenario("arracourt")} />);
    const allies = within(screen.getByRole("region", { name: "Aliados" }));
    const axis = within(screen.getByRole("region", { name: "Eje" }));

    expect(allies.getByText("Defiende")).toBeInTheDocument();
    expect(axis.getByText("Ataca")).toBeInTheDocument();
    expect(axis.getByText("4 Infantería, 6 Tanque, 1 Artillería")).toBeInTheDocument();
    expect(allies.getByText("Sí: Cortina de Fuego")).toBeInTheDocument();
    expect(axis.getByText("Sin aviación")).toBeInTheDocument();
    expect(axis.getByText("Sin tregua ×2")).toBeInTheDocument();
    expect(allies.queryByText(/Sin tregua/)).not.toBeInTheDocument();
  });

  it("counts the paratroopers and gives Pegasus Bridge no guns or aircraft", () => {
    const { unmount } = render(<ScenarioDetails scenario={scenario("sainte-mere-eglise")} />);
    expect(within(screen.getByRole("region", { name: "Aliados" })).getByText(/10 Infantería/)).toBeInTheDocument();
    unmount();

    render(<ScenarioDetails scenario={scenario("pegasus-bridge")} />);
    expect(screen.getAllByText("No")).toHaveLength(2);
    expect(screen.getAllByText("Sin aviación")).toHaveLength(2);
  });
});
