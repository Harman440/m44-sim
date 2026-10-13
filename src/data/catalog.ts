// data/catalog.ts
// Scenarios kept as files (data/catalog/<id>.json, made in the map editor or by
// Claude Code), each with its painted board art in assets/scenarios/<id>.webp.
// scenarios.ts gathers them with import.meta.glob and hands them in here.
import { Scenario } from "../types/scenario";
import { parseScenario } from "../game-core/scenarioFile";

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
