import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DicePool from "./DicePool";

describe("DicePool", () => {
  it("draws one kind of die for a plain shot", () => {
    render(<DicePool dice={3} eightSided faction="Allies" />);
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados de 8 caras");
    expect(document.querySelectorAll(".die--d8")).toHaveLength(3);
  });

  it("draws each Concentrated Fire unit's dice on its own die: the battle die in close assault, the 8-sided one from range", () => {
    render(<DicePool dice={3} eightSided={false} joined={[{ dice: 2, eightSided: true }]} faction="Allies" />);
    expect(screen.getByTestId("fire-total")).toHaveAccessibleName("3 dados y 2 dados de 8 caras");
    expect(document.querySelectorAll(".dice-pool__die .die")).toHaveLength(5);
    expect(document.querySelectorAll(".dice-pool__die .die--d8")).toHaveLength(2);
  });
});
