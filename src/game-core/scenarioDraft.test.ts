import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  clearHex,
  copyDraft,
  draftCounts,
  hasSandbags,
  hasWire,
  isElite,
  newDraft,
  newMapId,
  paintTerrain,
  placeUnit,
  recordStep,
  redoStep,
  removeUnit,
  setWire,
  startHistory,
  strokeOf,
  terrainAt,
  toggleElite,
  toggleSandbags,
  undoStep,
  unitAt,
} from "./scenarioDraft";
import { ScenarioFileError, parseScenario, toScenarioFile, validateScenario } from "./scenarioFile";
import { Scenario } from "../types/scenario";
import { HexType } from "../types/hex";
import { UnitType } from "./unit";
import { scenarios } from "../data/scenarios";

const A = { row: 4, col: 4 };
const B = { row: 4, col: 5 };
const OFF = { row: 1, col: 12 };

/** Apply edits one after another, failing the test on one that isn't allowed */
const edit = (draft: Scenario, ...steps: ((d: Scenario) => Scenario | false)[]) =>
  steps.reduce((d, step) => {
    const next = step(d);
    if (next === false) throw new Error("edit not allowed");
    return next;
  }, draft);

const empty = () => newDraft("map-test");
const withInfantry = () => edit(empty(), (d) => placeUnit(d, A, "Allies", UnitType.INFANTRY));

describe("a new map", () => {
  it("is empty, with the settings most scenarios start from", () => {
    const draft = empty();

    expect(draft).toMatchObject({ id: "map-test", tiles: {}, units: { allies: {}, axis: {} }, attacker: "Allies", initialHandSize: { allies: 5, axis: 5 } });
    expect(Object.values(draft.reinforcements!)).toEqual(["infantry", "tank", "infantry", "infantry", null]);
  });

  it("can be saved and read back before it can be played", () => {
    const file = JSON.parse(JSON.stringify(toScenarioFile(empty())));

    expect(parseScenario(file, { rules: false })).toEqual(empty());
    expect(() => parseScenario(file)).toThrow(ScenarioFileError);
  });

  it("gets an id of four random letters or digits", () => {
    expect(newMapId()).toMatch(/^map-[a-z0-9]{4}$/);
    expect(newMapId(() => 0)).toBe("map-aaaa");
  });

  it("can start as a copy of a scenario, without its art", () => {
    const pegasus = scenarios.find((s) => s.id === "pegasus-bridge")!;
    const copy = copyDraft(pegasus, "map-copy");

    expect(copy).toMatchObject({ id: "map-copy", name: { es: "Pegasus Bridge (copia)", en: "Pegasus Bridge (copy)" }, tiles: pegasus.tiles });
    expect(copy.image).toBeUndefined();
    expect(copy.tiles).not.toBe(pegasus.tiles);
    expect(validateScenario(copy)).toEqual([]);
  });
});

describe("editing", () => {
  it("never changes the map it's given", () => {
    const draft = withInfantry();
    const before = structuredClone(draft);

    paintTerrain(draft, A, HexType.LAKE);
    placeUnit(draft, B, "Axis", UnitType.TANK);
    toggleElite(draft, A);
    setWire(draft, B, true);
    clearHex(draft, A);

    expect(draft).toEqual(before);
  });

  it("paints one terrain per hex, and plains clears it", () => {
    const forest = edit(empty(), (d) => paintTerrain(d, A, HexType.FOREST), (d) => paintTerrain(d, B, HexType.FOREST));
    const town = edit(forest, (d) => paintTerrain(d, A, HexType.TOWN));

    expect(town.tiles).toEqual({ forest: [B], town: [A] });
    expect(terrainAt(town, A)).toBe(HexType.TOWN);
    expect(edit(town, (d) => paintTerrain(d, A, HexType.PLAINS), (d) => paintTerrain(d, B, HexType.PLAINS)).tiles).toEqual({});
  });

  it("gives back the same map when nothing changes, and refuses hexes off the board", () => {
    const forest = edit(empty(), (d) => paintTerrain(d, A, HexType.FOREST));

    expect(paintTerrain(forest, A, HexType.FOREST)).toBe(forest);
    expect(removeUnit(forest, A)).toBe(forest);
    expect(paintTerrain(forest, OFF, HexType.FOREST)).toBe(false);
  });

  it("takes the unit and the wire off a hex painted with water", () => {
    const draft = edit(withInfantry(), (d) => toggleElite(d, A), (d) => toggleSandbags(d, A), (d) => setWire(d, A, true));
    const lake = edit(draft, (d) => paintTerrain(d, A, HexType.LAKE));

    expect(unitAt(lake, A)).toBeNull();
    expect([isElite(lake, A), hasSandbags(lake, A), hasWire(lake, A)]).toEqual([false, false, false]);
    expect(lake).not.toHaveProperty("elite");
  });

  it("puts units on land only, one per hex", () => {
    const draft = edit(empty(), (d) => paintTerrain(d, B, HexType.RIVER));

    expect(placeUnit(draft, B, "Allies", UnitType.TANK)).toBe(false);
    const both = edit(draft, (d) => placeUnit(d, A, "Allies", UnitType.TANK), (d) => placeUnit(d, { row: 0, col: 0 }, "Axis", UnitType.ARTILLERY));
    expect(both.units).toEqual({ allies: { tank: [A] }, axis: { artillery: [{ row: 0, col: 0 }] } });
    expect(unitAt(both, A)).toEqual({ faction: "Allies", type: UnitType.TANK });
  });

  it("swaps a unit for another, which loses the first one's badge and sandbags", () => {
    const draft = edit(withInfantry(), (d) => toggleElite(d, A), (d) => toggleSandbags(d, A));
    const swapped = edit(draft, (d) => placeUnit(d, A, "Axis", UnitType.TANK));

    expect(swapped.units).toEqual({ allies: {}, axis: { tank: [A] } });
    expect([isElite(swapped, A), hasSandbags(swapped, A)]).toEqual([false, false]);
  });

  it("gives badges and sandbags only to a unit, and takes them off again", () => {
    expect(toggleElite(empty(), A)).toBe(false);
    expect(toggleSandbags(empty(), A)).toBe(false);
    const elite = edit(withInfantry(), (d) => toggleElite(d, A));
    expect(elite.elite).toEqual([A]);
    expect(edit(elite, (d) => toggleElite(d, A))).not.toHaveProperty("elite");
  });

  it("lays wire on land, not water", () => {
    const wired = edit(empty(), (d) => setWire(d, A, true));

    expect(wired.wire).toEqual([A]);
    expect(setWire(wired, A, true)).toBe(wired);
    expect(edit(wired, (d) => setWire(d, A, false))).not.toHaveProperty("wire");
    expect(setWire(edit(empty(), (d) => paintTerrain(d, A, HexType.LAKE)), A, true)).toBe(false);
  });

  it("clears a hex of everything", () => {
    const draft = edit(withInfantry(), (d) => paintTerrain(d, A, HexType.FOREST), (d) => setWire(d, A, true), (d) => toggleElite(d, A));

    expect(clearHex(draft, A)).toEqual(empty());
  });

  it("counts each side's units and the towns", () => {
    const draft = edit(
      withInfantry(),
      (d) => placeUnit(d, B, "Axis", UnitType.TANK),
      (d) => paintTerrain(d, { row: 0, col: 0 }, HexType.TOWN),
    );

    expect(draftCounts(draft)).toEqual({ allies: { infantry: 1, tank: 0, artillery: 0 }, axis: { infantry: 0, tank: 1, artillery: 0 }, towns: 1 });
  });
});

describe("strokes", () => {
  it("paints terrain across the stroke, or clears it when it starts on that terrain", () => {
    const paint = strokeOf({ kind: "terrain", type: HexType.FOREST }, empty(), A);
    const forest = edit(empty(), (d) => paint.apply(d, A), (d) => paint.apply(d, B));
    const clear = strokeOf({ kind: "terrain", type: HexType.FOREST }, forest, A);

    expect(paint.drags).toBe(true);
    expect(forest.tiles).toEqual({ forest: [A, B] });
    expect(edit(forest, (d) => clear.apply(d, A), (d) => clear.apply(d, B)).tiles).toEqual({});
  });

  it("lays or lifts wire across the stroke, as on its first hex", () => {
    const lay = strokeOf({ kind: "wire" }, empty(), A);
    const wired = edit(empty(), (d) => lay.apply(d, A), (d) => lay.apply(d, B));
    const lift = strokeOf({ kind: "wire" }, wired, B);

    expect(wired.wire).toEqual([A, B]);
    expect(edit(wired, (d) => lift.apply(d, B), (d) => lift.apply(d, A))).not.toHaveProperty("wire");
  });

  it("puts a unit on the first hex, or takes off the same one", () => {
    const tool = { kind: "unit", faction: "Allies", type: UnitType.INFANTRY } as const;
    const place = strokeOf(tool, empty(), A);

    expect(place.drags).toBe(false);
    expect(unitAt(edit(empty(), (d) => place.apply(d, A)), A)).toEqual({ faction: "Allies", type: UnitType.INFANTRY });
    expect(edit(withInfantry(), (d) => strokeOf(tool, withInfantry(), A).apply(d, A))).toEqual(empty());
    // Another unit there is swapped
    const tank = strokeOf({ kind: "unit", faction: "Axis", type: UnitType.TANK }, withInfantry(), A);
    expect(unitAt(edit(withInfantry(), (d) => tank.apply(d, A)), A)).toEqual({ faction: "Axis", type: UnitType.TANK });
  });

  it("toggles a badge or sandbags on the first hex only, and refuses a hex with no unit", () => {
    expect(strokeOf({ kind: "elite" }, withInfantry(), A)).toMatchObject({ drags: false });
    expect(strokeOf({ kind: "sandbags" }, empty(), A).apply(empty(), A)).toBe(false);
  });
});

describe("undo and redo", () => {
  const one = edit(empty(), (d) => paintTerrain(d, A, HexType.FOREST));
  const two = edit(one, (d) => paintTerrain(d, B, HexType.FOREST));

  it("walks back and forth through the steps", () => {
    const history = recordStep(recordStep(startHistory(empty()), one), two);

    expect(undoStep(history).present).toBe(one);
    expect(undoStep(undoStep(history)).present).toEqual(empty());
    expect(redoStep(undoStep(undoStep(history))).present).toBe(one);
    expect(undoStep(startHistory(empty()))).toEqual(startHistory(empty()));
    expect(redoStep(history)).toBe(history);
  });

  it("keeps a whole stroke as one step, and forgets the redo after a new step", () => {
    const stroke = recordStep(recordStep(startHistory(empty()), one), two, true);

    expect(stroke.past).toEqual([empty()]);
    expect(undoStep(stroke).present).toEqual(empty());
    expect(recordStep(undoStep(stroke), one).future).toEqual([]);
  });

  it("keeps no step that changes nothing, and at most the last steps", () => {
    const history = startHistory(empty());
    expect(recordStep(history, history.present)).toBe(history);

    let long = history;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) long = recordStep(long, { ...long.present });
    expect(long.past).toHaveLength(HISTORY_LIMIT);
  });
});
