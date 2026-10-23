import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  clearHex,
  copyDraft,
  defaultParadrop,
  draftCounts,
  isBlank,
  isProvisionalId,
  mapIdFor,
  slugOf,
  hasSandbags,
  hasWire,
  isElite,
  newDraft,
  newMapId,
  paintTerrain,
  placeUnit,
  recordStep,
  redoStep,
  removeObjective,
  removeUnit,
  resizeBoard,
  isObjective,
  setAirSorties,
  setObjective,
  setObjectiveName,
  setVictory,
  setVictoryMedals,
  setAttacker,
  setBigGuns,
  setCardCost,
  setFordableRivers,
  setParadrop,
  setText,
  setWire,
  startHistory,
  strokeOf,
  pickedTileAt,
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
import { airSortiesOf, hasBigGuns } from "../data/scenarioRules";
import { cardCost, cardsOf } from "./actionCard";
import { actionCardById } from "../data/actionCards";
import { same } from "../i18n/lang";

const A = { row: 4, col: 4 };
const B = { row: 4, col: 5 };
const OFF = { row: 1, col: 12 };
const OFF_WATER = { row: 2, col: 2 };

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

    expect(draft).toMatchObject({ id: "map-test", tiles: {}, units: { allies: {}, axis: {} }, attacker: "Allies" });
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

  it("names a copy in the languages its scenario is named in", () => {
    const copy = copyDraft(setText(newDraft("map-a"), "name", "es", "Setos"), "map-b");
    expect(copy.name).toEqual({ es: "Setos (copia)", en: "" });
  });
});

describe("a map's id", () => {
  it("is a new map's random one until it has a name", () => {
    expect(isProvisionalId(newMapId())).toBe(true);
    expect(isProvisionalId("bocage-3f9k")).toBe(false);
  });

  it("makes lower-case words of a name, without accents or signs", () => {
    expect(slugOf("Forêt d'Écouves")).toBe("foret-d-ecouves");
    expect(slugOf("  Sainte-Mère-Église (1944)! ")).toBe("sainte-mere-eglise-1944");
    expect(slugOf("¡¿…?!")).toBe("map");
    expect(slugOf("La batalla de los setos de la Normandía, junio y julio de 1944")).toBe("la-batalla-de-los-setos-de-la-normandia");
  });

  it("comes from the name, the English one first, keeping the id's random part", () => {
    const draft = setText(setText(newDraft("map-3f9k"), "name", "es", "Los setos"), "name", "en", "The hedgerows");
    expect(mapIdFor(draft, () => false)).toBe("the-hedgerows-3f9k");
    expect(mapIdFor(setText(draft, "name", "en", ""), () => false)).toBe("los-setos-3f9k");
  });

  it("gets a new random part when the id is taken", () => {
    const draft = setText(newDraft("map-3f9k"), "name", "es", "Bocage");
    const taken = new Set(["bocage-3f9k", "bocage-aaaa"]);
    const random = [0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99][Symbol.iterator]();

    expect(mapIdFor(draft, (id) => taken.has(id), () => random.next().value ?? 0)).toBe("bocage-9999");
  });

  it("isn't made for a blank map, which isn't kept", () => {
    expect(isBlank(empty())).toBe(true);
    expect(isBlank(setText(empty(), "description", "es", "Normandía"))).toBe(false);
    expect(isBlank(withInfantry())).toBe(false);
    expect(isBlank(edit(empty(), (d) => paintTerrain(d, A, HexType.FOREST)))).toBe(false);
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

  it("keeps the tile picked for a town until the hex is painted with something else", () => {
    const town = edit(empty(), (d) => paintTerrain(d, A, HexType.TOWN, "village-3"), (d) => paintTerrain(d, B, HexType.TOWN));

    expect(town.tiles).toEqual({ town: [A, B] });
    expect(town.pickedTiles).toEqual([{ ...A, tile: "village-3" }]);
    expect(paintTerrain(town, A, HexType.TOWN, "village-3")).toBe(town);
    expect(paintTerrain(town, A, HexType.TOWN)).toBe(town);
    const other = edit(town, (d) => paintTerrain(d, A, HexType.TOWN, "official"));
    expect(other.tiles).toBe(town.tiles);
    expect(pickedTileAt(other, A)).toBe("official");
    expect(edit(other, (d) => paintTerrain(d, A, HexType.FOREST))).not.toHaveProperty("pickedTiles");
    expect(edit(other, (d) => clearHex(d, A))).not.toHaveProperty("pickedTiles");
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

describe("the scenario's settings", () => {
  it("writes the name and the description in each language", () => {
    const draft = empty();
    const named = setText(setText(draft, "name", "es", "Bocage"), "description", "en", "Hedgerows");

    expect(named.name).toEqual({ es: "Bocage", en: "" });
    expect(named.description).toEqual({ es: "", en: "Hedgerows" });
    expect(draft.name).toEqual({ es: "", en: "" });
    expect(setText(named, "name", "es", "Bocage")).toBe(named);
    expect(validateScenario(named).map((p) => p.message.en)).not.toContain("The scenario has no name");
  });

  it("sets the attacker", () => {
    const draft = edit(empty(), (d) => setAttacker(d, "Axis"));

    expect(draft).toMatchObject({ attacker: "Axis" });
    expect(setAttacker(draft, "Axis")).toBe(draft);
  });

  it("keeps air sorties and big guns out of the map while both sides have the usual ones", () => {
    const draft = empty();
    const noAir = edit(draft, (d) => setAirSorties(d, "Axis", 0));
    const noGuns = setBigGuns(noAir, "Allies", false);

    expect(noAir.airPower).toEqual({ allies: 1, axis: 0 });
    expect(noGuns.bigGuns).toEqual(["Axis"]);
    expect([airSortiesOf(noGuns, "Axis"), hasBigGuns(noGuns, "Allies")]).toEqual([0, false]);
    expect(cardsOf(noGuns, "Axis").some(({ card }) => card.needs === "air")).toBe(false);
    expect(cardsOf(noGuns, "Allies").some(({ card }) => card.needs === "bigGuns")).toBe(false);

    const back = setBigGuns(edit(noGuns, (d) => setAirSorties(d, "Axis", 1)), "Allies", true);
    expect(back).toEqual(draft);
    expect(setAirSorties(draft, "Allies", -1)).toBe(false);
    expect(setBigGuns(draft, "Axis", true)).toBe(draft);
  });

  it("makes a card cheaper for one side, from its own cost down to 0, through a file too", () => {
    const draft = empty();
    const resupply = actionCardById("resupply")!;
    const cheaper = edit(draft, (d) => setCardCost(d, "Axis", "resupply", 4));

    expect(cheaper.cardCosts).toEqual({ allies: {}, axis: { resupply: 4 } });
    expect(cardCost(cheaper, "Axis", resupply)).toBe(4);
    expect(cardCost(cheaper, "Allies", resupply)).toBe(resupply.cost);
    expect(setCardCost(cheaper, "Axis", "resupply", 4)).toBe(cheaper);
    expect(setCardCost(cheaper, "Axis", "resupply", resupply.cost + 1)).toBe(false);
    expect(setCardCost(cheaper, "Axis", "resupply", -1)).toBe(false);
    expect(setCardCost(cheaper, "Axis", "no-such-card", 1)).toBe(false);
    expect(edit(cheaper, (d) => setCardCost(d, "Axis", "resupply", 0)).cardCosts?.axis).toEqual({ resupply: 0 });
    expect(parseScenario(JSON.parse(JSON.stringify(toScenarioFile(cheaper))), { rules: false }).cardCosts).toEqual(cheaper.cardCosts);
    expect(edit(cheaper, (d) => setCardCost(d, "Axis", "resupply", resupply.cost))).toEqual(draft);
  });

  it("turns fordable rivers on and off, keeping them out of the map when off, through a file too", () => {
    const draft = empty();
    const ford = setFordableRivers(draft, true);
    expect(ford.fordableRivers).toBe(true);
    expect(setFordableRivers(ford, true)).toBe(ford);
    expect(parseScenario(JSON.parse(JSON.stringify(toScenarioFile(ford))), { rules: false }).fordableRivers).toBe(true);
    expect(setFordableRivers(ford, false)).toEqual(draft);
    expect(() => parseScenario({ ...JSON.parse(JSON.stringify(toScenarioFile(draft))), fordableRivers: "yes" }, { rules: false })).toThrow(
      ScenarioFileError
    );
  });

  it("turns the paradrop on and off", () => {
    const draft = setAttacker(empty(), "Axis");
    const special = edit(draft, (d) => setParadrop(d, defaultParadrop(d)));

    expect(special.paradrop).toEqual({ faction: "Axis", unitType: UnitType.INFANTRY, units: 4 });
    expect(setParadrop(special, { faction: "Axis", unitType: UnitType.TANK, units: 11 })).toBe(false);
    expect(edit(special, (d) => setParadrop(d, null))).toEqual(draft);
  });

  it("lets a side that drops by parachute start with no units on the board", () => {
    const withAxis = edit(empty(), (d) => placeUnit(d, A, "Axis", UnitType.INFANTRY), (d) => setText(d, "name", "en", "Drop"));
    const messages = (draft: Scenario) => validateScenario(draft).map((p) => p.message.en);

    expect(messages(withAxis)).toEqual(["The Allies have no units"]);
    expect(messages(edit(withAxis, (d) => setParadrop(d, defaultParadrop(d))))).toEqual([]);
  });
});

describe("victory", () => {
  it("turns the victory conditions on and off, and sets the medals", () => {
    const won = setVictory(empty(), true);

    expect(won.victory).toEqual({ medals: 5 });
    expect(edit(won, (d) => setVictoryMedals(d, 7)).victory).toEqual({ medals: 7 });
    expect(setVictoryMedals(won, 0)).toBe(false);
    expect(setVictoryMedals(empty(), 3)).toBe(false);
    expect(setVictory(won, false)).toEqual(empty());
  });

  it("puts objectives on the map one hex each, turning the victory conditions on", () => {
    const draft = edit(
      empty(),
      (d) => setObjective(d, A, "Allies", true),
      (d) => setObjective(d, B, "Allies", true),
      (d) => setObjective(d, A, "Axis", true),
    );

    expect(draft.victory).toEqual({
      medals: 5,
      objectives: [
        { faction: "Allies", name: { es: "Objetivo 1", en: "Objective 1" }, hexes: [A] },
        { faction: "Allies", name: { es: "Objetivo 2", en: "Objective 2" }, hexes: [B] },
        { faction: "Axis", name: { es: "Objetivo 1", en: "Objective 1" }, hexes: [A] },
      ],
    });
    expect(setObjective(draft, A, "Allies", true)).toBe(draft);
    expect(validateScenario(draft).filter((p) => p.positions.length)).toEqual([]);

    const lifted = edit(draft, (d) => setObjective(d, A, "Allies", false));
    expect([isObjective(lifted, A, "Allies"), isObjective(lifted, A, "Axis")]).toEqual([false, true]);
    // The next one takes the name left free
    expect(edit(lifted, (d) => setObjective(d, OFF_WATER, "Allies", true)).victory?.objectives?.at(-1)?.name.en).toBe("Objective 1");
  });

  it("keeps objectives off water, and takes them off with the hex", () => {
    const lake = edit(empty(), (d) => paintTerrain(d, A, HexType.LAKE));
    expect(setObjective(lake, A, "Allies", true)).toBe(false);

    const objective = edit(empty(), (d) => setObjective(d, A, "Axis", true));
    expect(edit(objective, (d) => paintTerrain(d, A, HexType.RIVER)).victory).toEqual({ medals: 5 });
    expect(clearHex(objective, A).victory).toEqual({ medals: 5 });
  });

  it("names and removes objectives", () => {
    const draft = edit(empty(), (d) => setObjective(d, A, "Allies", true), (d) => setObjective(d, B, "Axis", true));
    const named = edit(draft, (d) => setObjectiveName(d, 0, "es", "Puente"), (d) => setObjectiveName(d, 0, "en", ""));

    expect(named.victory?.objectives?.[0]?.name).toEqual({ es: "Puente", en: "" });
    const unnamed = edit(named, (d) => setObjectiveName(d, 0, "es", " "));
    expect(validateScenario(unnamed).map((p) => p.message.en)).toContain("Some objectives have no name");
    expect(edit(named, (d) => removeObjective(d, 0)).victory?.objectives?.map((o) => o.faction)).toEqual(["Axis"]);
    expect(removeObjective(named, 5)).toBe(false);
  });

  it("toggles objectives across a stroke, as on its first hex", () => {
    const tool = { kind: "objective", faction: "Allies" } as const;
    const put = strokeOf(tool, empty(), A);
    const both = edit(empty(), (d) => put.apply(d, A), (d) => put.apply(d, B));
    const lift = strokeOf(tool, both, A);

    expect(put.drags).toBe(true);
    expect(both.victory?.objectives).toHaveLength(2);
    expect(edit(both, (d) => lift.apply(d, A), (d) => lift.apply(d, B)).victory).toEqual({ medals: 5 });
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

  it("gives towns a picked tile across the stroke, or clears them when it starts on a town with that tile", () => {
    const tool = { kind: "terrain", type: HexType.TOWN, tile: "village-1" } as const;
    const towns = edit(empty(), (d) => paintTerrain(d, A, HexType.TOWN), (d) => paintTerrain(d, B, HexType.TOWN, "village-2"));
    const repick = strokeOf(tool, towns, A);
    const picked = edit(towns, (d) => repick.apply(d, A), (d) => repick.apply(d, B));

    expect(picked.tiles).toEqual(towns.tiles);
    expect([pickedTileAt(picked, A), pickedTileAt(picked, B)]).toEqual(["village-1", "village-1"]);
    const clear = strokeOf(tool, picked, A);
    expect(edit(picked, (d) => clear.apply(d, A), (d) => clear.apply(d, B))).toMatchObject({ tiles: {} });
    // The town tool with no tile of its own clears a town whatever its tile
    const plain = strokeOf({ kind: "terrain", type: HexType.TOWN }, picked, A);
    expect(edit(picked, (d) => plain.apply(d, A)).tiles).toEqual({ town: [B] });
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

describe("resizeBoard", () => {
  const map = (): Scenario => ({
    ...newDraft("map-test"),
    tiles: { [HexType.FOREST]: [{ row: 0, col: 0 }], [HexType.TOWN]: [{ row: 8, col: 12 }] },
    units: { allies: { [UnitType.INFANTRY]: [{ row: 8, col: 0 }] }, axis: { [UnitType.TANK]: [{ row: 0, col: 12 }] } },
    pickedTiles: [{ row: 8, col: 12, tile: "village-5" }],
    wire: [{ row: 4, col: 6 }],
    sandbags: [{ row: 8, col: 0 }],
    elite: [{ row: 0, col: 12 }],
    victory: {
      medals: 4,
      objectives: [
        { faction: "Allies", name: same("Pueblo"), hexes: [{ row: 8, col: 12 }] },
        { faction: "Axis", name: same("Granja"), hexes: [{ row: 0, col: 5 }] },
      ],
    },
  });

  it("adds a column on the right, the map staying where it was", () => {
    const grown = resizeBoard(map(), "right", true) as Scenario;

    expect(grown.board).toEqual({ cols: 14, rows: 9 });
    expect(grown.units).toEqual(map().units);
    expect(grown.tiles).toEqual(map().tiles);
  });

  it("adds a column on the left, moving everything one hex right", () => {
    const grown = resizeBoard(map(), "left", true, HexType.FOREST) as Scenario;

    expect(grown.board).toEqual({ cols: 14, rows: 9 });
    expect(grown.units.allies[UnitType.INFANTRY]).toEqual([{ row: 8, col: 1 }]);
    expect(grown.wire).toEqual([{ row: 4, col: 7 }]);
    expect(grown.sandbags).toEqual([{ row: 8, col: 1 }]);
    expect(grown.elite).toEqual([{ row: 0, col: 13 }]);
    expect(grown.pickedTiles).toEqual([{ row: 8, col: 13, tile: "village-5" }]);
    expect(grown.victory?.objectives?.[0]?.hexes).toEqual([{ row: 8, col: 13 }]);
    // The new column is forest, one hex in every row
    const forest = grown.tiles[HexType.FOREST] ?? [];
    expect(forest).toContainEqual({ row: 0, col: 1 });
    expect(forest.filter((p) => p.col === 0)).toHaveLength(9);
  });

  it("adds two rows at the top, moving everything two rows down", () => {
    const grown = resizeBoard(map(), "top", true) as Scenario;

    expect(grown.board).toEqual({ cols: 13, rows: 11 });
    expect(grown.units.axis[UnitType.TANK]).toEqual([{ row: 2, col: 12 }]);
    expect(grown.tiles[HexType.FOREST]).toEqual([{ row: 2, col: 0 }]);
  });

  it("takes an edge back off, with what was on it, and is the standard board again", () => {
    const grown = resizeBoard(map(), "left", true, HexType.FOREST) as Scenario;
    const back = resizeBoard(grown, "left", false) as Scenario;

    expect(back).not.toHaveProperty("board");
    expect(back.units).toEqual(map().units);
    expect(back.tiles).toEqual(map().tiles);

    const narrowed = resizeBoard(resizeBoard(map(), "right", true) as Scenario, "right", false) as Scenario;
    expect(narrowed).toEqual(map());
  });

  it("drops what falls off a shrinking edge, and an objective left with no hex", () => {
    const bigger = resizeBoard(resizeBoard(map(), "bottom", true) as Scenario, "right", true) as Scenario;
    const cut = resizeBoard(resizeBoard(bigger, "left", false) as Scenario, "top", false) as Scenario;

    expect(cut).not.toHaveProperty("board");
    expect(cut.units.axis).toEqual({});
    expect(cut.elite).toBeUndefined();
    expect(cut.units.allies[UnitType.INFANTRY]).toBeUndefined();
    expect(cut.victory?.objectives).toEqual([{ faction: "Allies", name: same("Pueblo"), hexes: [{ row: 6, col: 11 }] }]);
  });

  it("stays within the size limits", () => {
    expect(resizeBoard(map(), "left", false)).toBe(false);
    expect(resizeBoard(map(), "top", false)).toBe(false);
    let wide: Scenario = map();
    for (let i = 0; i < 20; i++) wide = resizeBoard(wide, "right", true) as Scenario;
    expect(wide.board).toEqual({ cols: 33, rows: 9 });
    expect(resizeBoard(wide, "right", true)).toBe(false);
  });
});
