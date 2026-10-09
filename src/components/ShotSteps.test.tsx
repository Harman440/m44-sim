import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ShotSteps from "./ShotSteps";
import { ShotRoll } from "../game-core/gameSession";
import { UnitType } from "../game-core/unit";

const shot: ShotRoll = {
  steps: [
    { label: { es: "Base: Tanque a 2 casillas", en: "Base: Tank at 2 hexes" }, dice: 3, kind: "base" },
    { label: { es: "Desde un pueblo", en: "From a town" }, dice: -2, kind: "fromTown" },
  ],
  dice: 1,
  faces: [],
  notes: [],
  collision: false,
  target: { infantry: true, closeAssault: false, die: "battle" },
  combatBonus: false,
  kept: null,
};

describe("ShotSteps", () => {
  it("draws a tank firing from a town as a village with its dice", () => {
    const { container } = render(<ShotSteps shot={shot} unitType={UnitType.TANK} faction="Allies" />);

    expect(screen.getByTestId("shot-steps")).toHaveAccessibleName(expect.stringContaining("Desde un pueblo −2"));
    expect(container.querySelector('[data-icon="town"]')).not.toBeNull();
  });
});
