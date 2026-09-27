// storage.ts
// What this device remembers between visits. localStorage can be unavailable
// (private mode) or hold data from an older version, so every read and write
// is allowed to fail quietly.
import CommandCard from "./game-core/commandCard";
import GameSession from "./game-core/gameSession";
import { SavedGame } from "./game-core/saveGame";
import { GameSetup } from "./types/faction";
import { Scenario } from "./types/scenario";
import { Settings, normalizeSettings } from "./settings";

const LAST_SETUP_KEY = "m44-sim:last-setup";
const SAVED_GAME_KEY = "m44-sim:saved-game";
const SETTINGS_KEY = "m44-sim:settings";

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

/** The game in progress, so a reload or the tablet sleeping doesn't lose it */
export const loadSavedGame = (scenarios: Scenario[], commandCards: CommandCard[]): GameSession | null => {
  try {
    const json = localStorage.getItem(SAVED_GAME_KEY);
    if (!json) return null;
    const saved: SavedGame = JSON.parse(json);
    const scenario = scenarios.find((s) => s.id === saved.scenarioId);
    if (!scenario) throw new Error(`Unknown scenario ${saved.scenarioId}`);
    return GameSession.restore(saved, scenario, commandCards);
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
