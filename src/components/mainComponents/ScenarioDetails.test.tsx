import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ScenarioDetails from "./ScenarioDetails";
import { scenarios } from "../../data/scenarios";
import { cardsOf } from "../../game-core/actionCard";
import { same } from "../../i18n/lang";
import { DEFAULT_SETTINGS, SettingsContext } from "../../settings";

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

  it("counts the command cards each side holds, showing its heavy guns and air", () => {
    const arracourt = scenario("arracourt");
    render(<ScenarioDetails scenario={arracourt} faction={null} onPickFaction={() => {}} />);

    const [allies, axis] = cells("Cartas de mando");
    expect(allies).toHaveTextContent(String(cardsOf(arracourt, "Allies").length));
    expect(axis).toHaveTextContent(String(cardsOf(arracourt, "Axis").length));
    const label = (faction: "Allies" | "Axis") => {
      const held = cardsOf(arracourt, faction);
      const extras = [
        held.some(({ card }) => card.needs === "bigGuns") && "artillería pesada",
        held.some(({ card }) => card.needs === "air") && "aviación",
      ].filter(Boolean);
      return `${held.length} cartas${extras.length ? `, con ${extras.join(" y ")}` : ""}`;
    };
    expect(within(allies!).getByLabelText(label("Allies"))).toBeInTheDocument();
    expect(within(axis!).getByLabelText(label("Axis"))).toBeInTheDocument();
  });

  it("picks the side from the column headers", () => {
    const onPick = vi.fn();
    render(<ScenarioDetails scenario={scenario("arracourt")} faction="Allies" onPickFaction={onPick} />);
    expect(screen.getByRole("button", { name: "Aliados" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Eje" }));
    expect(onPick).toHaveBeenCalledWith("Axis");
  });

  it("only names the sides when there's no side to pick (the map editor)", () => {
    render(<ScenarioDetails scenario={scenario("arracourt")} faction={null} />);

    expect(screen.getByRole("columnheader", { name: "Aliados" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aliados" })).not.toBeInTheDocument();
    expect(cells("Papel")[1]!).toHaveTextContent("Ataca");
  });

  it("speaks English when the player picks it", () => {
    render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <ScenarioDetails scenario={scenario("arracourt")} faction={null} onPickFaction={() => {}} />
      </SettingsContext.Provider>
    );
    const [alliesRole, axisRole] = cells("Role");
    expect(alliesRole).toHaveTextContent("Defends");
    expect(axisRole).toHaveTextContent("Attacks");
    expect(cells("Command cards")[0]!).toHaveTextContent(String(cardsOf(scenario("arracourt"), "Allies").length));
  });
});
