import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UnitComponent from "./UnitComponent";
import Unit, { UnitType } from "../game-core/unit";
import { Faction } from "../types/faction";
import { DEFAULT_SETTINGS, SettingsContext } from "../settings";
import alliedInfantry from "../assets/units/allies/infantry.webp";
import alliedInfantryBack from "../assets/units/allies/infantry-back.webp";
import alliedTank from "../assets/units/allies/tank.svg";
import alliedArtillery from "../assets/units/allies/artillery.svg";
import axisInfantry from "../assets/units/axis/infantry.webp";
import axisInfantryBack from "../assets/units/axis/infantry-back.webp";
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

  it("draws its own side's infantry from behind, and the front for a unit type with no back view", () => {
    const sprite = (faction: Faction, unitType: UnitType) =>
      render(
        <svg>
          <UnitComponent x={0} y={0} faction={faction} unitData={new Unit(unitType)} fromBehind />
        </svg>
      ).container.querySelector("image")!.getAttribute("href");

    expect(sprite("Allies", UnitType.INFANTRY)).toBe(alliedInfantryBack);
    expect(sprite("Allies", UnitType.TANK)).toBe(alliedTank);
    expect(sprite("Axis", UnitType.INFANTRY)).toBe(axisInfantryBack);
    expect(sprite("Axis", UnitType.TANK)).toBe(axisTank);
  });

  it.each([
    [UnitType.INFANTRY, 6],
    [UnitType.TANK, 3],
    [UnitType.ARTILLERY, 3],
  ] as const)("draws a %s as %i figures, and only the figures it has left", (unitType, all) => {
    const drawn = (figures?: number) =>
      render(
        <svg>
          <UnitComponent x={0} y={0} faction="Axis" unitData={new Unit(unitType)} figures={figures} />
        </svg>
      ).container.querySelectorAll("image").length;

    expect(drawn()).toBe(all);
    expect(drawn(1)).toBe(1);
  });

  it("shows no figure count, only a red dot for a figure hit once", () => {
    const tank = (damaged: boolean) =>
      render(
        <svg>
          <UnitComponent x={0} y={0} faction="Axis" unitData={new Unit(UnitType.TANK)} figures={2} damaged={damaged} />
        </svg>
      ).container;

    expect(tank(false).querySelector("text")).toBeNull();
    expect(tank(false).querySelector('[data-testid="damaged-badge"]')).toBeNull();
    expect(tank(true).querySelector('[data-testid="damaged-badge"]')).not.toBeNull();
  });

  it.each([
    [false, false, "Stood still, still to fire"],
    [false, true, "Moved, still to fire"],
    [true, false, "Fired without moving"],
    [true, true, "Moved and fired"],
  ])("tells the four fire states apart (fired %s, moved %s)", (fired, moved, title) => {
    const container = render(
      <SettingsContext.Provider value={{ settings: { ...DEFAULT_SETTINGS, language: "en" }, updateSettings: () => {} }}>
        <svg>
          <UnitComponent x={0} y={0} faction="Allies" unitData={new Unit(UnitType.TANK)} readyToFire fired={fired} moved={moved} />
        </svg>
      </SettingsContext.Provider>
    ).container;

    expect(container.querySelector('[data-testid="fire-badge"] title')!.textContent).toBe(title);
    expect(container.querySelector('[data-testid="moved-tag"]') !== null).toBe(moved);
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
