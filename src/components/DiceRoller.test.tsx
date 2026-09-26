import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DiceRoller from "./DiceRoller";

afterEach(() => {
  vi.restoreAllMocks();
});

const roll = () => fireEvent.click(screen.getByRole("button", { name: /^Tirar/ }));

describe("DiceRoller", () => {
  it("rolls 3 dice by default and shows each face with a count", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // every die lands on infantry
    render(<DiceRoller faction="Allies" />);

    roll();

    const result = screen.getByTestId("dice-result");
    expect(within(result).getAllByRole("img", { name: "Infantería" })).toHaveLength(3);
    expect(screen.getByText("3 × Infantería")).toBeInTheDocument();
  });

  it("rolls the number of dice chosen", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // flags
    render(<DiceRoller faction="Axis" />);

    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByRole("button", { name: "Tirar 5 dados" })).toBeInTheDocument();
    roll();

    expect(within(screen.getByTestId("dice-result")).getAllByRole("img")).toHaveLength(5);
    expect(screen.getByText("5 × Bandera")).toBeInTheDocument();
  });

  it("uses the singular for one die", () => {
    render(<DiceRoller faction="Allies" />);

    fireEvent.click(screen.getByRole("button", { name: "1" }));

    expect(screen.getByRole("button", { name: "Tirar 1 dado" })).toBeInTheDocument();
  });

  it("shows nothing until the first roll", () => {
    render(<DiceRoller faction="Allies" />);

    expect(screen.queryByTestId("dice-result")).not.toBeInTheDocument();
  });
});
