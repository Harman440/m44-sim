// storage.ts
// What this device remembers between visits. localStorage can be unavailable
// (private mode) or hold data from an older version, so every read and write
// is allowed to fail quietly.
import GameSession from "./game-core/gameSession";
import { SavedGame } from "./game-core/saveGame";
import PassAndPlayMatch, { SavedMatch } from "./game-core/passAndPlay";
import { GameSetup } from "./types/faction";
import { Scenario } from "./types/scenario";
import { allCombatCards, combatDeckFor } from "./data/combatCards";
import { commandDeckFor } from "./data/commandCards";
import { Settings, normalizeSettings } from "./settings";

const LAST_SETUP_KEY = "m44-sim:last-setup";
const SAVED_GAME_KEY = "m44-sim:saved-game";
const SAVED_MATCH_KEY = "m44-sim:saved-match";
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

/** One side's game, with its decks. Throws if the save doesn't fit */
const restoreSide = (saved: SavedGame, scenarios: Scenario[]): GameSession => {
  const scenario = scenarios.find((s) => s.id === saved.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${saved.scenarioId}`);
  const combatCards = saved.testMode ? allCombatCards() : combatDeckFor(scenario, saved.faction);
  return GameSession.restore(saved, scenario, commandDeckFor(scenario, saved.faction), combatCards);
};

/** The game in progress, so a reload or the tablet sleeping doesn't lose it */
export const loadSavedGame = (scenarios: Scenario[]): GameSession | null => {
  try {
    const json = localStorage.getItem(SAVED_GAME_KEY);
    if (!json) return null;
    return restoreSide(JSON.parse(json), scenarios);
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

/** The pass and play match in progress, kept apart from the one-side game */
export const loadSavedMatch = (scenarios: Scenario[]): PassAndPlayMatch | null => {
  try {
    const json = localStorage.getItem(SAVED_MATCH_KEY);
    if (!json) return null;
    const saved: SavedMatch = JSON.parse(json);
    const scenario = scenarios.find((s) => s.id === saved.sides?.allies?.scenarioId);
    if (!scenario) throw new Error("Unknown scenario");
    return PassAndPlayMatch.restore(saved, scenario, (side) => restoreSide(side, scenarios));
  } catch {
    clearSavedMatch();
    return null;
  }
};

export const saveMatch = (match: PassAndPlayMatch) => {
  try {
    localStorage.setItem(SAVED_MATCH_KEY, JSON.stringify(match.save()));
  } catch {
    // Storage full or unavailable: the match goes on, it just won't survive a reload
  }
};

export const clearSavedMatch = () => {
  try {
    localStorage.removeItem(SAVED_MATCH_KEY);
  } catch {
    // Nothing to clear
  }
};
