import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import schema from "./scenarioFile.schema.json";
import {
  SCENARIO_FILE_FIELDS,
  ScenarioFile,
  ScenarioFileError,
  describeProblem,
  parseScenario,
  toScenarioFile,
  validateScenario,
} from "./scenarioFile";
import { scenarios } from "../data/scenarios";
import { Scenario } from "../types/scenario";
import { HexType } from "../types/hex";
import { FACTIONS } from "../types/faction";
import { UnitType } from "./unit";

const matchesSchema = new Ajv({ allErrors: true }).compile(schema);

const testFile = (): ScenarioFile => ({
  version: 1,
  board: "standard",
  id: "test-map",
  name: { es: "Prueba", en: "Test" },
  description: { es: "Un mapa de prueba.", en: "A test map." },
  initialHandSize: { allies: 5, axis: 4 },
  attacker: "Allies",
  tiles: { [HexType.FOREST]: [{ row: 4, col: 4 }], [HexType.RIVER]: [{ row: 4, col: 6 }], [HexType.LAKE]: [{ row: 5, col: 6 }] },
  units: {
    allies: { [UnitType.INFANTRY]: [{ row: 8, col: 0 }, { row: 8, col: 1 }] },
    axis: { [UnitType.TANK]: [{ row: 0, col: 0 }] },
  },
});

/** The file as JSON.parse gives it back, to change it in ways the type wouldn't allow */
const json = (changes: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...JSON.parse(JSON.stringify(testFile())),
  ...changes,
});

const problemsWith = (changes: Partial<Scenario>) => validateScenario({ ...parseScenario(json()), ...changes });
const messages = (problems: ReturnType<typeof validateScenario>) => problems.map((problem) => problem.message.en);

describe("scenario files", () => {
  it("reads a file back into the scenario it was made from", () => {
    const { $schema: _schema, version: _version, board: _board, ...scenario } = testFile();

    expect(parseScenario(json())).toEqual(scenario);
  });

  it.each(scenarios.map((s) => [s.id, s] as const))("round-trips %s through a file", (_id, scenario) => {
    const { image: _image, ...withoutArt } = scenario;
    const file = JSON.parse(JSON.stringify(toScenarioFile(scenario)));

    expect(matchesSchema(file)).toBe(true);
    expect(parseScenario(file)).toEqual(withoutArt);
  });

  it("ignores the $schema an editor reads the format from", () => {
    expect(parseScenario(json({ $schema: "../../game-core/scenarioFile.schema.json" })).id).toBe("test-map");
  });
});

describe("the JSON Schema", () => {
  it("has the fields the app reads, and the required ones", () => {
    expect(Object.keys(schema.properties).sort()).toEqual([...SCENARIO_FILE_FIELDS].sort());
    expect(schema.required.every((field) => (SCENARIO_FILE_FIELDS as string[]).includes(field))).toBe(true);
  });

  it("lists the app's terrains, unit types and sides", () => {
    expect(schema.definitions.hexType.enum).toEqual(Object.values(HexType));
    expect(schema.definitions.unitType.enum).toEqual(Object.values(UnitType));
    expect(schema.definitions.faction.enum).toEqual([...FACTIONS]);
  });
});

describe("parseScenario reads older files", () => {
  it("drops the Reinforcements table of a file from before the card always brought infantry", () => {
    const file = json({ reinforcements: { infantry: "infantry", tank: "tank", grenade: "infantry", supply: null, flag: null } });

    const scenario = parseScenario(file);

    expect(scenario).not.toHaveProperty("reinforcements");
    expect(scenario.id).toBe("test-map");
    expect(matchesSchema(file)).toBe(true);
  });
});

describe("parseScenario refuses a file of the wrong shape", () => {
  it.each([
    ["a list", [], "The file isn't a scenario"],
    ["a field it doesn't know", json({ medals: 6 }), '"medals" isn\'t a scenario field'],
    ["another version", json({ version: 2 }), '"version" must be 1'],
    ["another board", json({ board: "overlord" }), '"board" must be "standard"'],
    ["no name", json({ name: undefined }), '"name" is missing'],
    ["a name in one language only", json({ name: { es: "Prueba" } }), '"name" must be a text in each language'],
    ["a terrain it doesn't know", json({ tiles: { swamp: [{ row: 0, col: 0 }] } }), '"tiles.swamp" isn\'t a terrain'],
    ["a unit type it doesn't know", json({ units: { allies: { jeep: [{ row: 8, col: 0 }] }, axis: {} } }), '"units.allies.jeep" isn\'t a unit type'],
    ["a hex with something else in it", json({ wire: [{ row: 1, col: 1, kind: "wire" }] }), '"wire" must be a list of hexes'],
    ["half a hand size", json({ initialHandSize: { allies: 4.5, axis: 4 } }), '"initialHandSize.allies" must be a whole number'],
    ["a side that isn't one", json({ attacker: "Soviets" }), '"attacker" must be "Allies" or "Axis"'],
  ])("%s", (_case, file, message) => {
    expect(() => parseScenario(file)).toThrow(ScenarioFileError);
    expect(() => parseScenario(file)).toThrow(message);
    // The schema says the same, so an editor shows it too
    expect(matchesSchema(file)).toBe(false);
  });

  it("lists every field that's wrong, not just the first", () => {
    try {
      parseScenario(json({ version: 2, attacker: "Soviets" }));
      expect.unreachable();
    } catch (error) {
      expect(messages((error as ScenarioFileError).problems)).toEqual(['"version" must be 1', '"attacker" must be "Allies" or "Axis"']);
    }
  });
});

describe("validateScenario", () => {
  it("finds nothing wrong with a playable map", () => {
    expect(validateScenario(parseScenario(json()))).toEqual([]);
  });

  it("points at the hexes that break a rule", () => {
    const problems = problemsWith({
      units: {
        allies: { [UnitType.INFANTRY]: [{ row: 4, col: 6 }, { row: 8, col: 0 }, { row: 8, col: 0 }] },
        axis: { [UnitType.TANK]: [{ row: 0, col: 0 }] },
      },
      tiles: { [HexType.FOREST]: [{ row: 4, col: 4 }], [HexType.TOWN]: [{ row: 4, col: 4 }], [HexType.RIVER]: [{ row: 4, col: 6 }] },
      wire: [{ row: 4, col: 6 }],
      sandbags: [{ row: 3, col: 3 }],
      elite: [{ row: 0, col: 0 }, { row: 2, col: 2 }],
    });

    expect(problems).toEqual([
      { message: expect.objectContaining({ en: "Some hexes have two terrains" }), positions: [{ row: 4, col: 4 }] },
      { message: expect.objectContaining({ en: "Some hexes have two units" }), positions: [{ row: 8, col: 0 }] },
      { message: expect.objectContaining({ en: "Some units are on a river or a lake" }), positions: [{ row: 4, col: 6 }] },
      { message: expect.objectContaining({ en: "Some barbed wire is on a river or a lake" }), positions: [{ row: 4, col: 6 }] },
      { message: expect.objectContaining({ en: "Some sandbags are where no unit starts" }), positions: [{ row: 3, col: 3 }] },
      { message: expect.objectContaining({ en: "Some elite badges are where no unit starts" }), positions: [{ row: 2, col: 2 }] },
    ]);
  });

  it("knows odd rows have one hex less", () => {
    const problems = problemsWith({ wire: [{ row: 0, col: 12 }, { row: 1, col: 12 }, { row: 9, col: 0 }, { row: 2, col: -1 }] });

    expect(problems).toEqual([
      { message: expect.objectContaining({ en: "Some hexes are off the board" }), positions: [{ row: 1, col: 12 }, { row: 9, col: 0 }, { row: 2, col: -1 }] },
    ]);
  });

  it("needs units on both sides, unless a side drops them by parachute", () => {
    const noAllies = { allies: {}, axis: { [UnitType.TANK]: [{ row: 0, col: 0 }] } };

    expect(messages(problemsWith({ units: noAllies }))).toEqual(["The Allies have no units"]);
    expect(problemsWith({ units: noAllies, paradrop: { faction: "Allies", unitType: UnitType.INFANTRY, units: 4 } })).toEqual([]);
  });

  it("needs a name in one language at least", () => {
    expect(messages(problemsWith({ name: { es: "", en: " " } }))).toEqual(["The scenario has no name"]);
    expect(problemsWith({ name: { es: "Prueba", en: "" } })).toEqual([]);
  });

  it("checks the id, the hands and the numbers", () => {
    const problems = problemsWith({
      id: "Test Map",
      initialHandSize: { allies: 0, axis: 4 },
      paradrop: { faction: "Allies", unitType: UnitType.INFANTRY, units: 0 },
      extraDraws: { faction: "Axis", turns: 0 },
      airPower: { allies: -1, axis: 0 },
    });

    expect(messages(problems)).toEqual([
      'The id "Test Map" must be lower-case words joined by hyphens',
      "The Allies must start with 1 command card or more",
      "The paradrop needs 1 unit or more",
      "The extra draws need 1 turn or more",
      "Air sorties must be 0 or more",
    ]);
  });

  it("says each problem in Spanish too, with its hexes", () => {
    const [problem] = problemsWith({ sandbags: [{ row: 3, col: 3 }, { row: 2, col: 5 }] });

    expect(describeProblem(problem!, "es")).toBe("Hay sacos terreros donde no empieza ninguna unidad (3-3, 2-5)");
  });

  it("is what parseScenario throws for a file that breaks a rule", () => {
    expect(() => parseScenario(json({ sandbags: [{ row: 3, col: 3 }] }))).toThrow("Some sandbags are where no unit starts (3-3)");
  });
});
