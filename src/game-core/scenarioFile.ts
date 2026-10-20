// game-core/scenarioFile.ts
// A scenario as a plain JSON file: what the map editor saves and sends to the
// other tablet, and what the catalog keeps (data/catalog/<id>.json). The format
// is described for editors and for Claude Code in scenarioFile.schema.json.
// `parseScenario` reads a file back; `validateScenario` lists what's wrong with
// any scenario, so the built-ins, the catalog and the editor's maps all pass
// the same checks.
import { PickedTile, Position, Scenario } from "../types/scenario";
import { HexType, MovementRule, isHexType } from "../types/hex";
import { Faction, isFaction } from "../types/faction";
import { isUnitType } from "./unit";
import { positionKey } from "./position";
import { TERRAIN } from "../data/terrain";
import { BOARD_LIMITS, BoardSize, boardSizeOf, isBoardSize, isOnBoard, isStandardBoard } from "./boardSize";
import { Lang, Localized, isLocalized } from "../i18n/lang";

export const SCENARIO_FILE_VERSION = 1;

export interface ScenarioFile extends Omit<Scenario, "image" | "board"> {
  /** Where an editor finds the format (scenarioFile.schema.json); the app ignores it */
  $schema?: string;
  version: typeof SCENARIO_FILE_VERSION;
  /** "standard" (13×9), or a bigger board grown in the map editor */
  board: "standard" | BoardSize;
  /**
   * No longer used: the Reinforcements card's table of a unit per die face, from before the card
   * always brought infantry. Older files (and maps kept on a device) still have it; it's dropped
   */
  reinforcements?: unknown;
}

// Every field a file can have; the compiler keeps it in step with ScenarioFile
const FILE_FIELDS = {
  $schema: true,
  version: true,
  board: true,
  id: true,
  name: true,
  description: true,
  notes: true,
  initialHandSize: true,
  attacker: true,
  tiles: true,
  pickedTiles: true,
  units: true,
  reinforcements: true,
  paradrop: true,
  wire: true,
  sandbags: true,
  elite: true,
  extraDraws: true,
  bigGuns: true,
  airPower: true,
  fordableRivers: true,
  victory: true,
} as const satisfies Record<keyof ScenarioFile, true>;
export const SCENARIO_FILE_FIELDS = Object.keys(FILE_FIELDS) as (keyof ScenarioFile)[];

/** Something wrong with a scenario, and the hexes it's about (to show them on the map) */
export interface ScenarioProblem {
  message: Localized;
  positions: Position[];
}

/** A problem as one line, followed by its hexes as `row-col` */
export const describeProblem = ({ message, positions }: ScenarioProblem, lang: Lang): string =>
  positions.length ? `${message[lang]} (${positions.map(positionKey).join(", ")})` : message[lang];

/** A file that isn't a playable scenario, with everything wrong with it */
export class ScenarioFileError extends Error {
  readonly problems: ScenarioProblem[];

  constructor(problems: ScenarioProblem[]) {
    super(problems.map((problem) => describeProblem(problem, "en")).join("\n"));
    this.name = "ScenarioFileError";
    this.problems = problems;
  }
}

/** The scenario as a file; its board art stays with the app */
export const toScenarioFile = ({ image: _image, board, ...scenario }: Scenario): ScenarioFile => ({
  version: SCENARIO_FILE_VERSION,
  board: board && !isStandardBoard(board) ? { cols: board.cols, rows: board.rows } : "standard",
  ...scenario,
});

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SIDES = [
  ["allies", "Allies"],
  ["axis", "Axis"],
] as const;

const MESSAGES = {
  badId: (id: string): Localized => ({
    es: `El identificador «${id}» debe ser palabras en minúscula unidas por guiones`,
    en: `The id "${id}" must be lower-case words joined by hyphens`,
  }),
  noName: { es: "El escenario no tiene nombre", en: "The scenario has no name" },
  handSize: {
    Allies: { es: "Los Aliados deben empezar con 1 carta de mando o más", en: "The Allies must start with 1 command card or more" },
    Axis: { es: "El Eje debe empezar con 1 carta de mando o más", en: "The Axis must start with 1 command card or more" },
  },
  noUnits: {
    Allies: { es: "Los Aliados no tienen unidades", en: "The Allies have no units" },
    Axis: { es: "El Eje no tiene unidades", en: "The Axis has no units" },
  },
  offBoard: { es: "Hay casillas fuera del tablero", en: "Some hexes are off the board" },
  boardSize: {
    es: `El tablero debe tener de ${BOARD_LIMITS.cols.min} a ${BOARD_LIMITS.cols.max} columnas y de ${BOARD_LIMITS.rows.min} a ${BOARD_LIMITS.rows.max} filas, un número impar`,
    en: `The board must have ${BOARD_LIMITS.cols.min} to ${BOARD_LIMITS.cols.max} columns and ${BOARD_LIMITS.rows.min} to ${BOARD_LIMITS.rows.max} rows, an odd number`,
  },
  twoTerrains: { es: "Hay casillas con dos terrenos", en: "Some hexes have two terrains" },
  twoUnits: { es: "Hay casillas con dos unidades", en: "Some hexes have two units" },
  unitOnWater: { es: "Hay unidades en un río o un lago", en: "Some units are on a river or a lake" },
  wireOnWater: { es: "Hay alambradas en un río o un lago", en: "Some barbed wire is on a river or a lake" },
  sandbagsWithoutUnit: { es: "Hay sacos terreros donde no empieza ninguna unidad", en: "Some sandbags are where no unit starts" },
  eliteWithoutUnit: { es: "Hay distintivos de élite donde no empieza ninguna unidad", en: "Some elite badges are where no unit starts" },
  paradropUnits: { es: "El lanzamiento en paracaídas necesita 1 unidad o más", en: "The paradrop needs 1 unit or more" },
  extraDrawTurns: { es: "Los robos extra necesitan 1 turno o más", en: "The extra draws need 1 turn or more" },
  airPower: { es: "Las salidas aéreas deben ser 0 o más", en: "Air sorties must be 0 or more" },
  victoryMedals: { es: "La victoria necesita 1 medalla o más", en: "Victory needs 1 medal or more" },
  objectiveOnWater: { es: "Un objetivo no puede estar en el agua", en: "An objective can't be on water" },
  objectiveTwice: { es: "Una casilla es objetivo dos veces para el mismo bando", en: "A hex is an objective twice for the same side" },
  objectiveNoName: { es: "Hay objetivos sin nombre", en: "Some objectives have no name" },
} satisfies Record<string, Localized | ((...args: never[]) => Localized) | Record<Faction, Localized>>;


const isWater = (type: HexType | undefined): boolean => type !== undefined && TERRAIN[type].movement === MovementRule.BLOCK;

const isWholeNumber = (value: number, min: number): boolean => Number.isInteger(value) && value >= min;

/** Each hex once, in the order first met */
const uniquePositions = (positions: Position[]): Position[] => [
  ...new Map(positions.map((position) => [positionKey(position), position])).values(),
];

/** Everything that keeps a scenario from being played as it is; empty when it can be */
export function validateScenario(scenario: Scenario): ScenarioProblem[] {
  const problems: ScenarioProblem[] = [];
  const problem = (message: Localized) => problems.push({ message, positions: [] });
  const atHexes = (message: Localized, positions: Position[]) => {
    if (positions.length) problems.push({ message, positions: uniquePositions(positions) });
  };

  if (!ID_PATTERN.test(scenario.id)) problem(MESSAGES.badId(scenario.id));
  if (!scenario.name.es.trim() && !scenario.name.en.trim()) problem(MESSAGES.noName);
  for (const [side, faction] of SIDES) {
    if (!isWholeNumber(scenario.initialHandSize[side], 1)) problem(MESSAGES.handSize[faction]);
  }

  const terrain = new Map<string, HexType>();
  const twoTerrains: Position[] = [];
  for (const [type, positions] of Object.entries(scenario.tiles) as [HexType, Position[] | undefined][]) {
    for (const position of positions ?? []) {
      const before = terrain.get(positionKey(position));
      if (before !== undefined && before !== type) twoTerrains.push(position);
      terrain.set(positionKey(position), type);
    }
  }
  const terrainAt = (position: Position) => terrain.get(positionKey(position));

  const units = SIDES.flatMap(([side]) => Object.values(scenario.units[side]).flatMap((positions) => positions ?? []));
  const unitCount = new Map<string, number>();
  for (const position of units) unitCount.set(positionKey(position), (unitCount.get(positionKey(position)) ?? 0) + 1);
  const hasUnit = (position: Position) => unitCount.has(positionKey(position));

  const wire = scenario.wire ?? [];
  const sandbags = scenario.sandbags ?? [];
  const elite = scenario.elite ?? [];
  const objectiveHexes = (scenario.victory?.objectives ?? []).flatMap((objective) =>
    objective.hexes.map((hex) => ({ hex, faction: objective.faction }))
  );
  const objectives = objectiveHexes.map(({ hex }) => hex);
  const everyPosition = [
    ...Object.values(scenario.tiles).flatMap((positions) => positions ?? []),
    ...(scenario.pickedTiles ?? []).map(({ row, col }) => ({ row, col })),
    ...units,
    ...wire,
    ...sandbags,
    ...elite,
    ...objectives,
  ];

  if (scenario.board && !isBoardSize(scenario.board)) problem(MESSAGES.boardSize);
  atHexes(MESSAGES.offBoard, everyPosition.filter((position) => !isOnBoard(position, boardSizeOf(scenario))));
  atHexes(MESSAGES.twoTerrains, twoTerrains);
  atHexes(MESSAGES.twoUnits, units.filter((position) => (unitCount.get(positionKey(position)) ?? 0) > 1));
  atHexes(MESSAGES.unitOnWater, units.filter((position) => isWater(terrainAt(position))));
  atHexes(MESSAGES.wireOnWater, wire.filter((position) => isWater(terrainAt(position))));
  atHexes(MESSAGES.sandbagsWithoutUnit, sandbags.filter((position) => !hasUnit(position)));
  atHexes(MESSAGES.eliteWithoutUnit, elite.filter((position) => !hasUnit(position)));
  atHexes(MESSAGES.objectiveOnWater, objectives.filter((position) => isWater(terrainAt(position))));
  atHexes(
    MESSAGES.objectiveNoName,
    (scenario.victory?.objectives ?? []).filter(({ name }) => !name.es.trim() && !name.en.trim()).flatMap(({ hexes }) => hexes)
  );
  // A hex may be an objective for both sides (Sainte-Mère-Église), once each
  const objectiveKey = ({ hex, faction }: { hex: Position; faction: Faction }) => `${faction}:${positionKey(hex)}`;
  atHexes(
    MESSAGES.objectiveTwice,
    objectiveHexes
      .filter((objective, i) => objectiveHexes.findIndex((other) => objectiveKey(other) === objectiveKey(objective)) !== i)
      .map(({ hex }) => hex)
  );

  for (const [side, faction] of SIDES) {
    const onTheBoard = Object.values(scenario.units[side]).some((positions) => positions?.length);
    if (!onTheBoard && scenario.paradrop?.faction !== faction) problem(MESSAGES.noUnits[faction]);
  }

  if (scenario.paradrop && !isWholeNumber(scenario.paradrop.units, 1)) problem(MESSAGES.paradropUnits);
  if (scenario.extraDraws && !isWholeNumber(scenario.extraDraws.turns, 1)) problem(MESSAGES.extraDrawTurns);
  const airPower = scenario.airPower;
  if (airPower && SIDES.some(([side]) => !isWholeNumber(airPower[side], 0))) problem(MESSAGES.airPower);
  if (scenario.victory && !isWholeNumber(scenario.victory.medals, 1)) problem(MESSAGES.victoryMedals);

  return problems;
}

// --- Reading a file -------------------------------------------------------

const EXPECTED = {
  missing: { es: "falta", en: "is missing" },
  unknownField: { es: "no es un campo de escenario", en: "isn't a scenario field" },
  object: { es: "debe ser un objeto", en: "must be an object" },
  text: { es: "debe ser un texto", en: "must be a text" },
  localized: { es: 'debe ser un texto en cada idioma: { "es": …, "en": … }', en: 'must be a text in each language: { "es": …, "en": … }' },
  wholeNumber: { es: "debe ser un número entero", en: "must be a whole number" },
  boolean: { es: "debe ser true o false", en: "must be true or false" },
  faction: { es: 'debe ser "Allies" o "Axis"', en: 'must be "Allies" or "Axis"' },
  factions: { es: 'debe ser una lista de bandos ("Allies", "Axis")', en: 'must be a list of sides ("Allies", "Axis")' },
  positions: { es: 'debe ser una lista de casillas { "row": …, "col": … }', en: 'must be a list of hexes { "row": …, "col": … }' },
  pickedTiles: {
    es: 'debe ser una lista de casillas con su loseta { "row": …, "col": …, "tile": "village-3" }',
    en: 'must be a list of hexes with their tile { "row": …, "col": …, "tile": "village-3" }',
  },
  hexType: { es: "no es un terreno", en: "isn't a terrain" },
  unitType: { es: "no es un tipo de unidad", en: "isn't a unit type" },
  version: { es: `debe ser ${SCENARIO_FILE_VERSION}`, en: `must be ${SCENARIO_FILE_VERSION}` },
  board: {
    es: `debe ser "standard" o { "cols": ${BOARD_LIMITS.cols.min}–${BOARD_LIMITS.cols.max}, "rows": ${BOARD_LIMITS.rows.min}–${BOARD_LIMITS.rows.max}, impar }`,
    en: `must be "standard" or { "cols": ${BOARD_LIMITS.cols.min}–${BOARD_LIMITS.cols.max}, "rows": ${BOARD_LIMITS.rows.min}–${BOARD_LIMITS.rows.max}, odd }`,
  },
  objectives: { es: "debe ser una lista de objetivos", en: "must be a list of objectives" },
} satisfies Record<string, Localized>;

/** A file's board: undefined for the standard one, null when it isn't a board */
function readBoard(board: unknown): BoardSize | undefined | null {
  if (board === "standard") return undefined;
  if (!isRecord(board) || Object.keys(board).some((key) => key !== "cols" && key !== "rows")) return null;
  const size = { cols: board.cols, rows: board.rows };
  if (typeof size.cols !== "number" || typeof size.rows !== "number") return null;
  const read = { cols: size.cols, rows: size.rows };
  if (!isBoardSize(read)) return null;
  return isStandardBoard(read) ? undefined : read;
}

const NOT_A_SCENARIO: Localized = { es: "El archivo no es un escenario", en: "The file isn't a scenario" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => Number.isInteger(value);
const isPosition = (value: unknown): value is Position =>
  isRecord(value) && Object.keys(value).length === 2 && Number.isInteger(value.row) && Number.isInteger(value.col);
const isPositionList = (value: unknown): value is Position[] => Array.isArray(value) && value.every(isPosition);
const isPickedTile = (value: unknown): value is PickedTile =>
  isRecord(value) &&
  Object.keys(value).length === 3 &&
  Number.isInteger(value.row) &&
  Number.isInteger(value.col) &&
  typeof value.tile === "string" &&
  /^[a-z0-9-]+$/.test(value.tile);
const isPickedTileList = (value: unknown): value is PickedTile[] => Array.isArray(value) && value.every(isPickedTile);
const isFactionList = (value: unknown): value is Faction[] => Array.isArray(value) && value.every(isFaction);

const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

/** Reads a file's fields one by one, noting each one that's wrong */
class FileReader {
  readonly problems: ScenarioProblem[] = [];

  fail(path: string, expected: Localized): undefined {
    this.problems.push({ message: { es: `«${path}» ${expected.es}`, en: `"${path}" ${expected.en}` }, positions: [] });
    return undefined;
  }

  check<T>(value: unknown, path: string, test: (value: unknown) => value is T, expected: Localized): T | undefined {
    if (value === undefined) return this.fail(path, EXPECTED.missing);
    return test(value) ? value : this.fail(path, expected);
  }

  /** An object with only the fields given */
  object(value: unknown, path: string, fields: readonly string[]): Record<string, unknown> | undefined {
    const object = this.check(value, path, isRecord, EXPECTED.object);
    if (!object) return undefined;
    for (const key of Object.keys(object)) {
      if (!fields.includes(key)) this.fail(join(path, key), EXPECTED.unknownField);
    }
    return object;
  }

  /** `{ allies, axis }`, each read with `read` */
  sides<T>(value: unknown, path: string, read: (value: unknown, path: string) => T | undefined) {
    const object = this.object(value, path, ["allies", "axis"]);
    if (!object) return undefined;
    const allies = read(object.allies, join(path, "allies"));
    const axis = read(object.axis, join(path, "axis"));
    return allies === undefined || axis === undefined ? undefined : { allies, axis };
  }

  /** Lists of hexes by key: terrain → hexes, unit type → hexes */
  groups(value: unknown, path: string, isKey: (key: string) => boolean, badKey: Localized) {
    const object = this.check(value, path, isRecord, EXPECTED.object);
    if (!object) return undefined;
    const groups: Record<string, Position[]> = {};
    for (const [key, positions] of Object.entries(object)) {
      if (!isKey(key)) {
        this.fail(join(path, key), badKey);
        continue;
      }
      const list = this.check(positions, join(path, key), isPositionList, EXPECTED.positions);
      if (list) groups[key] = list;
    }
    return groups;
  }

  positions = (value: unknown, path: string) => this.check(value, path, isPositionList, EXPECTED.positions);
  number = (value: unknown, path: string) => this.check(value, path, isNumber, EXPECTED.wholeNumber);
  faction = (value: unknown, path: string) => this.check(value, path, isFaction, EXPECTED.faction);

  paradrop(value: unknown, path: string) {
    const drop = this.object(value, path, ["faction", "unitType", "units"]);
    if (!drop) return undefined;
    this.faction(drop.faction, join(path, "faction"));
    this.check(drop.unitType, join(path, "unitType"), isUnitType, EXPECTED.unitType);
    this.number(drop.units, join(path, "units"));
    return drop;
  }

  victory(value: unknown, path: string) {
    const victory = this.object(value, path, ["medals", "objectives"]);
    if (!victory) return undefined;
    this.number(victory.medals, join(path, "medals"));
    if (victory.objectives !== undefined) {
      const list = this.check(victory.objectives, join(path, "objectives"), Array.isArray, EXPECTED.objectives);
      list?.forEach((item, i) => {
        const at = join(path, `objectives.${i}`);
        const objective = this.object(item, at, ["faction", "name", "hexes"]);
        if (!objective) return;
        this.faction(objective.faction, join(at, "faction"));
        this.check(objective.name, join(at, "name"), isLocalized, EXPECTED.localized);
        this.positions(objective.hexes, join(at, "hexes"));
      });
    }
    return victory;
  }

  extraDraws(value: unknown, path: string) {
    const draws = this.object(value, path, ["faction", "turns"]);
    if (!draws) return undefined;
    this.faction(draws.faction, join(path, "faction"));
    this.number(draws.turns, join(path, "turns"));
    return draws;
  }
}

/**
 * Read a scenario file (JSON already parsed, of any shape). Throws a
 * ScenarioFileError listing everything wrong with it, the shape first: the
 * rules are only checked on a file that has the right shape. With `rules: false`
 * only the shape is checked, for a map still being made (the editor's draft).
 */
export function parseScenario(json: unknown, { rules = true }: { rules?: boolean } = {}): Scenario {
  const reader = new FileReader();
  if (!isRecord(json)) throw new ScenarioFileError([{ message: NOT_A_SCENARIO, positions: [] }]);
  const file = reader.object(json, "", SCENARIO_FILE_FIELDS)!;
  const optional = <T>(key: keyof ScenarioFile, read: (value: unknown, path: string) => T | undefined) =>
    file[key] === undefined ? undefined : read(file[key], key);

  optional("$schema", (value, path) => reader.check(value, path, isText, EXPECTED.text));
  if (file.version !== SCENARIO_FILE_VERSION) reader.fail("version", EXPECTED.version);
  const board = readBoard(file.board);
  if (board === null) reader.fail("board", EXPECTED.board);

  const read = {
    id: reader.check(file.id, "id", isText, EXPECTED.text),
    board: board ?? undefined,
    name: reader.check(file.name, "name", isLocalized, EXPECTED.localized),
    description: reader.check(file.description, "description", isLocalized, EXPECTED.localized),
    notes: optional("notes", (value, path) => reader.check(value, path, isText, EXPECTED.text)),
    initialHandSize: reader.sides(file.initialHandSize, "initialHandSize", reader.number),
    attacker: reader.faction(file.attacker, "attacker"),
    tiles: reader.groups(file.tiles, "tiles", isHexType, EXPECTED.hexType),
    pickedTiles: optional("pickedTiles", (value, path) => reader.check(value, path, isPickedTileList, EXPECTED.pickedTiles)),
    units: reader.sides(file.units, "units", (value, path) => reader.groups(value, path, isUnitType, EXPECTED.unitType)),
    paradrop: optional("paradrop", (value, path) => reader.paradrop(value, path)),
    wire: optional("wire", reader.positions),
    sandbags: optional("sandbags", reader.positions),
    elite: optional("elite", reader.positions),
    extraDraws: optional("extraDraws", (value, path) => reader.extraDraws(value, path)),
    bigGuns: optional("bigGuns", (value, path) => reader.check(value, path, isFactionList, EXPECTED.factions)),
    airPower: optional("airPower", (value, path) => reader.sides(value, path, reader.number)),
    fordableRivers: optional("fordableRivers", (value, path) =>
      reader.check(value, path, (v): v is boolean => typeof v === "boolean", EXPECTED.boolean)
    ),
    victory: optional("victory", (value, path) => reader.victory(value, path)),
  };
  if (reader.problems.length) throw new ScenarioFileError(reader.problems);

  // The shape is right, so every field read is what Scenario says it is
  const scenario = Object.fromEntries(Object.entries(read).filter(([, value]) => value !== undefined)) as unknown as Scenario;
  const problems = rules ? validateScenario(scenario) : [];
  if (problems.length) throw new ScenarioFileError(problems);
  return scenario;
}
