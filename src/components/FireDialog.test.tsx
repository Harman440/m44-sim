import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FireDialog from "./FireDialog";
import { OrderSummary } from "../game-core/turnSummary";
import { UnitType } from "../game-core/unit";
import { HexType, Side } from "../types/hex";

const summary = (unitType: UnitType): OrderSummary => ({
  index: 0,
  unitType,
  section: Side.CENTER,
  hold: true,
  hexesMoved: 0,
  destinationTerrain: HexType.PLAINS,
  canFire: true,
  removed: false,
});

// Opens and closes the dialog like BattleView does (keyed, so it starts fresh)
function Harness({ unitType }: { unitType: UnitType }) {
  const [unit, setUnit] = useState<OrderSummary | null>(null);
  return (
    <>
      <button onClick={() => setUnit(summary(unitType))}>abrir</button>
      <FireDialog
        key={unit ? "open" : "closed"}
        unit={unit}
        card={null}
        faction="Allies"
        onClose={() => setUnit(null)}
      />
    </>
  );
}

const open = (unitType: UnitType) => {
  render(<Harness unitType={unitType} />);
  fireEvent.click(screen.getByText("abrir"));
};
const choose = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FireDialog", () => {
  it("asks distance then target terrain, explains the dice and rolls them", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // grenade
    open(UnitType.INFANTRY);

    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
    choose("2");
    expect(screen.getByText("¿En qué terreno está el objetivo?")).toBeInTheDocument();
    choose("Bosque");

    const breakdown = screen.getByTestId("fire-breakdown");
    expect(breakdown).toHaveTextContent("Base: Infantería a 2 casillas+2");
    expect(breakdown).toHaveTextContent("Objetivo en bosque-1");
    expect(screen.getByTestId("fire-total")).toHaveTextContent("Total: 1 dado");

    choose("Tirar 1 dado");
    const result = screen.getByTestId("dice-result");
    expect(within(result).getAllByRole("img", { name: "Granada" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Tirar otra vez" })).toBeInTheDocument();
  });

  it("offers artillery its full range of 6 hexes", () => {
    open(UnitType.ARTILLERY);

    for (const label of ["1 (adyacente)", "2", "3", "4", "5", "6"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("goes back one question at a time", () => {
    open(UnitType.TANK);
    choose("1 (adyacente)");
    choose("Pueblo");

    choose("Atrás");
    expect(screen.getByText("¿En qué terreno está el objetivo?")).toBeInTheDocument();
    choose("Atrás");
    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).not.toBeInTheDocument();
  });

  it("says when a shot has no dice and offers no roll", () => {
    open(UnitType.INFANTRY);
    choose("3");
    choose("Pueblo");

    expect(screen.getByTestId("fire-total")).toHaveTextContent("no tiene efecto");
    expect(screen.queryByRole("button", { name: /^Tirar/ })).not.toBeInTheDocument();
  });

  it("starts from the first question every time it is opened", () => {
    open(UnitType.INFANTRY);
    choose("2");
    choose("Cerrar");

    fireEvent.click(screen.getByText("abrir"));

    expect(screen.getByText("¿A cuántas casillas está el objetivo?")).toBeInTheDocument();
  });
});
