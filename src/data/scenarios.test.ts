import { describe, expect, it, vi } from "vitest";
import { scenarios } from "./scenarios";
import BoardManager from "../game-core/BoardManager";
import { Position, UnitGroup } from "../types/scenario";

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
    vi.spyOn(console, "log").mockImplementation(() => {});
    const expected = flatten(scenario.units[factionKey] as UnitGroup).length;

    const board = new BoardManager(scenario, faction);

    expect(board.getAllHexes().filter((h) => h.hasUnit())).toHaveLength(expected);
  });
});
