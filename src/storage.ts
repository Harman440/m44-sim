// storage.ts
// What this device remembers between visits. localStorage can be unavailable
// (private mode) or hold data from an older version, so every read and write
// is allowed to fail quietly.
import GameSession from "./game-core/gameSession";
import { SavedGame } from "./game-core/saveGame";
import { GameSetup } from "./types/faction";
import { Scenario } from "./types/scenario";
import { parseScenario, toScenarioFile } from "./game-core/scenarioFile";
import { hasName, isBlank, isProvisionalId, mapIdFor } from "./game-core/scenarioDraft";
import { allCombatCards, combatDeckFor } from "./data/combatCards";
import { commandDeckFor } from "./data/commandCards";
import { Settings, normalizeSettings } from "./settings";

const LAST_SETUP_KEY = "m44-sim:last-setup";
const SAVED_GAME_KEY = "m44-sim:saved-game";
const SETTINGS_KEY = "m44-sim:settings";
const CUSTOM_MAPS_KEY = "m44-sim:custom-maps";
/** Where the editor kept its one map before Mis mapas */
const MAP_DRAFT_KEY = "m44-sim:map-draft";

/** Look and sound for this device; defaults for anything missing or unreadable */
export const loadSettings = (): Settings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(saved ? JSON.parse(saved) : undefined);
  } catch {
    return normalizeSettings(undefined);
  }
};

export const saveSettings = (settings: Settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The choice just won't be remembered
  }
};

/** The last scenario and side, so the next game on this device starts one tap away */
export const loadLastSetup = (): Partial<GameSetup> | undefined => {
  try {
    const saved = localStorage.getItem(LAST_SETUP_KEY);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
};

export const saveLastSetup = (setup: GameSetup) => {
  try {
    localStorage.setItem(LAST_SETUP_KEY, JSON.stringify(setup));
  } catch {
    // The menu just won't pre-select
  }
};

/** The scenario of the game in progress, if there's one, to have its map ready before it's picked back up */
export const savedGameScenarioId = (): string | null => {
  try {
    const json = localStorage.getItem(SAVED_GAME_KEY);
    const id: unknown = json ? (JSON.parse(json) as Partial<SavedGame>).scenarioId : null;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
};

/** The game in progress, so a reload or the tablet sleeping doesn't lose it */
export const loadSavedGame = (scenarios: readonly Scenario[]): GameSession | null => {
  try {
    const json = localStorage.getItem(SAVED_GAME_KEY);
    if (!json) return null;
    const saved: SavedGame = JSON.parse(json);
    const scenario = scenarios.find((s) => s.id === saved.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario ${saved.scenarioId}`);
    const combatCards = saved.testMode ? allCombatCards() : combatDeckFor(scenario, saved.faction);
    return GameSession.restore(saved, scenario, commandDeckFor(scenario, saved.faction), combatCards);
  } catch {
    // A save we can't read (older version, changed scenario) is dropped: start from the menu
    clearSavedGame();
    return null;
  }
};

export const saveGame = (session: GameSession) => {
  try {
    localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(session.save()));
  } catch {
    // Storage full or unavailable: the game goes on, it just won't survive a reload
  }
};

export const clearSavedGame = () => {
  try {
    localStorage.removeItem(SAVED_GAME_KEY);
  } catch {
    // Nothing to clear
  }
};

// --- Mis mapas: the maps made on this device ----------------------------------

/** The maps as files, in the order they were made; a few KB each */
const readMapFiles = (): unknown[] => {
  const json = localStorage.getItem(CUSTOM_MAPS_KEY);
  const files: unknown = json ? JSON.parse(json) : [];
  return Array.isArray(files) ? files : [];
};

const fileId = (file: unknown) => (typeof file === "object" && file !== null ? (file as { id?: unknown }).id : undefined);

/** The editor's one map from before Mis mapas, made the first of Mis mapas unless it's blank */
const adoptMapDraft = (files: unknown[]): unknown[] => {
  try {
    const json = localStorage.getItem(MAP_DRAFT_KEY);
    if (!json) return files;
    localStorage.removeItem(MAP_DRAFT_KEY);
    const draft: unknown = JSON.parse(json);
    if (isBlank(parseScenario(draft, { rules: false })) || files.some((file) => fileId(file) === fileId(draft))) return files;
    const adopted = [draft, ...files];
    localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(adopted));
    return adopted;
  } catch {
    return files;
  }
};

/**
 * The maps made on this device ("Mis mapas"), playable or not yet. Only their shape is checked
 * (they can be half made); one that can't be read is left out
 */
export const loadCustomMaps = (): Scenario[] => {
  try {
    return adoptMapDraft(readMapFiles()).flatMap((file) => {
      try {
        return [parseScenario(file, { rules: false })];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
};

/** Keep a map in Mis mapas, in place of the one with id `replacing` (its own, unless its id changed) */
export const saveCustomMap = (map: Scenario, replacing: string = map.id) => {
  try {
    const files = readMapFiles();
    const file = toScenarioFile(map);
    const at = files.findIndex((each) => fileId(each) === replacing);
    if (at >= 0) files[at] = file;
    else files.push(file);
    localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(files));
  } catch {
    // Storage full or unavailable: the map just won't be kept
  }
};

export const deleteCustomMap = (id: string) => {
  try {
    localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(readMapFiles().filter((file) => fileId(file) !== id)));
  } catch {
    // Nothing to delete
  }
};

/**
 * Give each map that has left the editor with a name its id from the name (scenarioDraft's
 * `mapIdFor`), never one of `reserved` (the built-ins') or another map's. Returns the new ids by old id
 */
export const settleMapIds = (reserved: readonly string[]): Map<string, string> => {
  const renamed = new Map<string, string>();
  const maps = loadCustomMaps();
  const taken = new Set([...reserved, ...maps.map((map) => map.id)]);
  for (const map of maps) {
    if (!isProvisionalId(map.id) || !hasName(map)) continue;
    const id = mapIdFor(map, (each) => taken.has(each));
    if (id === map.id) continue;
    saveCustomMap({ ...map, id }, map.id);
    taken.add(id);
    renamed.set(map.id, id);
  }
  return renamed;
};
