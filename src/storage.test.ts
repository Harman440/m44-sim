import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSavedGame,
  loadLastSetup,
  loadSavedGame,
  loadSettings,
  saveGame,
  saveLastSetup,
  saveSettings,
} from "./storage";
import { DEFAULT_SETTINGS } from "./settings";
import GameSession from "./game-core/gameSession";
import CommandCard, { CommandCardType } from "./game-core/commandCard";
import { TurnPhase } from "./types/gameManager";
import { Scenario } from "./types/scenario";

const SAVED_GAME_KEY = "m44-sim:saved-game";

const scenario: Scenario = {
  id: "test",
  name: "Test",
  description: "",
  initialHandSize: { allies: 2, axis: 2 },
  tiles: {},
  units: { allies: { infantry: [{ row: 7, col: 1 }] }, axis: {} },
};

const cards = () => [
  new CommandCard({ id: "a", type: CommandCardType.LEFT, maxTotalOrders: 1 }),
  new CommandCard({ id: "b", type: CommandCardType.RIGHT, maxTotalOrders: 1 }),
  new CommandCard({ id: "c", type: CommandCardType.CENTER, maxTotalOrders: 1 }),
];

const newSession = () =>
  new GameSession({ scenario, faction: "Axis", initialHandSize: 2, commandCards: cards() });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("last setup", () => {
  it("remembers the last scenario and side", () => {
    expect(loadLastSetup()).toBeUndefined();

    saveLastSetup({ scenarioId: "test", faction: "Axis" });

    expect(loadLastSetup()).toEqual({ scenarioId: "test", faction: "Axis" });
  });

  it("ignores a setup it can't read", () => {
    localStorage.setItem("m44-sim:last-setup", "{not json");

    expect(loadLastSetup()).toBeUndefined();
  });
});

describe("settings", () => {
  it("remembers the look and sound, with defaults until something is saved", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    saveSettings({ look: "field", sound: true });

    expect(loadSettings()).toEqual({ look: "field", sound: true });
  });

  it("uses the defaults when the saved settings can't be read", () => {
    localStorage.setItem("m44-sim:settings", "{oops");

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saved game", () => {
  it("saves a game and picks it up again", () => {
    const session = newSession();
    session.pickCard(session.getSnapshot().hand[0]!);
    saveGame(session);

    const restored = loadSavedGame([scenario], cards());

    expect(restored?.faction).toBe("Axis");
    expect(restored?.getSnapshot().phase).toBe(TurnPhase.ORDER_UNITS);
    expect(restored?.getSnapshot().chosenCard?.id).toBe(session.getSnapshot().chosenCard?.id);
  });

  it("has nothing to load when no game was saved", () => {
    expect(loadSavedGame([scenario], cards())).toBeNull();
  });

  it.each([
    ["isn't JSON", "{not json"],
    ["is from an older app version", JSON.stringify({ version: 0 })],
  ])("drops a save that %s", (_, json) => {
    localStorage.setItem(SAVED_GAME_KEY, json);

    expect(loadSavedGame([scenario], cards())).toBeNull();
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull();
  });

  it("drops a save for a scenario that no longer exists", () => {
    saveGame(newSession());

    expect(loadSavedGame([{ ...scenario, id: "other" }], cards())).toBeNull();
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull();
  });

  it("forgets the game on exit", () => {
    saveGame(newSession());

    clearSavedGame();

    expect(loadSavedGame([scenario], cards())).toBeNull();
  });

  it("keeps going quietly when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => saveGame(newSession())).not.toThrow();
    expect(() => saveLastSetup({ scenarioId: "test", faction: "Allies" })).not.toThrow();
    expect(loadSavedGame([scenario], cards())).toBeNull();
    expect(loadLastSetup()).toBeUndefined();
  });
});
