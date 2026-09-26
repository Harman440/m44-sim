import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UnitComponent from "./UnitComponent";
import Unit, { UnitType } from "../game-core/unit";
import alliedInfantry from "../assets/units/allies/infantry.png";
import alliedTank from "../assets/units/allies/tank.svg";
import alliedArtillery from "../assets/units/allies/artillery.svg";
import axisInfantry from "../assets/units/axis/infantry.png";
import axisTank from "../assets/units/axis/tank.svg";
import axisArtillery from "../assets/units/axis/artillery.svg";

const spriteFor = (faction: string, unitType?: UnitType) => {
  const { container } = render(
    <svg>
      <UnitComponent x={0} y={0} faction={faction} unitData={unitType && new Unit(unitType)} />
    </svg>
  );
  return container.querySelector("image")!;
};

describe("UnitComponent", () => {
  it.each([
    ["Allies", UnitType.INFANTRY, alliedInfantry],
    ["Allies", UnitType.TANK, alliedTank],
    ["Allies", UnitType.ARTILLERY, alliedArtillery],
    ["Axis", UnitType.INFANTRY, axisInfantry],
    ["Axis", UnitType.TANK, axisTank],
    ["Axis", UnitType.ARTILLERY, axisArtillery],
  ])("draws the %s %s sprite", (faction, unitType, asset) => {
    const image = spriteFor(faction, unitType);

    expect(image.getAttribute("href")).toBe(asset);
    expect(image.getAttribute("data-unit-type")).toBe(unitType);
  });

  it("falls back to infantry without unit data", () => {
    expect(spriteFor("Allies").getAttribute("href")).toBe(alliedInfantry);
  });
});
