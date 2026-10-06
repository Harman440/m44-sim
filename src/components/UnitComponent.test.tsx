import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UnitComponent from "./UnitComponent";
import Unit, { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import alliedInfantry from "../assets/units/allies/infantry.webp";
import alliedTank from "../assets/units/allies/tank.svg";
import alliedArtillery from "../assets/units/allies/artillery.svg";
import axisInfantry from "../assets/units/axis/infantry.webp";
import axisTank from "../assets/units/axis/tank.svg";
import axisArtillery from "../assets/units/axis/artillery.svg";

const renderUnit = (faction: Faction, unitType?: UnitType, readyToFire?: boolean) =>
  render(
    <svg>
      <UnitComponent
        x={0}
        y={0}
        faction={faction}
        unitData={unitType && new Unit(unitType)}
        readyToFire={readyToFire}
      />
    </svg>
  ).container;

const spriteFor = (faction: Faction, unitType?: UnitType) =>
  renderUnit(faction, unitType).querySelector("image")!;

describe("UnitComponent", () => {
  it.each([
    ["Allies", UnitType.INFANTRY, alliedInfantry],
    ["Allies", UnitType.TANK, alliedTank],
    ["Allies", UnitType.ARTILLERY, alliedArtillery],
    ["Axis", UnitType.INFANTRY, axisInfantry],
    ["Axis", UnitType.TANK, axisTank],
    ["Axis", UnitType.ARTILLERY, axisArtillery],
  ] as const)("draws the %s %s sprite", (faction, unitType, asset) => {
    const image = spriteFor(faction, unitType);

    expect(image.getAttribute("href")).toBe(asset);
    expect(image.getAttribute("data-unit-type")).toBe(unitType);
  });

  it("falls back to infantry without unit data", () => {
    expect(spriteFor("Allies").getAttribute("href")).toBe(alliedInfantry);
  });

  it("marks an elite unit with a star badge", () => {
    const badge = (unit: Unit) =>
      render(
        <svg>
          <UnitComponent x={0} y={0} faction="Allies" unitData={unit} />
        </svg>
      ).container.querySelector('[data-testid="elite-badge"]');

    expect(badge(new Unit(UnitType.INFANTRY, true))).not.toBeNull();
    expect(badge(new Unit(UnitType.INFANTRY))).toBeNull();
  });

  it("shows a crosshair badge only when its order lets it fire", () => {
    expect(renderUnit("Allies", UnitType.TANK, true).querySelector(".unit__badge--fire")).not.toBeNull();
    expect(renderUnit("Allies", UnitType.TANK).querySelector(".unit__badge--fire")).toBeNull();
  });

  it("swaps the crosshair for a check once the unit has fired", () => {
    const container = render(
      <svg>
        <UnitComponent x={0} y={0} faction="Axis" unitData={new Unit(UnitType.TANK)} readyToFire fired />
      </svg>
    ).container;

    expect(container.querySelector(".unit__badge--fired")).not.toBeNull();
    expect(container.querySelector(".unit__badge--fire")).toBeNull();
  });

  it("rings a unit that can be ordered", () => {
    const container = render(
      <svg>
        <UnitComponent x={0} y={0} faction="Allies" unitData={new Unit(UnitType.INFANTRY)} orderable />
      </svg>
    ).container;

    expect(container.querySelector(".unit__ring--orderable")).not.toBeNull();
  });
});
