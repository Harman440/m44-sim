// data/catalog.ts
// Scenarios kept as files (data/catalog/<id>.json, made in the map editor or by
// Claude Code), each with its painted board art in assets/scenarios/<id>.webp.
// scenarios.ts gathers them with import.meta.glob and hands them in here.
// `npm run add-scenario` (scripts/add-scenario.mjs) writes them with catalogFile and formatJson.
import { Scenario } from "../types/scenario";
import { ScenarioFile, parseScenario, toScenarioFile } from "../game-core/scenarioFile";

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * Read the catalog's files, by path, with their board art (image URLs by path).
 * A file that isn't a playable scenario, or isn't named after its id, throws:
 * the tests read the catalog, so a broken file stops the deploy.
 */
export function catalogScenarios(files: Record<string, unknown>, art: Record<string, string>): Scenario[] {
  const artByName = new Map(Object.entries(art).map(([path, url]) => [fileName(path), url]));
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, json]) => {
      let scenario: Scenario;
      try {
        scenario = parseScenario(json);
      } catch (error) {
        throw new Error(`${path}:\n${(error as Error).message}`);
      }
      if (fileName(path) !== `${scenario.id}.json`) throw new Error(`${path}: the file must be named ${scenario.id}.json`);
      const image = artByName.get(`${scenario.id}.webp`);
      return image ? { ...scenario, image } : scenario;
    });
}

/** Where a catalog file finds its format, for editors */
const SCHEMA = "../../game-core/scenarioFile.schema.json";

/**
 * A map exported from the app (Exportar in Mis mapas) as the catalog keeps it, for `npm run
 * add-scenario`. It's checked by parseScenario, which throws listing everything wrong, and keeps
 * its id, terrain and units as exported, so a game in progress on the device's copy goes on with
 * the catalog's. `reserved`: the built-ins' ids, which it can't take. `replacing`: the catalog's
 * file it updates, whose notes (written by hand) it keeps when it has none of its own
 */
export function catalogFile(json: unknown, { reserved = [], replacing }: { reserved?: readonly string[]; replacing?: unknown } = {}): ScenarioFile {
  const scenario = parseScenario(json);
  if (reserved.includes(scenario.id)) throw new Error(`"${scenario.id}" is a built-in scenario's id: give the map another name in the editor`);
  const kept = isRecord(replacing) && typeof replacing.notes === "string" ? replacing.notes : undefined;
  const notes = scenario.notes || kept;
  return { $schema: SCHEMA, ...toScenarioFile({ ...scenario, ...(notes && { notes }) }) };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isPlain = (value: unknown) => value === null || typeof value !== "object";
const entriesOf = (value: object) => Object.entries(value).filter(([, each]) => each !== undefined);

/** An object or array of plain values (or arrays of them) on one line; undefined for anything deeper */
const oneLine = (value: unknown): string | undefined => {
  if (isPlain(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return value.every(isPlain) ? `[${value.map((each) => JSON.stringify(each)).join(", ")}]` : undefined;
  const entries = entriesOf(value as object);
  if (!entries.every(([, each]) => isPlain(each) || (Array.isArray(each) && each.every(isPlain)))) return undefined;
  return entries.length ? `{ ${entries.map(([key, each]) => `${JSON.stringify(key)}: ${oneLine(each)}`).join(", ")} }` : "{}";
};

/**
 * JSON written as the repo's data files are: two-space indents, and an object or array of plain
 * values on one line when it fits in `width` (a hex as `{ "row": 0, "col": 9 }`)
 */
export function formatJson(value: unknown, width = 100): string {
  const write = (each: unknown, indent: string, room: number): string => {
    const line = oneLine(each);
    if (line !== undefined && (isPlain(each) || line.length <= room)) return line;
    const inner = `${indent}  `;
    const lines = Array.isArray(each)
      ? each.map((item) => inner + write(item, inner, width - inner.length - 1))
      : entriesOf(each as object).map(([key, item]) => {
          const label = `${JSON.stringify(key)}: `;
          return inner + label + write(item, inner, width - inner.length - label.length - 1);
        });
    const [open, close] = Array.isArray(each) ? ["[", "]"] : ["{", "}"];
    return lines.length ? `${open}\n${lines.join(",\n")}\n${indent}${close}` : `${open}${close}`;
  };
  return `${write(value, "", width)}\n`;
}
