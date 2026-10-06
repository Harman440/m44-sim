import { describe, expect, it } from "vitest";
import { scenarios } from "./scenarios";
import BoardManager from "../game-core/BoardManager";
import { Position, UnitGroup } from "../types/scenario";
import { SIX_SIDED_FACES } from "../game-core/dice";
import { isUnitType } from "../game-core/unit";
import { positionKey } from "../game-core/position";

const isOnBoard = ({ row, col }: Position) =>
  row >= 0 && row < 9 && col >= 0 && col < 13 - (row % 2);

const flatten = (groups: Partial<Record<string, Position[]>>) =>
  Object.values(groups).flatMap((positions) => positions ?? []);

// BoardManager silently drops off-board positions and units placed on an
// occupied hex, so typos in scenario data would otherwise go unnoticed
describe.each(scenarios.map((s) => [s.id, s] as const))("scenario %s", (_id, scenario) => {
  it("has board art and a starting hand for each side", () => {
    expect(scenario.image).toBeTruthy();
    expect(scenario.initialHandSize.allies).toBeGreaterThan(0);
    expect(scenario.initialHandSize.axis).toBeGreaterThan(0);
  });

  it("says which unit each die face brings with the Reinforcements card", () => {
    expect(Object.keys(scenario.reinforcements ?? {}).sort()).toEqual([...SIX_SIDED_FACES].sort());
    expect(Object.values(scenario.reinforcements ?? {}).every((unit) => unit === null || isUnitType(unit))).toBe(true);
  });

  it("gives each hex at most one terrain", () => {
    const keys = flatten(scenario.tiles).map(positionKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only uses positions that are on the board", () => {
    const positions = [
      ...flatten(scenario.tiles),
      ...flatten(scenario.units.allies),
      ...flatten(scenario.units.axis),
    ];

    expect(positions.filter((p) => !isOnBoard(p))).toEqual([]);
  });

  it.each([
    ["Allies", "allies"],
    ["Axis", "axis"],
  ] as const)("places every %s unit on its own hex", (faction, factionKey) => {
    const expected = flatten(scenario.units[factionKey] as UnitGroup).length;

    const board = new BoardManager(scenario, faction);

    expect(board.getAllHexes().filter((h) => h.hasUnit())).toHaveLength(expected);
  });

  it("puts sandbags and elite badges only where a unit starts", () => {
    const units = [...flatten(scenario.units.allies), ...flatten(scenario.units.axis)].map(positionKey);

    expect([...(scenario.sandbags ?? []), ...(scenario.elite ?? [])].map(positionKey).filter((key) => !units.includes(key))).toEqual([]);
  });
});

describe("Forêt d'Écouves", () => {
  const ecouves = scenarios.find((s) => s.id === "foret-decouves")!;
  const elite = (faction: "Allies" | "Axis") =>
    new BoardManager(ecouves, faction).getAllHexes().filter((hex) => hex.unit?.elite).map((hex) => hex.unit!.getUnitType());

  it("makes every French infantry unit elite, and the badged German units", () => {
    expect(elite("Allies")).toEqual(Array(6).fill("infantry"));
    expect(elite("Axis").sort()).toEqual(["infantry", "infantry", "tank"]);
  });

  it("starts the Allies with 6 cards and the Axis with 5, the Allies first", () => {
    expect(ecouves.initialHandSize).toEqual({ allies: 6, axis: 5 });
    expect(ecouves.attacker).toBe("Allies");
  });
});

describe("scenarios", () => {
  it("have distinct ids", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
